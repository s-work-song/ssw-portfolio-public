import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as sse from '../../../../src/features/chat/transport/sse.ts';
import { ChatTurnError, runChatTurn } from '../../../../src/features/chat/workflow/chatTurn.ts';
import { runBrowserToolCalls, TOOL_OBSERVATION_MIN_DELAY_MS } from '../../../../src/features/chat/workflow/browserToolRunner.ts';
import { chatFailureRetryAfterMs, chatRetryWaitSeconds, failedChatMessage } from '../../../../src/features/chat/transport/chatFailure.ts';
import { canSendUnverifiedExplanation, chatFailureAvailability } from '../../../../src/features/chat/transport/chatAvailability.ts';
import { GREETING } from '../../../../src/features/chat/constants.ts';
import { CHOICE_SETTING_TARGETS } from '../../../../src/features/portfolio-tools/schema.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const PROVIDER_URL = new URL('../../../../src/features/chat/state/ChatProvider.tsx', import.meta.url);
const API_URL = new URL('../../../../src/features/chat/transport/api.ts', import.meta.url);

export const abortError = () => new DOMException('The operation was aborted.', 'AbortError');

export function readProviderSource() {
  return readFileSync(PROVIDER_URL, 'utf8').replaceAll('\r\n', '\n');
}

/** 시작·끝 문구 사이의 Provider 코드를 잘라 온다. 문구가 사라지면 엉뚱한 코드를 싣지 않게 바로 실패한다. */
export function providerSlice(source, startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start);
  assert.ok(start >= 0 && end > start, `Provider에서 ${startText.trim()} 구간을 찾을 수 있어야 한다`);
  return source.slice(start, end);
}

/** 모듈 최상위 선언만 이름으로 골라 온다(함수 안의 같은 이름은 보지 않는다). */
export function topLevelDeclarations(source, names) {
  const ast = ts.createSourceFile('ChatProvider.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = new Map();
  for (const statement of ast.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const name = declaration.name.getText(ast);
        if (names.includes(name)) found.set(name, `const ${declaration.getText(ast)};`);
      }
    }
    if (ts.isFunctionDeclaration(statement) && names.includes(statement.name?.text)) {
      found.set(statement.name.text, statement.getText(ast));
    }
  }
  assert.deepEqual([...found.keys()].sort(), [...names].sort());
  return names.map(name => found.get(name)).join('\n');
}

/** 타입만 지운다. 모듈 문법이 없는 Provider 조각을 new Function 본문으로 쓰기 위한 변환이다. */
export function stripTypes(code) {
  return ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
}

let compiledTurn = null;
function compiledTurnSection() {
  if (compiledTurn) return compiledTurn;
  const source = readProviderSource();
  compiledTurn = stripTypes([
    topLevelDeclarations(source, ['SESSION_RENEWED_NOTICE', 'initialMessages', 'CHAT_TURN_API']),
    providerSlice(source, '  const syncRetryWait = useCallback(', '\n  useEffect('),
    providerSlice(source, '  const closeSession = useCallback(', '\n  /** 스트리밍 사용 여부'),
  ].join('\n'));
  return compiledTurn;
}

/**
 * 실제 `transport/api.ts`를 CommonJS로 바꿔 불러온다. fetch와 공개 API 주소만 주입하고
 * SSE 계약 검사(`./sse`)는 테스트가 import한 같은 모듈을 쓴다.
 */
export function loadChatApi(fetch, env = { NEXT_PUBLIC_RAG_API_BASE_URL: 'https://fixture.invalid' }) {
  const compiled = ts.transpileModule(readFileSync(API_URL, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const localRequire = createRequire(API_URL);
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', 'fetch', 'process', compiled)(
    name => name === './sse' ? sse : localRequire(name), loaded, loaded.exports, fetch, { env });
  return loaded.exports;
}

/**
 * 서버 대역이다. 구간(턴 시작·tool-results)마다 outcomes에서 결말을 하나씩 꺼낸다.
 * outcome: { wait, delta, events, error, calls, answer }. wait는 finish() 또는 중단 신호로 풀린다.
 */
function mockChatApi(state, outcomes) {
  let turnSequence = 0;
  const respond = async (request, signal, onEvent) => {
    state.requests.push(request);
    const outcome = outcomes.shift() ?? {};
    if (outcome.wait) {
      await new Promise(resolve => {
        state.finish = resolve;
        signal.addEventListener('abort', resolve, { once: true });
      });
    }
    if (signal.aborted) throw abortError();
    for (const event of outcome.events ?? []) onEvent(event);
    if (outcome.delta) onEvent({ type: 'delta', text: outcome.delta });
    if (outcome.error) throw typeof outcome.error === 'function' ? outcome.error() : outcome.error;
    const turnId = request.body.turnId ?? `turn-${++turnSequence}`;
    if (outcome.calls) return { type: 'tool_request', turnId, calls: outcome.calls };
    return { type: 'done', turnId, answer: outcome.answer ?? `완료한 답변 ${state.requests.length}` };
  };
  return {
    async createChatSession(signal) {
      if (signal.aborted) throw abortError();
      const index = state.sessions.length + 1;
      const session = { sessionId: index.toString(16).padStart(32, '0'), token: `token-${index}` };
      state.sessions.push(session);
      return session;
    },
    streamChatTurn: (session, body, signal, onEvent) => respond(
      { kind: 'turn', session, message: body.message, body: structuredClone(body) }, signal, onEvent),
    streamChatToolResults: (session, body, signal, onEvent) => respond(
      { kind: 'tool-results', session, body: structuredClone(body) }, signal, onEvent),
    closeChatSession: session => { state.closed.push(session); },
  };
}

const SETTING_KEYS = {
  set_portfolio_theme: ['theme', 'theme'],
  set_portfolio_accent: ['accent', 'accent'],
  set_portfolio_chat_layout: ['layout', 'chatLayout'],
  set_portfolio_chat_font: ['font', 'chatFont'],
  set_portfolio_chat_font_size: ['size', 'chatFontSize'],
  set_portfolio_stream_animation: ['animation', 'streamAnimation'],
};

/**
 * 실제 Provider의 질문 수명주기(performTurn·sendMessage·retry·stop·reset·재시도 대기)를
 * 타입만 지워 실행한다. React effect·렌더는 없으므로 상태 setter와 ref를 직접 연결하고,
 * 서버 HTTP·DOM·시간만 대체한다. 턴 진행(runChatTurn)과 도구 실행(runBrowserToolCalls)은 실제 모듈이다.
 */
export function chatProviderFixture(t, options = {}) {
  const state = {
    messages: options.messages ? [...options.messages] : [], requests: [], sessions: [], closed: [],
    effects: [], viewReads: [], availability: [], diagnostics: [], loadingChanges: [], audience: null,
    loading: false, error: null, retryWaitSeconds: 0, finish: null,
    uiSettings: { theme: 'light', accent: 'royalblue', chatLayout: 'floating', chatFont: 'pretendard',
      chatFontSize: 'medium', streamAnimation: 'none' },
    viewState: { page: 'overview', anchor: null, researchTab: null, researchYear: null, researchDetails: null },
    get turns() { return state.requests.filter(request => request.kind === 'turn'); },
  };
  const api = options.api ?? mockChatApi(state, [...(options.outcomes ?? [])]);
  let clock = Date.parse('2026-10-28T00:00:00Z');
  const FixtureDate = class extends Date { static now() { return clock; } };
  // 도구 runner의 최소 관측 대기를 건너뛰도록 성능 시계는 읽을 때마다 크게 흐른다.
  let performanceClock = 0;
  const intervals = new Map();
  let intervalId = 0;
  const window = {
    location: { pathname: options.pathname ?? '/about-me' },
    setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
    setInterval(callback) { intervals.set(++intervalId, callback); return intervalId; },
    clearInterval(id) { intervals.delete(id); },
  };
  const refs = {
    inFlightRef: { current: false }, stopRequestedRef: { current: false }, abortRef: { current: null },
    mountedRef: { current: true }, renderQueueRef: { current: null }, retryRef: { current: null },
    retryWaitDeadlineRef: { current: 0 }, requestCooldownDeadlineRef: { current: 0 }, retryWaitTimerRef: { current: null },
    sessionRef: { current: options.session ?? null }, sessionClosedOnPageHideRef: { current: options.sessionClosedOnPageHide === true },
    pendingChatNavigationFocusRef: { current: false },
    toolResultWatchersRef: { current: new Set() }, pendingOpenAfterCloseRef: { current: null },
    isOpenRef: { current: options.isOpen !== false }, isClosingRef: { current: false },
  };
  let sequence = 0;
  const context = {
    ...refs, window, document: {}, process: { env: {} }, Date: FixtureDate,
    performance: { now: () => (performanceClock += 1_000) },
    useCallback: callback => callback,
    availability: options.availability ?? 'online', streamingEnabled: options.streaming !== false,
    messagesRef: { get current() { return state.messages; } },
    uiSettingsRef: { get current() { return state.uiSettings; } },
    setMessages: update => { state.messages = typeof update === 'function' ? update(state.messages) : update; },
    setIsLoading: value => { state.loading = value; state.loadingChanges.push(value); },
    setError: value => { state.error = value; },
    setRetryWaitSeconds: value => { state.retryWaitSeconds = value; },
    setAudience: value => { state.audience = value; options.onAudience?.(value); },
    nextId: prefix => `${prefix}-${++sequence}`,
    RETRY_WAIT_TICK_MS: 250, TOOL_OBSERVATION_MIN_DELAY_MS, TOOL_ARRIVAL_TIMEOUT_MS: 8_000, GREETING,
    createChatSession: api.createChatSession, streamChatTurn: api.streamChatTurn,
    streamChatToolResults: api.streamChatToolResults, closeChatSession: api.closeChatSession,
    runChatTurn, ChatTurnError, ChatApiError: sse.ChatApiError, runBrowserToolCalls, CHOICE_SETTING_TARGETS,
    chatDockFitsViewport: () => true,
    chatFailureRetryAfterMs, chatRetryWaitSeconds, failedChatMessage, canSendUnverifiedExplanation, chatFailureAvailability,
    logChatFailureLocally: (stage, error) => state.diagnostics.push([stage, error?.code ?? null]),
    reportAvailability: value => state.availability.push(value),
    readPortfolioViewState: pathname => { state.viewReads.push(pathname); return structuredClone(state.viewState); },
    async executePortfolioUiTool(command) {
      if (command.signal?.aborted) throw abortError();
      state.effects.push([command.name, structuredClone(command.input)]);
      if (options.executeUiTool) return options.executeUiTool(command, state);
      const setting = SETTING_KEYS[command.name];
      if (setting) {
        state.uiSettings = { ...state.uiSettings, [setting[1]]: command.input[setting[0]] };
        return { ok: true };
      }
      if (command.name === 'control_portfolio_view') {
        return { ok: true, route: '/about-me/research#research-year-2025', label: '연구 여정 2025년' };
      }
      return { ok: true, status: 'applied' };
    },
    StreamRenderQueue: class {
      constructor(append) { this.append = append; this.cancelled = false; }
      enqueue(text) { if (!this.cancelled) this.append(text); }
      cancel() { this.cancelled = true; }
      async drain() {}
    },
    observeToolNavigation: options.observeToolNavigation
      ?? (() => ({ completion: Promise.resolve('arrived'), cancel() {} })),
    resolvePortfolioNavigationTarget: () => null, isPortfolioTargetReady: () => true,
    pathWithoutHash: route => route.split('#')[0], CHAT_ACTION_TARGET_ARRIVED_EVENT: 'chat-action-target-arrived',
    ...options.context,
  };
  const compiled = compiledTurnSection();
  const instantiate = values => new Function(...Object.keys(values), `${compiled}
    return { performTurn, sendMessage, retry, stopGenerating, chooseSetting, resetConversation, closeSession, canRequest, initialMessages };`)(
    ...Object.values(values));
  let current = instantiate(context);
  t.after(() => { refs.abortRef.current?.abort(); state.finish?.(); });
  return {
    state, refs, window, api, context,
    initialMessages: () => current.initialMessages(),
    send: (...args) => current.sendMessage(...args),
    retry: () => current.retry(),
    stop: () => current.stopGenerating(),
    choose: (setting, value) => current.chooseSetting(setting, value),
    reset: () => current.resetConversation(),
    closeSession: () => current.closeSession(),
    /** React가 새 상태로 다시 렌더한 뒤의 콜백처럼, 같은 ref 위에서 클로저 값만 바꾼다. */
    rerender(overrides) { current = instantiate({ ...context, ...overrides }); return current; },
    advanceTime(ms) {
      clock += ms;
      for (const callback of [...intervals.values()]) callback();
    },
    now: () => clock,
    async untilRequest(count = 1) {
      for (let index = 0; index < 200; index++) {
        if (state.requests.length >= count) return;
        await Promise.resolve();
      }
      assert.fail(`서버 요청 ${count}개까지 도달하지 못했다`);
    },
  };
}
