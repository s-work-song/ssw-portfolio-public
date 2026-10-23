import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ChatApiError, parseChatResponse } from './parse.ts';
import { expectedToolTaskScope, stepFromExecution, ToolTaskProtocolError, ToolTaskRuntime } from './toolTaskRuntime.ts';
import { BrowserToolTaskTelemetry } from './toolTaskTelemetry.ts';
import { nextChatToolTaskGeneration } from './chatRequestIdentity.ts';
import { requestVerifiedToolResponse, toolFollowupForVerification } from './toolVerificationRequest.ts';
import { toolReportFailureCode } from './toolReport.ts';
import { failedChatMessage, messagesForChatRetry, chatFailureRetryAfterMs } from './chatFailure.ts';
import { appendUiSettingChange, createUiSettingChange } from './uiSettingChangeJournal.ts';
import { chatRetryFailureKind, historyForCapacityRetry } from './chatRetryRecovery.ts';
import { canSendUnverifiedExplanation } from './chatAvailability.ts';
import { settingToolResultLabel } from './constants.ts';
import { portfolioUiCommandFromChatExecution } from '../portfolio-tools/portfolioUiToolExecutor.ts';

export function fourToolReportCase() {
  const scope = { schemaVersion: 'portfolio-tool-task-v1', conversationId: 'report-conversation',
    turnId: 'report-turn', taskId: 'report-task', generation: 1 };
  const names = ['set_portfolio_theme', 'control_portfolio_view', 'control_portfolio_research_details', 'set_portfolio_chat_font_size'];
  const inputs = [{ theme: 'dark' }, { action: 'research-2025' }, { action: 'expand', target: '2025' }, { size: 'xlarge' }];
  const calls = names.map((name, index) => ({ id: `call_${String(index).padStart(24, '0')}`, type: 'function',
    function: { name, arguments: ` ${JSON.stringify(inputs[index])}\n` } }));
  const executions = calls.map((call, stepIndex) => ({ type: names[stepIndex], toolName: names[stepIndex],
    toolCallId: call.id, ...inputs[stepIndex], toolTask: { ...scope, stepIndex, source: 'native', dispatchStatus: 'accepted' } }));
  const steps = executions.map(stepFromExecution);
  const native = [{ role: 'assistant', content: null, tool_calls: calls },
    ...calls.map(call => ({ role: 'tool', tool_call_id: call.id, content: '{"accepted":true}' }))];
  const results = executions.map((item, index) => ({ toolCallId: item.toolCallId, toolName: item.toolName,
    stepIndex: index, status: index === 1 ? 'arrived' : 'applied', elapsedMs: 500,
    ...(item.action ? { action: item.action } : {}), ...(item.target ? { target: item.target } : {}) }));
  const latest = { pageContext: 'research', uiSettings: { theme: 'dark', accent: 'royalblue', chatLayout: 'floating',
    chatFont: 'pretendard', chatFontSize: 'xlarge', streamAnimation: 'none' },
    viewState: { page: 'research', anchor: 'research-year-2025', researchTab: 'timeline', researchYear: '2025',
      researchDetails: { expanded: 3, total: 16, expandedYears: ['2025'] } },
    uiSettingChanges: Array.from({ length: 20 }, (_, index) => ({ toolCallId: `past_${String(index).padStart(24, '0')}`,
      groupId: `11111111-2222-4333-8444-${String(index).padStart(12, '0')}`, toolName: 'set_portfolio_chat_font_size',
      before: 'medium', after: 'xlarge' })) };
  const request = { conversationId: scope.conversationId, turnId: scope.turnId,
    toolTask: { schemaVersion: scope.schemaVersion, taskId: scope.taskId, generation: 1, steps, dispatchComplete: true },
    message: '다크 모드, 연구 2025 이동과 상세 펼치기, 채팅 글자 매우 크게',
    history: [{ role: 'user', content: '이전 질문' }, { role: 'assistant', content: '이전 답변' }],
    audience: 'default', tone: 'official', reasoningEnabled: true, ...structuredClone(latest) };
  return { scope, calls, executions, steps, native, results, latest, request };
}

/** 실제 Provider의 요청·실행 큐·catch·retry를 실행하고 외부 HTTP/DOM만 대체한다. */
export function providerReportFixture(t, options = {}) {
  const source = readFileSync(new URL('./ChatProvider.tsx', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  const select = (startText, endText) => {
    const start = source.indexOf(startText);
    const end = source.indexOf(endText, start);
    assert.ok(start >= 0 && end > start, startText);
    return source.slice(start, end);
  };
  const helpers = select('function fallbackToolResultLabel(', 'const DESKTOP_EXIT_DURATION_MS');
  const perform = select('  const performRequest = useCallback(', '\n  /**\n   * 추론 서버가 꺼져');
  const recovery = select('  const prepareRetry = useCallback(', '\n  /**\n   * 사용자 질문을 보낸다.');
  const retry = select('  const retry = useCallback(', '\n  /**\n   * 진행 중인 응답');
  const ts = createRequire(import.meta.url)('typescript');
  const compiled = ts.transpileModule(`${helpers}\n${perform}\n${recovery}\n${retry}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const fixture = fourToolReportCase();
  const pending = { ...fixture.request, toolTask: { schemaVersion: fixture.scope.schemaVersion, taskId: fixture.scope.taskId, generation: 1 } };
  if (options.history) pending.history = options.history;
  if (options.responseMode) pending.responseMode = options.responseMode;
  const state = { messages: [], effects: [], requests: [], reportRequests: [], telemetry: [], diagnostics: [],
    uiSettings: { ...fixture.latest.uiSettings, theme: 'light', chatFontSize: 'medium' },
    viewState: { page: 'overview', anchor: null }, reportMode: options.reportMode ?? 'success',
    finishReport: null, finishOrdinary: null, loading: false, retryWait: null,
    ordinaryOutcomes: [...(options.ordinaryOutcomes ?? [])], loadingChanges: [] };
  if (options.messages) state.messages = [...options.messages];
  const refs = Object.fromEntries(['inFlightRef', 'stopRequestedRef', 'abortRef', 'mountedRef', 'renderQueueRef',
    'retryRef', 'retryWaitDeadlineRef', 'pendingChatNavigationFocusRef'].map(name => [name, { current: null }]));
  refs.mountedRef.current = true;
  refs.retryWaitDeadlineRef.current = 0;
  const uiSettingsRef = { get current() { return state.uiSettings; } };
  const uiSettingChangesRef = { current: structuredClone(fixture.latest.uiSettingChanges) };
  const window = { location: { pathname: '/about-me' }, crypto: { randomUUID: () => 'settings-group-1' },
    localStorage: { setItem() {} }, setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {} };
  const response = (extra = {}) => ({ mode: 'model', status: 'online', generated: true, answer: '확인한 결과 보고',
    segments: [], actions: [], suggestedQuestions: [], audience: 'default', tone: 'official', pageContext: 'research',
    cached: false, toolExecutions: [], ...extra });
  const finalResponse = request => response({ toolTask: { ...fixture.scope, steps: fixture.steps, dispatchComplete: true,
    status: request.toolVerification.results.some(result => result.status === 'failed') ? 'failed' : 'completed' } });
  const send = async (request, signal, handlers) => {
    state.requests.push(request);
    if (options.ordinary) {
      const outcome = state.ordinaryOutcomes.shift();
      if (outcome?.wait) await new Promise(resolve => { state.finishOrdinary = resolve; });
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (outcome?.partial) handlers?.onDelta?.(outcome.partial);
      outcome?.beforeError?.({ state, refs, pending });
      if (outcome?.error) throw outcome.error;
      return parseChatResponse(response({ toolTask: { ...expectedToolTaskScope(request), steps: [],
        dispatchComplete: true, status: 'not_required' } }), request);
    }
    if (!request.toolVerification) {
      if (options.incompleteDispatch) {
        handlers?.onTool?.(fixture.executions[0]);
        handlers?.onTool?.(fixture.executions[1]);
        await Promise.resolve();
        throw new ChatApiError('fixture incomplete', { code: 'invalid_response' });
      }
      for (const item of fixture.executions) {
        handlers?.onTool?.(item);
        if (options.duplicateTools) handlers?.onTool?.(structuredClone(item));
      }
      return parseChatResponse(response({ toolExecutions: fixture.executions,
        toolTask: { ...fixture.scope, steps: fixture.steps, status: 'awaiting_browser', dispatchComplete: true },
        ...(options.missingHistory ? {} : { modelHistory: fixture.native }),
        toolFollowup: { explanationRequested: true, knowledgeRequested: false },
      }), request);
    }
    state.reportRequests.push(request);
    const mode = state.reportMode;
    if (mode === 'hold') {
      await new Promise(resolve => { state.finishReport = resolve; });
    } else if (mode === 'network' || mode === 'timeout') {
      throw new ChatApiError('PRIVATE transport text', { code: mode });
    } else if (mode === 'protocol') {
      handlers?.onDelta?.('UNVERIFIED_REPORT_TEXT');
      return parseChatResponse(finalResponse({ ...request }), { ...request,
        toolTask: { ...request.toolTask, taskId: 'different-task' } });
    } else if (mode === 'unexpected-tool') {
      handlers?.onDelta?.('UNVERIFIED_REPORT_TEXT');
      handlers?.onTool?.(fixture.executions[0]);
      return parseChatResponse(response({ toolExecutions: [fixture.executions[0]],
        toolTask: { ...fixture.scope, steps: fixture.steps, dispatchComplete: true, status: 'completed' } }), request);
    } else if (mode === 'malformed') {
      handlers?.onDelta?.('UNVERIFIED_REPORT_TEXT');
      return parseChatResponse({ invalid: true }, request);
    }
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const result = parseChatResponse(finalResponse(request), request);
    handlers?.onDelta?.(result.answer);
    return result;
  };
  let sequence = 0;
  const context = { ...refs, window, document: {}, process: { env: {} },
    useCallback: callback => callback, canRequest: () => options.canRequest ?? true,
    availability: options.availability ?? 'online', canSendUnverifiedExplanation, uiSettingsRef, uiSettingChangesRef,
    setMessages: update => { state.messages = update(state.messages); },
    setIsLoading: value => { state.loading = value; state.loadingChanges.push(value); }, setError() {},
    clearRetryWait: () => { state.retryWait = null; refs.retryWaitDeadlineRef.current = 0; },
    beginRetryWait: delay => { state.retryWait = delay; refs.retryWaitDeadlineRef.current = Date.now() + delay; },
    nextId: prefix => `${prefix}-${++sequence}`, audienceToApi: value => value,
    audience: 'default', tone: 'official', pageContext: 'overview', pathname: '/about-me', reasoningEnabled: false,
    ...{ mode: 'light', accent: 'royalblue', chatLayout: 'floating', chatFont: 'pretendard', chatFontSize: 'medium', streamAnimation: 'none' },
    streamingEnabled: options.streaming !== false,
    readPortfolioViewState: () => structuredClone(state.viewState), pageContextFromPathname: () => 'research',
    expectedToolTaskScope, stepFromExecution, ToolTaskProtocolError, ToolTaskRuntime, BrowserToolTaskTelemetry,
    requestToolTaskEvents: async body => { state.telemetry.push(body); },
    requestChat: (request, signal) => send(request, signal), requestChatStream: send,
    requestVerifiedToolResponse, toolFollowupForVerification, toolReportFailureCode,
    StreamRenderQueue: class { constructor(append) { this.append = append; } enqueue(text) { this.append(text); } cancel() {} async drain() {} },
    requiresBrowserToolVerification: item => item.toolTask.dispatchStatus === 'accepted',
    toolResultWatchersRef: { current: new Set() }, pendingChatNavigationFocusRef: { current: false },
    observeToolNavigation: () => ({ completion: Promise.resolve(options.failedTool === 'navigation' ? 'failed' : 'arrived'), cancel() {} }),
    pathWithoutHash: route => route.split('#')[0], CHAT_ACTION_TARGET_ARRIVED_EVENT: 'arrived',
    portfolioUiCommandFromChatExecution, executePortfolioUiTool: async command => {
      if (command.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      state.effects.push([command.name, structuredClone(command.input)]);
      if (command.name === 'set_portfolio_theme') state.uiSettings.theme = command.input.theme;
      if (command.name === 'set_portfolio_chat_font_size' && options.failedTool !== 'font') state.uiSettings.chatFontSize = command.input.size;
      if (command.name === 'control_portfolio_view') {
        state.viewState = structuredClone(fixture.latest.viewState);
        window.location.pathname = '/about-me/research';
        return { route: '/about-me/research#research-year-2025', label: '연구 2025' };
      }
      return { ok: true, status: 'applied', label: command.name };
    },
    waitForMinimumToolObservation: async (_started, signal) => { if (signal.aborted) throw new DOMException('Aborted', 'AbortError'); },
    waitForSettingApplied: async (read, expected) => read() === expected,
    settingToolResultLabel, appendUiSettingChange, createUiSettingChange, UI_SETTING_CHANGE_STORAGE_KEY: 'fixture',
    runAccentCycle: () => assert.fail('색상 순회는 이 fixture 범위가 아니다'),
    TOOL_VERIFICATION_MIN_DELAY_MS: 500, TOOL_ARRIVAL_TIMEOUT_MS: 8000,
    ChatApiError, failedChatMessage, messagesForChatRetry, chatFailureRetryAfterMs, nextChatToolTaskGeneration,
    chatRetryFailureKind, historyForCapacityRetry,
    logChatFailureLocally: (stage, error) => state.diagnostics.push([stage, toolReportFailureCode(error)]),
    chatFailureAvailability: () => null, reportAvailability() {},
    UI_TOOL_NOT_CALLED_RESULT: {}, UI_TOOL_INCOMPLETE_RESULT: {},
  };
  const api = new Function(...Object.keys(context), `${compiled}\nreturn { performRequestWithRecovery, retry };`)(...Object.values(context));
  t.after(() => { refs.abortRef.current?.abort(); state.finishReport?.(); state.finishOrdinary?.(); });
  return { ...fixture, state, refs, pending, run: () => {
    refs.retryRef.current = pending;
    return api.performRequestWithRecovery(pending);
  }, retry: api.retry,
    stop() { refs.stopRequestedRef.current = true; refs.abortRef.current?.abort(); },
    async untilRequest(count = 1) {
      for (let index = 0; index < 100; index++) {
        if (state.requests.length >= count) return;
        await Promise.resolve();
      }
      assert.fail('일반 요청까지 도달하지 못했다');
    },
    async untilReport(count = 1) {
      for (let index = 0; index < 100; index++) {
        if (state.reportRequests.length >= count) return;
        await Promise.resolve();
      }
      assert.fail('보고 요청까지 도달하지 못했다');
    },
  };
}
