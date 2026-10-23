import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { navigationPathMatches, observeToolNavigation } from './toolNavigationObservation.ts';
import * as navigationContract from './navigation.ts';
import { isPortfolioTargetAligned, isPortfolioTargetReady } from '../portfolio-tools/viewTargetVisibility.ts';
import { executePortfolioUiTool, portfolioUiCommandFromChatExecution } from '../portfolio-tools/portfolioUiToolExecutor.ts';

function fixture(overrides = {}) {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  const listeners = new Set();
  const controller = new AbortController();
  const state = { pathname: '/about-me', targetReady: false };
  const options = {
    route: '/settings', basePath: '', startedAt: 0, minimumDelayMs: 500,
    timeoutMs: 8000, signal: controller.signal, read: () => state, now: () => now,
    subscribe(callback) { listeners.add(callback); return () => listeners.delete(callback); },
    schedule(callback, delay) {
      const id = ++nextId;
      timers.set(id, { callback, at: now + delay });
      return () => timers.delete(id);
    },
    ...overrides,
  };
  const observation = observeToolNavigation(options);
  let completed;
  observation.completion.then(value => { completed = value; }, () => {});
  return {
    ...observation, state, controller, timers, listeners,
    get completed() { return completed; },
    async tick(until) {
      for (;;) {
        const first = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!first || first[1].at > until) break;
        now = first[1].at;
        timers.delete(first[0]);
        first[1].callback();
      }
      now = until;
      await Promise.resolve();
    },
    arrive(anchor) { for (const callback of listeners) callback(anchor); },
    jump(until) { now = until; const first = timers.values().next().value; first?.callback(); },
  };
}

test('650ms 설정 도착 재현: 옛 500ms 단발 판정은 실패하지만 실제 도착까지 기다린다', async () => {
  const f = fixture();
  await f.tick(500);
  // 이전 구현은 이 시점에 failed를 고정했다. 모바일 닫기 fallback도 560ms다.
  assert.equal(navigationPathMatches('/settings', f.state.pathname), false);
  assert.equal(f.completed, undefined);
  await f.tick(649);
  Object.assign(f.state, { pathname: '/settings', targetReady: true });
  await f.tick(650);
  assert.equal(await f.completion, 'arrived');
  assert.equal(f.timers.size, 0);
  assert.equal(f.listeners.size, 0);
});

test('경로가 먼저 도착해도 실제 설정 DOM 준비와 최소 500ms 관측을 기다린다', async () => {
  const f = fixture();
  f.state.pathname = '/settings';
  await f.tick(700);
  assert.equal(f.completed, undefined);
  f.state.targetReady = true;
  await f.tick(750);
  assert.equal(await f.completion, 'arrived');
  const already = fixture();
  Object.assign(already.state, { pathname: '/settings', targetReady: true });
  await already.tick(499);
  assert.equal(already.completed, undefined);
  await already.tick(500);
  assert.equal(await already.completion, 'arrived');
});

test('오래된 tool 시작 시각은 새 이동의 실제 도착 대기를 생략하거나 timeout을 당기지 않는다', async () => {
  const f = fixture({ startedAt: -30_000 });
  await f.tick(7500);
  assert.equal(f.completed, undefined);
  Object.assign(f.state, { pathname: '/settings', targetReady: true });
  await f.tick(7550);
  assert.equal(await f.completion, 'arrived');
});

test('미도착·잘못된 경로·숨긴 DOM은 기존 8초 상한에서 실패한다', async () => {
  for (const state of [
    { pathname: '/about-me', targetReady: true },
    { pathname: '/settings', targetReady: false },
  ]) {
    const f = fixture();
    Object.assign(f.state, state);
    await f.tick(7999);
    assert.equal(f.completed, undefined);
    await f.tick(8000);
    assert.equal(await f.completion, 'failed');
    assert.equal(f.timers.size, 0);
    assert.equal(f.listeners.size, 0);
  }
});

test('타이머가 지연되어 상한 이후에 읽힌 늦은 도착을 성공으로 바꾸지 않는다', async () => {
  const f = fixture();
  Object.assign(f.state, { pathname: '/settings', targetReady: true });
  f.jump(9000);
  assert.equal(await f.completion, 'failed');
});

test('basePath와 끝 슬래시는 허용하지만 접두사 유사 경로는 거부한다', async () => {
  assert.equal(navigationPathMatches('/settings/', '/ssw-portfolio-public/settings/', '/ssw-portfolio-public'), true);
  assert.equal(navigationPathMatches('/settings', '/ssw-portfolio-public/settings-old', '/ssw-portfolio-public'), false);
  assert.equal(navigationPathMatches('/settings', '/settings', '/ssw-portfolio-public'), false);
  const f = fixture({ basePath: '/ssw-portfolio-public' });
  Object.assign(f.state, { pathname: '/ssw-portfolio-public/settings/', targetReady: true });
  await f.tick(500);
  assert.equal(await f.completion, 'arrived');
});

test('앵커는 경로·준비된 DOM뿐 아니라 해당 앵커의 기존 도착 신호도 필요하다', async () => {
  const f = fixture({ route: '/about-me/resume#career' });
  Object.assign(f.state, { pathname: '/about-me/resume', targetReady: true });
  await f.tick(600);
  f.arrive('unrelated');
  await f.tick(650);
  assert.equal(f.completed, undefined);
  f.arrive('career');
  // 신호 뒤 숨겨지거나 전환 중인 DOM도 여전히 성공으로 보지 않는다.
  f.state.targetReady = false;
  await f.tick(700);
  assert.equal(f.completed, undefined);
  f.state.targetReady = true;
  await f.tick(750);
  assert.equal(await f.completion, 'arrived');
});

test('앵커 신호가 있어도 실제 경로가 다르거나 신호가 없으면 실패한다', async () => {
  for (const withEvent of [false, true]) {
    const f = fixture({ route: '/about-me/resume#career' });
    Object.assign(f.state, { pathname: withEvent ? '/about-me' : '/about-me/resume', targetReady: true });
    if (withEvent) f.arrive('career');
    await f.tick(8000);
    assert.equal(await f.completion, 'failed');
  }
});

test('중단·언마운트 취소·시작 전 중단은 AbortError와 함께 타이머·리스너를 정리한다', async () => {
  for (const cancel of [f => f.controller.abort(), f => f.cancel()]) {
    const f = fixture();
    const rejected = assert.rejects(f.completion, { name: 'AbortError' });
    await f.tick(300);
    cancel(f);
    await rejected;
    assert.equal(f.timers.size, 0);
    assert.equal(f.listeners.size, 0);
  }
  const controller = new AbortController();
  controller.abort();
  const f = fixture({ signal: controller.signal });
  await assert.rejects(f.completion, { name: 'AbortError' });
  assert.equal(f.timers.size, 0);
  assert.equal(f.listeners.size, 0);
});

test('Provider 연결은 실제 경로·설정 본문·기존 DOM 가시성과 앵커 이벤트를 유지한다', () => {
  const source = readFileSync(new URL('./ChatProvider.tsx', import.meta.url), 'utf8');
  assert.match(source, /observeToolNavigation\(\{/u);
  assert.match(source, /pathname: window\.location\.pathname/u);
  assert.match(source, /\[data-option="theme-mode"\]/u);
  assert.match(source, /targetReady: !!target && isPortfolioTargetReady\(target\)/u);
  assert.match(source, /CHAT_ACTION_TARGET_ARRIVED_EVENT, handleArrived/u);
  assert.match(source, /toolResultWatchersRef\.current\.add\(observation\.cancel\)/u);
});

/** 모사한 이동기가 아니라 Provider의 실제 콜백을 타입만 지워 DOM·RAF fixture에서 실행한다. */
function providerNavigationFixture(t, { motionSuppressed = true, mobile = false } = {}) {
  const source = readFileSync(new URL('./ChatProvider.tsx', import.meta.url), 'utf8');
  const slice = (start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, `${start} 콜백을 찾을 수 있어야 한다`);
    return source.slice(from, to);
  };
  const callbacks = [
    slice('  const animateDocumentScroll = useCallback(', '\n  /** 패널 연출.'),
    slice('  const clearActionNavigation = useCallback(', '\n  // 예약한 경로'),
    slice('  const navigateRoute = useCallback(', '\n  // 이동 함수의 최신 구현'),
  ].join('\n');
  const ts = createRequire(import.meta.url)('typescript');
  const compiled = ts.transpileModule(callbacks, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const tasks = new Map();
  const scheduled = [];
  let now = 0;
  let nextId = 0;
  const schedule = (callback, delay) => {
    const id = ++nextId;
    const task = { id, callback, at: now + delay };
    tasks.set(id, task);
    scheduled.push(task);
    return id;
  };
  const events = new EventTarget();
  const arrivals = [];
  events.addEventListener(navigationContract.CHAT_ACTION_TARGET_ARRIVED_EVENT, event => arrivals.push(event.detail.anchor));
  const state = { layoutAnimations: [], panelAnimations: [], closed: 0 };
  const scroller = { scrollTop: 1_000, scrollHeight: 10_000,
    scrollTo: ({ top }) => { scroller.scrollTop = top; } };
  const root = { scrollHeight: 10_000 };
  const timeline = { getAnimations: () => state.layoutAnimations };
  const targets = Object.fromEntries(['2025', '2026'].map((year, index) => [year, {
    id: `research-year-${year}`, documentTop: 1_180 + index * 1_000,
    getClientRects: () => [{}],
    getBoundingClientRect() {
      const top = this.documentTop - scroller.scrollTop;
      return { top, bottom: top + 100 };
    },
    closest: selector => selector === '#research-timeline' ? timeline : null,
    getAnimations: () => state.panelAnimations,
    focus: () => {}, setAttribute: () => {}, removeAttribute: () => {},
  }]));
  const windowFixture = {
    location: new URL('http://localhost/about-me/research#research-year-2025'),
    performance: { now: () => now }, innerHeight: 800,
    history: { state: {}, pushState: (_state, _title, path) => {
      windowFixture.location = new URL(path, windowFixture.location.href);
    } },
    dispatchEvent: event => events.dispatchEvent(event),
    requestAnimationFrame: callback => schedule(callback, 16), cancelAnimationFrame: id => tasks.delete(id),
    setTimeout: schedule, clearTimeout: id => tasks.delete(id),
    getComputedStyle: element => ({ display: 'block', visibility: 'visible',
      scrollPaddingTop: element === root ? '84px' : '0', scrollMarginTop: '96px' }),
    matchMedia: () => ({ matches: mobile }), scrollTo: value => scroller.scrollTo(value),
  };
  const documentFixture = { scrollingElement: scroller, documentElement: root,
    getElementById: id => targets[id.replace('research-year-', '')] ?? null };
  globalThis.window = windowFixture;
  globalThis.document = documentFixture;
  const refs = Object.fromEntries([
    'actionScrollFrameRef', 'actionTopScrollFrameRef', 'actionScrollTimerRef', 'actionPageEntryTimerRef',
    'pendingActionAnchorRef', 'pendingActionPathRef', 'pendingActionAwaitingPageEntryRef',
    'activeActionNavigationRouteRef', 'activeActionNavigationOptionsRef', 'actionNavigationAbortCleanupRef',
    'actionTargetHighlightTimerRef', 'highlightedActionTargetRef', 'pendingActionRouteRef',
  ].map(name => [name, { current: null }]));
  const context = {
    ...navigationContract, ...refs, window: windowFixture, document: documentFixture,
    process: { env: {} }, useCallback: callback => callback,
    actionNavigationTokenRef: { current: 0 }, actionScrollTokenRef: { current: 0 },
    isOpenRef: { current: true }, mobileHistoryEntryRef: { current: false },
    navigationPathMatches, isPortfolioTargetReady, isPortfolioTargetAligned,
    motionSuppressed, pageTransition: 'none', pathname: '/about-me/research',
    router: { prefetch: () => {}, push: path => { windowFixture.location = new URL(path, windowFixture.location.href); } },
    restoreChatInputAfterNavigation: () => {}, logChatFailureLocally: () => {},
    scrollDurationForDistance: () => 120, easeInOutCubic: value => value, easeOutCubic: value => value,
    ACTION_TARGET_WAIT_TIMEOUT_MS: 3_000, SAFE_ROUTE_PATTERN: /^\/(?!\/)/u,
    MOBILE_QUERY: '(max-width: 700px)', MOBILE_HISTORY_MARKER: 'chat-mobile',
    beginMobileClose: () => { state.closed += 1; },
    HashChangeEvent: class extends Event { constructor(type) { super(type); } },
  };
  const api = new Function(...Object.keys(context), `${compiled}\nreturn {
    navigateToActionTarget, scrollToPendingActionAnchor, clearActionNavigation, navigateRoute };
  `)(...Object.values(context));
  t.after(() => {
    api.clearActionNavigation();
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  });
  return { ...api, refs, state, targets, arrivals, scroller, window: windowFixture, tasks, scheduled,
    async tick(until) {
      for (;;) {
        const next = [...tasks.values()].sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!next || next.at > until) break;
        now = next.at;
        tasks.delete(next.id);
        next.callback(now);
        await Promise.resolve();
      }
      now = until;
      await Promise.resolve();
    },
  };
}

test('실제 Provider: 카드 커밋·높이 전환 뒤 정렬해 같은 연도 조기도착을 막는다', async t => {
  const f = providerNavigationFixture(t);
  let committed = false;
  f.navigateToActionTarget('/about-me/research#research-year-2025', { isTargetReady: () => committed });
  await f.tick(40);
  assert.deepEqual(f.arrivals, [], '옛 위치가 이미 정렬됐어도 카드 커밋 전에 도착하지 않는다');
  committed = true;
  f.state.layoutAnimations = [{ transitionProperty: 'grid-template-rows', playState: 'running' }];
  f.targets['2025'].documentTop = 600;
  await f.tick(300);
  assert.deepEqual(f.arrivals, []);
  f.state.layoutAnimations = [];
  f.targets['2025'].documentTop = 280;
  await f.tick(600);
  assert.deepEqual(f.arrivals, ['research-year-2025']);
  assert.equal(f.targets['2025'].getBoundingClientRect().top, 180);
  assert.equal(f.tasks.size, 0);
});

test('실제 Provider: 같은 경로의 오래된 animation 콜백·취소는 새 이동을 완료하거나 지우지 못한다', async t => {
  const f = providerNavigationFixture(t, { motionSuppressed: false });
  const oldController = new AbortController();
  let finishOldAnimation;
  f.state.panelAnimations = [{ animationName: 'about-page-enter', playState: 'running',
    finished: new Promise(resolve => { finishOldAnimation = resolve; }) }];
  const route = '/about-me/research#research-year-2025';
  f.navigateToActionTarget(route, { signal: oldController.signal });
  await f.tick(32);
  f.state.panelAnimations = [];
  let newReady = false;
  f.navigateToActionTarget(route, { isTargetReady: () => newReady });
  finishOldAnimation();
  oldController.abort();
  await f.tick(200);
  assert.deepEqual(f.arrivals, []);
  assert.equal(f.refs.activeActionNavigationRouteRef.current, route);
  newReady = true;
  await f.tick(400);
  assert.deepEqual(f.arrivals, ['research-year-2025']);
  assert.equal(f.refs.activeActionNavigationRouteRef.current, null);
});

test('실제 Provider: 진행 중 스크롤 취소 뒤 옛 RAF가 실행돼도 문서를 움직이지 않는다', async t => {
  const f = providerNavigationFixture(t, { motionSuppressed: false });
  const controller = new AbortController();
  f.targets['2025'].documentTop = 3_000;
  f.navigateToActionTarget('/about-me/research#research-year-2025', { signal: controller.signal });
  await f.tick(50);
  const oldFrame = f.scheduled.at(-1).callback;
  controller.abort();
  const stoppedAt = f.scroller.scrollTop;
  oldFrame(150);
  await f.tick(1_000);
  assert.equal(f.scroller.scrollTop, stoppedAt);
  assert.deepEqual(f.arrivals, []);
  assert.equal(f.tasks.size, 0);
});

test('실제 Provider: 사용자가 다른 해시·페이지로 이동하면 준비 대기 중인 옛 앵커로 되돌리지 않는다', async t => {
  for (const destination of ['#research-year-2026', '/about-me/resume']) {
    await t.test(destination, async t => {
      const f = providerNavigationFixture(t);
      let ready = false;
      f.navigateToActionTarget('/about-me/research#research-year-2025', { isTargetReady: () => ready });
      await f.tick(40);
      f.window.location = new URL(destination, f.window.location.href);
      const userUrl = f.window.location.href;
      ready = true;
      f.targets['2025'].documentTop = 400;
      await f.tick(500);
      assert.equal(f.window.location.href, userUrl);
      assert.equal(f.scroller.scrollTop, 1_000);
      assert.deepEqual(f.arrivals, []);
      assert.equal(f.tasks.size, 0);
    });
  }
});

test('실제 Provider: 모바일 닫기 대기에도 준비 조건·signal을 보존하고 취소한 예약은 이동하지 않는다', t => {
  const f = providerNavigationFixture(t, { mobile: true });
  const controller = new AbortController();
  const options = { signal: controller.signal, isTargetReady: () => false };
  f.navigateRoute('/about-me/research#research-year-2026', options);
  const pending = f.refs.pendingActionRouteRef.current;
  assert.equal(pending.options, options);
  assert.equal(f.state.closed, 1);
  controller.abort();
  f.navigateToActionTarget(pending.route, pending.options);
  assert.equal(f.window.location.hash, '#research-year-2025');
  assert.equal(f.tasks.size, 0);
});

function providerToolQueueFixture() {
  const source = readFileSync(new URL('./ChatProvider.tsx', import.meta.url), 'utf8');
  const activeStart = source.indexOf('      const isRequestActive = () =>');
  const activeEnd = source.indexOf('      const request: ChatRequest =', activeStart);
  const handlerStart = source.indexOf('      const handleToolExecution = (execution: ChatToolExecution) =>');
  const handlerEnd = source.indexOf('\n      const appendStreamDelta =', handlerStart);
  assert.ok(activeStart >= 0 && activeEnd > activeStart && handlerStart >= 0 && handlerEnd > handlerStart);
  const ts = createRequire(import.meta.url)('typescript');
  const compiled = ts.transpileModule(`${source.slice(activeStart, activeEnd)}
    let toolExecutionQueue = Promise.resolve();
    let renderQueue = null;
    let deferStreamDeltas = false;
    ${source.slice(handlerStart, handlerEnd)}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const controller = new AbortController();
  const abortRef = { current: controller };
  const effects = [];
  const results = [];
  const errors = [];
  const handledToolCallIds = new Set();
  let finishNavigation;
  const navigation = new Promise(resolve => { finishNavigation = resolve; });
  const runtime = {
    navigateRoute: (route, options) => {
      assert.equal(options.signal, controller.signal);
      effects.push(['navigate', route]);
    },
    setChatFontSize: value => effects.push(['font-size', value]),
    setMode: value => effects.push(['theme', value]),
    setAccent: value => effects.push(['accent', value]),
  };
  const context = {
    taskRuntime: undefined, taskTelemetry: { tool: () => {} }, publishToolResults: () => {},
    controller, abortRef, mountedRef: { current: true }, pending: {}, handledToolCallIds,
    verificationToolCallIds: new Set(), verificationExecutions: new Map(), toolStartedAt: new Map(),
    requiresBrowserToolVerification: () => true, shouldStream: false, appendStreamDelta: () => {},
    renderQueueRef: { current: null }, streamingMessageId: undefined, setMessages: () => {},
    uiSettingsRef: { current: null }, appliedSettingValue: () => null,
    recordSettingToolResult: async execution => results.push(execution.toolCallId),
    recordToolResult: result => results.push(result.callId),
    runAccentCycle: () => assert.fail('이 fixture는 순회 요청을 만들지 않는다'),
    portfolioUiCommandFromChatExecution,
    executePortfolioUiTool: command => executePortfolioUiTool(command, runtime),
    pendingChatNavigationFocusRef: { current: false }, fallbackToolResultLabel: execution => execution.toolName,
    waitForMinimumToolObservation: async () => {}, watchNavigationArrival: () => navigation,
    logChatFailureLocally: (_scope, error) => errors.push(error),
    ChatApiError: Error,
  };
  const api = new Function(...Object.keys(context), `${compiled}
    return { handleToolExecution, completion: () => toolExecutionQueue };
  `)(...Object.values(context));
  return { ...api, controller, abortRef, effects, results, errors, handledToolCallIds, finishNavigation };
}

test('실제 Provider 큐: 이동을 기다리는 중 늦게 온 SSE 설정도 순서대로 실행하고 done 재전달은 중복하지 않는다', async () => {
  const f = providerToolQueueFixture();
  const navigate = { type: 'control_portfolio_view', toolName: 'control_portfolio_view', toolCallId: 'nav', action: 'research-2025' };
  const font = { type: 'set_portfolio_chat_font_size', toolName: 'set_portfolio_chat_font_size', toolCallId: 'font', size: 'large' };
  const theme = { type: 'set_portfolio_theme', toolName: 'set_portfolio_theme', toolCallId: 'theme', theme: 'dark' };
  f.handleToolExecution(navigate);
  await new Promise(resolve => setTimeout(resolve, 10));
  f.handleToolExecution(font);
  await new Promise(resolve => setTimeout(resolve, 10));
  f.handleToolExecution(theme);
  assert.deepEqual(f.effects, [['navigate', '/about-me/research#research-year-2025']]);
  f.finishNavigation();
  await f.completion();
  assert.deepEqual(f.effects, [['navigate', '/about-me/research#research-year-2025'], ['font-size', 'large'], ['theme', 'dark']]);
  [navigate, font, theme].forEach(f.handleToolExecution);
  await f.completion();
  assert.equal(f.effects.length, 3);
  assert.deepEqual(f.errors, []);
});

test('실제 Provider 큐: 중단 또는 요청 identity 변경 뒤 대기·늦은 설정은 실행하지 않는다', async t => {
  for (const mode of ['abort', 'new-request']) {
    await t.test(mode, async () => {
      const f = providerToolQueueFixture();
      f.handleToolExecution({ type: 'control_portfolio_view', toolName: 'control_portfolio_view', toolCallId: 'nav', action: 'research-2025' });
      f.handleToolExecution({ type: 'set_portfolio_chat_font_size', toolName: 'set_portfolio_chat_font_size', toolCallId: 'font', size: 'small' });
      await new Promise(resolve => setTimeout(resolve, 10));
      if (mode === 'abort') f.controller.abort();
      else f.abortRef.current = new AbortController();
      f.finishNavigation();
      await f.completion();
      f.handleToolExecution({ type: 'set_portfolio_accent', toolName: 'set_portfolio_accent', toolCallId: 'late-accent', accent: 'rose' });
      await f.completion();
      assert.deepEqual(f.effects, [['navigate', '/about-me/research#research-year-2025']]);
      assert.equal(f.handledToolCallIds.has('late-accent'), false);
      assert.deepEqual(f.errors, []);
    });
  }
});
