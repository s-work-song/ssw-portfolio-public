import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  CHAT_FAILURE_NOTICE,
  chatFailureRetryAfterMs,
  chatRetryWaitSeconds,
  failedChatMessage,
  isLocalChatDiagnosticHost,
  logChatFailureLocally,
  messagesForChatRetry,
  visibleChatMessages,
} from './chatFailure.ts';
import { historyFromMessages } from './chatHistory.ts';
import { ChatApiError } from './parse.ts';
import { requestVerifiedToolResponse } from './toolVerificationRequest.ts';
import { toolResultDisplayStatus, toolResultText } from './toolResultPresentation.ts';
import { CHAT_QUICK_START_OPTION_BY_ACTION_ID } from './constants.ts';
import { fourToolReportCase, providerReportFixture } from './toolReportFixtures.mjs';
import { ToolReportPreparationError, hasVerifiedToolCompletion, messageToolReportState,
  toolReportFailureCode, toolReportFailureNotice } from './toolReport.ts';
import { ToolTaskProtocolError } from './toolTaskRuntime.ts';

const message = (id, role, content, extra = {}) => ({
  id, role, content, kind: 'message', ...extra,
});

test('실패 표시에는 고정 안내만 쓰고 오류 원문·별도 설명을 렌더하지 않는다', () => {
  const failed = failedChatMessage(message('a', 'assistant', '정상 부분 답변', {
    errorMessage: 'secret backend stack',
    segments: [{ markdown: '기술 오류', actions: [] }],
    actions: [{ id: 'resume', label: '이력서' }],
    suggestedQuestions: ['실패 후 추천 질문'],
  }), false);
  assert.equal(failed.content, '정상 부분 답변');
  assert.equal(failed.generationState, 'failed');
  assert.equal(failed.errorMessage, undefined);
  assert.equal(failed.segments, undefined);
  assert.equal(failed.actions, undefined);
  assert.equal(failed.suggestedQuestions, undefined);
  assert.equal(CHAT_FAILURE_NOTICE, '응답 생성을 완료하지 못했어요. 다시 시도해 주세요.');
  assert.deepEqual(visibleChatMessages([
    failed, message('old', 'assistant', '구형 서버 explanation', { kind: 'failure_explanation' }),
  ]), [failed]);

  // 표현 컴포넌트의 실제 DOM 경로가 안전한 상수를 사용하는지 함께 확인한다.
  const item = readFileSync(new URL('./MessageItem.tsx', import.meta.url), 'utf8');
  assert.ok(item.includes(': CHAT_FAILURE_NOTICE}</p>'));
  assert.ok(item.includes('message.retryAllowed === false'));
  assert.equal(item.includes('{message.errorMessage}'), false);
  const provider = readFileSync(new URL('./ChatProvider.tsx', import.meta.url), 'utf8');
  assert.equal(provider.includes('requestError.message'), false);
  assert.equal(provider.includes('requestError.explanation'), false);
  assert.equal(provider.includes('explanationMessageId'), false);
});

test('실패 시 실행 전 본문은 버리고 도구의 성공·실패 상태는 그대로 유지한다', () => {
  const toolResults = [
    { callId: 't1', tool: 'set_portfolio_theme', label: '다크 모드', status: 'applied' },
    { callId: 't2', tool: 'control_portfolio_view', label: '이력서', status: 'failed' },
  ];
  const failed = failedChatMessage(message('a', 'assistant', '모든 작업 완료!', { toolResults }), true);
  assert.equal(failed.content, '');
  assert.equal(failed.generationState, 'failed');
  assert.deepEqual(failed.toolResults, toolResults);
  assert.equal(toolResults[1].status, 'failed');
});

test('중단 메시지의 started 도구만 중단으로 표시하고 실제 완료·실패 결과와 원본은 보존한다', () => {
  for (const status of ['started', 'arrived', 'applied', 'failed']) {
    const result = Object.freeze({ callId: status, tool: 'control_portfolio_view', label: '연구 2025년', status });
    assert.equal(toolResultText(result, 'stopped'), status === 'started'
      ? '도구 호출 중단 · 연구 2025년' : toolResultText(result));
    assert.equal(toolResultDisplayStatus(result, 'stopped'), status === 'started' ? 'stopped' : status);
    assert.equal(result.status, status);
  }
  const started = { status: 'started', label: '연구 2025년' };
  assert.equal(toolResultText(started, 'streaming'), '도구 호출 중…');
  assert.equal(toolResultText(started), '도구 호출 중…');
});

test('tool 뒤 done 없는 스트림 실패는 대기 실행을 중단하고 부분 관측을 재실행 요청으로 바꾸지 않는다', () => {
  const provider = readFileSync(new URL('./ChatProvider.tsx', import.meta.url), 'utf8');
  const failure = provider.slice(
    provider.indexOf('} catch (requestError) {'),
    provider.indexOf('const failureAvailability ='),
  );
  const queueWait = failure.indexOf('await toolExecutionQueue');
  const cancelIncomplete = failure.indexOf('!taskRuntime?.dispatchComplete)) controller.abort()');
  assert.ok(cancelIncomplete >= 0 && cancelIncomplete < queueWait);
  assert.equal(failure.includes('pending.toolVerification = {'), false);
  assert.ok(failure.includes('Boolean(pending.toolReportRequest && pending.toolVerification && pending.toolTask.dispatchComplete)'));
  assert.ok(failure.includes('taskRuntime.mutationDispatchCount === 0 && taskRuntime.steps.length === 0'));
  assert.ok(failure.includes('pending.toolResults = [...toolResults.values()]'));
});

test('상태 전용 완료는 실제 결과 칩만 남기고 설명 요청일 때만 verification-only 재시도에 진입한다', async () => {
  const provider = readFileSync(new URL('./ChatProvider.tsx', import.meta.url), 'utf8');
  const guard = provider.slice(provider.indexOf('if (response.mode === "tool_status")'),
    provider.indexOf('if (!isRequestActive())', provider.indexOf('if (response.mode === "tool_status")')));
  assert.ok(guard.includes('!pending.toolVerification?.results.length || toolResults.size === 0'));
  assert.ok(guard.includes('pending.toolVerification.explanationRequested === true'));
  assert.ok(guard.includes('renderQueue?.cancel()'));
  assert.ok(guard.includes('deferStreamDeltas = true'));
  assert.equal(guard.includes('handleToolExecution('), false);
  assert.ok(provider.includes('pending.toolVerification = verificationRequest.toolVerification'));
  assert.ok(provider.includes('pending.toolResults = [...toolResults.values()]'));
  const streamingMessage = provider.slice(provider.indexOf('streamingMessageId = nextId("assistant")'),
    provider.indexOf('let renderQueue = shouldStream'));
  assert.ok(streamingMessage.includes('toolResults: [...toolResults.values()]'));
  const item = readFileSync(new URL('./MessageItem.tsx', import.meta.url), 'utf8');
  assert.ok(item.includes('const isToolStatusOnly = message.kind === "tool_status"'));
  assert.ok(item.includes('{isToolStatusOnly ? null : isIncompleteAnswer ? ('));
  assert.ok(item.includes('const summaryActions = isToolStatusOnly ? [] :'));
  assert.ok(item.includes('!isToolStatusOnly && suggestedQuestions.length > 0'));
  // Provider의 실제 완료 분기를 실행해 단순 변경과 설명 실패를 구분한다.
  const finish = new Function('response', 'pending', 'toolResults', 'renderQueue', 'ChatApiError',
    `return (async () => { let deferStreamDeltas = false; ${guard} return deferStreamDeltas; })();`);
  const results = [{ toolCallId: 'theme-1', toolName: 'set_portfolio_theme', status: 'applied', elapsedMs: 500 }];
  const toolResults = new Map([['theme-1', { callId: 'theme-1', status: 'applied' }]]);
  let cancelled = 0;
  let drained = 0;
  const queue = { cancel() { cancelled++; }, async drain() { drained++; } };
  const pending = { toolVerification: { results, explanationRequested: false }, toolResults: [...toolResults.values()] };
  assert.equal(await finish({ mode: 'tool_status' }, pending, toolResults, queue, ChatApiError), true);
  assert.equal(cancelled, 1);
  assert.equal(drained, 0);
  const explanationPending = { ...pending, toolVerification: { results, explanationRequested: true } };
  await assert.rejects(finish({ mode: 'tool_status' }, explanationPending, toolResults, queue, ChatApiError),
    (error) => error instanceof ChatApiError && error.code === 'empty_answer');
  assert.equal(explanationPending.toolVerification.explanationRequested, true);
  assert.equal(explanationPending.toolResults[0].status, 'applied');
  await assert.rejects(finish({ mode: 'tool_status' }, {}, toolResults, queue, ChatApiError), ChatApiError);
  await assert.rejects(finish({ mode: 'tool_status' }, pending, new Map(), queue, ChatApiError), ChatApiError);
  assert.equal(await finish({ mode: 'model' }, explanationPending, toolResults, queue, ChatApiError), false);
  assert.equal(drained, 1);
});

test('실제 MessageItem 렌더: 상태 전용 완료에는 칩만 있고 빈 Markdown·문단·오류·버튼·하단 공백이 없다', () => {
  const require = createRequire(import.meta.url);
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const ts = require('typescript');
  const source = readFileSync(new URL('./MessageItem.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const componentModule = { exports: {} };
  const localRequire = (name) => {
    if (name === './ChatWidget.module.css') return { __esModule: true,
      default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (name === './constants') return { CHAT_QUICK_START_OPTION_BY_ACTION_ID: new Map() };
    if (name === './StreamingText') return { StreamingText: ({ text }) => text };
    if (name === './toolResultPresentation') return { toolResultDisplayStatus, toolResultText };
    if (name === './chatFailure') return { CHAT_FAILURE_NOTICE };
    return require(name);
  };
  // 실제 TSX를 실행하되 CSS와 이 테스트에서 쓰지 않는 외부 연출만 대체한다.
  new Function('require', 'module', 'exports', compiled)(localRequire, componentModule, componentModule.exports);
  const props = {
    activeQuickDestination: null, streamAnimation: 'none', includeComplement: true,
    suggestedQuestions: ['이어서 설명해 줘'], revealCompletionControls: true,
    slowResponse: false, canRetry: true, retryWaitSeconds: 0,
    onActivateAction() {}, onAskSuggestedQuestion() {}, onRetry() {},
  };
  const chip = { callId: 'theme-1', tool: 'set_portfolio_theme', label: '화면 모드 변경(다크)', status: 'applied' };
  const html = renderToStaticMarkup(React.createElement(componentModule.exports.MessageItem, {
    ...props, message: message('a', 'assistant', '', {
      kind: 'tool_status', generationState: 'complete', segments: [], toolResults: [chip],
    }),
  }));
  assert.equal(html, '<article class="message assistantMessage"><div class="toolResults" style="margin-bottom:0" role="status" aria-label="화면 도구 실행 결과"><span class="toolResult" data-tool-status="applied">도구 호출 · 화면 모드 변경(다크)</span></div></article>');
  const normal = renderToStaticMarkup(React.createElement(componentModule.exports.MessageItem, {
    ...props, suggestedQuestions: [], includeComplement: false,
    message: message('b', 'assistant', '모델이 만든 자연어 설명', { generationState: 'complete', toolResults: [chip] }),
  }));
  assert.ok(normal.includes('모델이 만든 자연어 설명'));
  assert.ok(normal.includes('class="markdownMessage"'));
  const failed = renderToStaticMarkup(React.createElement(componentModule.exports.MessageItem, {
    ...props, suggestedQuestions: [], message: failedChatMessage(message('c', 'assistant', '', { toolResults: [chip] }), true),
  }));
  assert.ok(failed.includes('data-tool-status="applied"'));
  assert.ok(failed.includes(CHAT_FAILURE_NOTICE));
  assert.ok(failed.includes('다시 시도'));
  const mixedResults = Object.freeze(['started', 'arrived', 'applied', 'failed'].map(status =>
    Object.freeze({ callId: status, tool: 'control_portfolio_view', label: `${status} 작업`, status })));
  const stopped = renderToStaticMarkup(React.createElement(componentModule.exports.MessageItem, {
    ...props, suggestedQuestions: [], message: message('stopped', 'assistant', '', {
      generationState: 'stopped', toolResults: mixedResults,
    }),
  }));
  assert.ok(stopped.includes('응답 생성이 중단되었습니다'));
  assert.ok(stopped.includes('data-tool-status="stopped">도구 호출 중단 · started 작업'));
  assert.equal(stopped.includes('도구 호출 중…'), false);
  assert.equal(stopped.includes('data-tool-status="started"'), false);
  for (const status of ['arrived', 'applied', 'failed']) assert.ok(stopped.includes(`data-tool-status="${status}"`));
  assert.deepEqual(mixedResults.map(result => result.status), ['started', 'arrived', 'applied', 'failed']);

  const four = fourToolReportCase();
  const progress = { scope: four.scope, status: 'completed', dispatchComplete: true,
    steps: four.steps.map((step, index) => ({ ...step, state: four.results[index].status })) };
  const chips = four.results.map(result => ({ callId: result.toolCallId, tool: result.toolName,
    label: result.toolName, status: result.status }));
  const base = message('report', 'assistant', '', { generationState: 'failed', toolTaskProgress: progress, toolResults: chips });
  const renderReport = value => renderToStaticMarkup(React.createElement(componentModule.exports.MessageItem,
    { ...props, suggestedQuestions: [], includeComplement: false, canRetry: value.retryAllowed === true, message: value }));
  for (const extra of [
    { toolReportState: 'failed', toolReportFailure: 'timeout', retryAllowed: true },
    { toolReportState: 'failed', toolReportFailure: 'history_budget', retryAllowed: false },
    { retryAllowed: false },
  ]) {
    const html = renderReport({ ...base, ...extra });
    assert.ok(html.includes('마지막 결과 보고를 완료하지 못했습니다'));
    assert.ok(html.includes('도구 작업 완료 · 4/4단계 확인'));
    assert.ok(html.includes('요청한 화면 변경은 모두 확인됐어요'));
    assert.ok(html.includes('이미 반영된 변경은 다시 실행하지 않습니다'));
    assert.equal(html.includes('작업을 완료하지 못했어요'), false);
    assert.equal(html.includes('필요한 작업을 새 질문으로'), false);
    assert.equal(html.includes('<button'), extra.retryAllowed === true);
    if (extra.retryAllowed) assert.ok(html.includes('결과 보고 다시 시도'));
    if (extra.toolReportFailure === 'history_budget') assert.ok(html.includes('보고용으로 준비하지 못했습니다'));
  }
  const partialProgress = structuredClone(progress);
  partialProgress.status = 'failed';
  partialProgress.steps.at(-1).state = 'failed';
  const partial = renderReport({ ...base, toolTaskProgress: partialProgress, toolReportState: 'failed', retryAllowed: true,
    toolResults: chips.map((chip, index) => index === 3 ? { ...chip, status: 'failed' } : chip) });
  assert.ok(partial.includes('일부 작업은 완료를 확인하지 못했어요'));
  assert.ok(partial.includes('도구 작업 확인 실패 · 3/4단계 확인'));
  assert.equal(partial.includes('화면 변경은 모두 확인'), false);
  const reportStopped = renderReport({ ...base, generationState: 'stopped', toolReportState: 'stopped', retryAllowed: false });
  assert.ok(reportStopped.includes('마지막 결과 보고가 중단되었습니다'));
  assert.ok(reportStopped.includes('도구 작업 완료 · 4/4단계 확인'));
});

test('추천 생략 말풍선은 문단·하단·빠른 시작 보완·후속 질문만 숨기고 모델 본문·결과 칩은 보존한다', () => {
  const require = createRequire(import.meta.url);
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const ts = require('typescript');
  const source = readFileSync(new URL('./MessageItem.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const componentModule = { exports: {} };
  const localRequire = name => {
    if (name === './ChatWidget.module.css') return { __esModule: true,
      default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (name === './constants') return { CHAT_QUICK_START_OPTION_BY_ACTION_ID };
    if (name === './StreamingText') return { StreamingText: ({ text }) => text };
    if (name === './toolResultPresentation') return { toolResultDisplayStatus, toolResultText };
    if (name === './chatFailure') return { CHAT_FAILURE_NOTICE };
    return require(name);
  };
  new Function('require', 'module', 'exports', compiled)(localRequire, componentModule, componentModule.exports);
  const { MessageItem, summaryActionsForMessage } = componentModule.exports;
  const activeQuickDestination = 'project_overview';
  const chip = { callId: 'theme-1', tool: 'set_portfolio_theme', label: '화면 모드 변경(다크)', status: 'applied' };
  const props = {
    activeQuickDestination, streamAnimation: 'none', includeComplement: true,
    suggestedQuestions: ['서버가 제안한 후속 질문'], revealCompletionControls: true,
    slowResponse: false, canRetry: false, retryWaitSeconds: 0,
    onActivateAction() {}, onAskSuggestedQuestion() {}, onRetry() {},
  };
  for (const serverActions of [false, true]) {
    const base = message('answer-1', 'assistant', '모델이 만든 현재 시간 답변', {
      generationState: 'complete', toolResults: [chip],
      actions: serverActions ? [{ id: 'settings', label: '하단 추천' }] : [],
      segments: [{ markdown: '모델이 만든 현재 시간 답변',
        actions: serverActions ? [{ id: 'resume', label: '문단 추천' }] : [] }],
    });
    const suppressed = { ...base, recommendationsSuppressed: true };
    assert.deepEqual(summaryActionsForMessage(suppressed, activeQuickDestination, true), []);
    const html = renderToStaticMarkup(React.createElement(MessageItem, { ...props, message: suppressed }));
    assert.ok(html.includes('모델이 만든 현재 시간 답변'));
    assert.ok(html.includes('data-tool-status="applied"'));
    assert.equal(html.includes('<nav'), false);
    assert.equal(html.includes('<button'), false);
    for (const flag of [undefined, false]) {
      const ordinary = { ...base, ...(flag === false ? { recommendationsSuppressed: false } : {}) };
      const normal = renderToStaticMarkup(React.createElement(MessageItem, { ...props, message: ordinary }));
      assert.ok(normal.includes('aria-label="관련 페이지"'));
      assert.ok(normal.includes('aria-label="이어서 물어볼 질문"'));
      assert.ok(summaryActionsForMessage(ordinary, activeQuickDestination, true)
        .some(action => action.id === 'research_optimization'));
      if (serverActions) {
        assert.ok(normal.includes('문단 추천'));
        assert.ok(normal.includes('하단 추천'));
      }
    }
  }
});

test('로컬 진단은 정확한 루프백 hostname 네 개에서만 허용한다', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]', '::1']) {
    assert.equal(isLocalChatDiagnosticHost(host), true, host);
  }
  for (const host of ['', '192.168.0.12', '172.16.0.4', '10.0.0.1',
    'localhost.evil', 'dev.localhost', 'example.com', '127.0.0.2', 'localhost:3000']) {
    assert.equal(isLocalChatDiagnosticHost(host), false, host);
    const calls = [];
    logChatFailureLocally('request', new Error('secret'), host, (...args) => calls.push(args));
    assert.deepEqual(calls, []);
  }
});

test('localhost 로그도 원문·설명·Error·질문·요청·스택을 포함하지 않는다', () => {
  const error = new ChatApiError('secret question and backend stack', {
    code: 'tool_call_failed', explanation: 'secret reasoning', retryAfterMs: 10_000,
  });
  error.headers = { Authorization: 'secret' };
  error.request = { history: 'secret', body: 'secret' };
  const calls = [];
  logChatFailureLocally('request', error, 'localhost', (...args) => calls.push(args));
  assert.deepEqual(calls, [['채팅 진단', {
    stage: 'request', type: 'ChatApiError', code: 'tool_call_failed', retryAfterMs: 10_000,
  }]]);
  assert.equal(JSON.stringify(calls).includes('secret'), false);
  logChatFailureLocally('tool', new Error('secret'), '::1', (...args) => calls.push(args));
  assert.deepEqual(calls[1], ['채팅 진단', { stage: 'tool', type: 'unknown' }]);
  logChatFailureLocally('request', new ChatApiError('secret', { code: 'secret_token' }),
    '127.0.0.1', (...args) => calls.push(args));
  assert.equal(calls[2][1].code, 'unknown');
});

test('브라우저 없는 SSR에서는 진단이 출력되지 않고 window도 요구하지 않는다', () => {
  assert.equal(typeof window, 'undefined');
  const calls = [];
  logChatFailureLocally('request', new Error('secret'), undefined, (...args) => calls.push(args));
  assert.deepEqual(calls, []);
});

test('429 재시도 대기값을 오류 문구 없이 보존하고 만료될 때 잠금을 해제한다', () => {
  const error = new ChatApiError('raw 429', { code: 'rate_limited', retryAfterMs: 10_000 });
  assert.equal(chatFailureRetryAfterMs(error), 10_000);
  assert.equal(chatRetryWaitSeconds(20_000, 10_000), 10);
  assert.equal(chatRetryWaitSeconds(20_000, 19_999), 1);
  assert.equal(chatRetryWaitSeconds(20_000, 20_000), 0);
  assert.equal(chatRetryWaitSeconds(20_000, 20_100), 0);
  for (const invalid of [undefined, -1, NaN, Infinity]) {
    assert.equal(chatFailureRetryAfterMs(new ChatApiError('raw', { retryAfterMs: invalid })), 0);
  }
  assert.equal(chatFailureRetryAfterMs(new Error('raw')), 0);
});

test('실패 질문·답변·설명과 중단/스트리밍 답변은 다음 모델 이력에서 제외한다', () => {
  const messages = [
    message('g', 'assistant', '인사', { kind: 'greeting' }),
    message('u1', 'user', '정상 질문'),
    message('a1', 'assistant', '정상 답변', { generationState: 'complete' }),
    message('u2', 'user', '실패한 질문'),
    failedChatMessage(message('a2', 'assistant', '실패한 부분'), false),
    message('e', 'assistant', '백엔드 설명', { kind: 'failure_explanation', generationState: 'complete' }),
    message('u3', 'user', '중단한 질문'),
    message('a3', 'assistant', '중단한 부분', { generationState: 'stopped' }),
    message('a4', 'assistant', '생성 중 부분', { generationState: 'streaming' }),
  ];
  assert.deepEqual(historyFromMessages(messages), [
    { role: 'user', content: '정상 질문' }, { role: 'assistant', content: '정상 답변' },
    // 사용자가 중단한 질문은 기존 계약대로 보존하되 중단된 답변만 제외한다.
    { role: 'user', content: '중단한 질문' },
  ]);
});

test('일반 대화의 최근 다섯 USER 턴과 12000자 상한을 유지한다', () => {
  const messages = Array.from({ length: 6 }, (_, n) => [
    message(`u${n}`, 'user', `질문${n}`),
    message(`a${n}`, 'assistant', `답변${n}`, { generationState: 'complete' }),
  ]).flat();
  assert.deepEqual(historyFromMessages(messages), messages.slice(2).map(({ role, content }) => ({ role, content })));
  assert.equal(historyFromMessages(messages).length, 10);
  assert.deepEqual(historyFromMessages([message('big', 'user', 'x'.repeat(12_001))]), []);
});

test('재시도는 실패 답변과 구형 설명만 지우고 원래 질문·완료 답변을 보존한다', () => {
  const completed = message('a1', 'assistant', '앞 답변', { generationState: 'complete' });
  const question = message('u2', 'user', '재시도할 질문');
  const failed = failedChatMessage(message('a2', 'assistant', '실패한 부분'), false);
  assert.deepEqual(messagesForChatRetry([completed, question, failed,
    message('e', 'assistant', '구형 explanation', { kind: 'failure_explanation' }),
  ], failed.id), [completed, question]);
});

const initialRequest = () => ({
  conversationId: 'c-1', turnId: 't-1',
  message: '다크 모드로 바꾸고 이력서로 이동해 줘', history: [{ role: 'user', content: '앞 질문' }],
  audience: 'default', tone: 'official', pageContext: 'overview', reasoningEnabled: true,
  uiSettings: { theme: 'light' }, uiSettingChanges: [], viewState: { page: 'overview' },
});
const finalResponse = { toolExecutions: [], answer: '현재 상태에 따른 최종 답변' };

test('도구 실행이 끝날 때까지 기다린 뒤 최신 페이지·설정으로 최종 답변을 요청한다', async () => {
  let finishTools;
  const completion = new Promise((resolve) => { finishTools = resolve; });
  const latestChanges = [
    { toolCallId: 'old-theme', groupId: 'old-theme', toolName: 'set_portfolio_theme', before: 'light', after: 'dark' },
    { toolCallId: 'old-size', groupId: 'old-size', toolName: 'set_portfolio_chat_font_size', before: 'medium', after: 'xlarge' },
  ];
  let snapshot = { pageContext: 'overview', uiSettings: { theme: 'light' },
    uiSettingChanges: [], viewState: { page: 'overview' } };
  const events = [];
  const original = initialRequest();
  const results = [{ toolCallId: 't1', toolName: 'set_portfolio_theme', status: 'applied', elapsedMs: 500 },
    { toolCallId: 't2', toolName: 'control_portfolio_view', status: 'failed', elapsedMs: 500 }];
  const pending = requestVerifiedToolResponse(completion, original, results,
    () => { events.push('read'); return snapshot; },
    async (request) => { events.push('send');
      assert.equal(request.message, original.message);
      assert.equal(request.conversationId, original.conversationId);
      assert.equal(request.turnId, original.turnId);
      assert.deepEqual(request.history, original.history);
      assert.equal(request.reasoningEnabled, false);
      assert.equal(request.pageContext, 'resume');
      assert.equal(request.uiSettings.theme, 'dark');
      assert.deepEqual(request.uiSettingChanges, latestChanges);
      assert.equal(request.viewState.page, 'resume');
      assert.deepEqual(request.toolVerification.results, results);
      assert.equal(request.toolVerification.explanationRequested, false);
      return finalResponse;
    }, new AbortController().signal);
  await Promise.resolve();
  assert.deepEqual(events, []);
  snapshot = { pageContext: 'resume', uiSettings: { theme: 'dark' },
    uiSettingChanges: latestChanges, viewState: { page: 'resume' } };
  finishTools();
  assert.equal(await pending, finalResponse);
  assert.deepEqual(events, ['read', 'send']);
});

test('도구 후속 응답은 새 tool call을 거부하고 실패를 성공으로 바꾸지 않는다', async () => {
  await assert.rejects(requestVerifiedToolResponse(Promise.resolve(), initialRequest(), [],
    () => ({}), async () => ({ ...finalResponse, toolExecutions: [{ toolName: 'set_portfolio_theme' }] }),
    new AbortController().signal), ChatApiError);
  const failure = new ChatApiError('원문 기술 오류', { explanation: '추가 설명' });
  await assert.rejects(requestVerifiedToolResponse(Promise.resolve(), initialRequest(), [],
    () => ({}), async () => { throw failure; }, new AbortController().signal),
    (error) => error === failure);
});

test('중단되었거나 도구 완료 큐가 실패한 경우 페이지 재조회와 후속 요청을 하지 않는다', async () => {
  const controller = new AbortController();
  controller.abort();
  const forbidden = () => { assert.fail('상태 재조회/요청이 실행되면 안 된다'); };
  await assert.rejects(requestVerifiedToolResponse(Promise.resolve(), initialRequest(), [],
    forbidden, forbidden, controller.signal), (error) => error.name === 'AbortError');
  await assert.rejects(requestVerifiedToolResponse(Promise.reject(new Error('도구 실패')), initialRequest(), [],
    forbidden, forbidden, new AbortController().signal), /도구 실패/);
});

test('실제 Provider: 4개 반영 뒤 전송·시간초과·응답계약 실패는 동일 불변 보고만 재시도하고 도구를 재실행하지 않는다', async t => {
  for (const streaming of [true, false]) {
    for (const reportMode of ['network', 'timeout', 'protocol', 'malformed', 'unexpected-tool']) {
      await t.test(`${streaming ? 'SSE' : 'JSON'} ${reportMode}`, async t => {
        const f = providerReportFixture(t, { streaming, reportMode, duplicateTools: true });
        await f.run();
        const failed = f.state.messages.at(-1);
        assert.equal(failed.generationState, 'failed');
        assert.equal(failed.toolReportState, 'failed');
        assert.equal(failed.toolTaskProgress.status, 'completed');
        assert.equal(hasVerifiedToolCompletion(failed.toolTaskProgress), true);
        assert.equal(failed.retryAllowed, true);
        assert.equal(failed.toolReportFailure, reportMode === 'timeout' ? 'timeout'
          : reportMode === 'network' ? 'request_failed' : 'response_contract');
        assert.equal(failed.content.includes('UNVERIFIED_REPORT_TEXT'), false);
        assert.equal(f.state.effects.length, 4);
        assert.equal(f.state.requests.length, 2, '자동 보고 재시도는 하지 않는다');
        const prepared = f.state.reportRequests[0];
        const snapshot = JSON.stringify(prepared);
        f.state.uiSettings.theme = 'light';
        f.state.viewState.page = 'settings';
        f.pending.history[0].content = '나중 질문으로 바뀌어도 재시도는 스냅숏 유지';
        f.state.reportMode = 'success';
        await f.retry();
        assert.equal(f.state.effects.length, 4);
        assert.equal(f.state.reportRequests.length, 2);
        assert.equal(f.state.reportRequests[1], prepared);
        assert.equal(JSON.stringify(f.state.reportRequests[1]), snapshot);
        assert.equal(prepared.toolTask.taskId, f.scope.taskId);
        assert.equal(prepared.toolTask.generation, 1);
        assert.equal(prepared.conversationId, f.scope.conversationId);
        assert.equal(prepared.turnId, f.scope.turnId);
        const completed = f.state.messages.at(-1);
        assert.equal(completed.generationState, 'complete');
        assert.equal(completed.toolReportState, 'complete');
        assert.equal(completed.toolTaskProgress.status, 'completed');
        assert.deepEqual(completed.toolResults, failed.toolResults);
        await f.pending.toolTaskTelemetry.flush();
        const terminal = f.state.telemetry.flatMap(batch => batch.events).filter(event => event.kind === 'task');
        assert.deepEqual(terminal.map(event => event.status), ['completed']);
      });
    }
  }
});

test('실제 Provider: 완료된 4단계의 native 준비 실패는 실행 완료를 유지하되 재전송하지 않는다', async t => {
  const f = providerReportFixture(t, { missingHistory: true });
  await f.run();
  const failed = f.state.messages.at(-1);
  assert.equal(f.state.effects.length, 4);
  assert.equal(f.state.requests.length, 1);
  assert.equal(f.state.reportRequests.length, 0);
  assert.equal(failed.toolTaskProgress.status, 'completed');
  assert.equal(failed.toolReportState, 'failed');
  assert.equal(failed.toolReportFailure, 'history_invalid');
  assert.equal(failed.retryAllowed, false);
  assert.match(toolReportFailureNotice(failed), /화면 변경은 모두 확인/);
  assert.match(toolReportFailureNotice(failed), /보고용으로 준비하지 못/);
  await f.retry();
  assert.equal(f.state.effects.length, 4);
  assert.equal(f.state.requests.length, 1);
});

test('실제 Provider: 일부 도구 실패와 미완결 dispatch는 전체 성공으로 표시하거나 실행 재시도로 승격하지 않는다', async t => {
  await t.test('일부 반영 실패 뒤 보고 실패·복구', async t => {
    const f = providerReportFixture(t, { failedTool: 'font', reportMode: 'network' });
    await f.run();
    const failed = f.state.messages.at(-1);
    assert.equal(failed.toolTaskProgress.status, 'failed');
    assert.equal(failed.toolTaskProgress.steps.at(-1).state, 'failed');
    assert.equal(failed.toolReportState, 'failed');
    assert.equal(hasVerifiedToolCompletion(failed.toolTaskProgress), false);
    assert.doesNotMatch(toolReportFailureNotice(failed), /모두 확인/);
    f.state.reportMode = 'success';
    await f.retry();
    assert.equal(f.state.effects.length, 4);
    assert.equal(f.state.messages.at(-1).generationState, 'complete');
    assert.equal(f.state.messages.at(-1).toolTaskProgress.status, 'failed');
  });
  await t.test('done 없는 부분 발행', async t => {
    const f = providerReportFixture(t, { incompleteDispatch: true });
    await f.run();
    const failed = f.state.messages.at(-1);
    assert.equal(failed.toolTaskProgress.dispatchComplete, false);
    assert.equal(failed.toolTaskProgress.status, 'failed');
    assert.equal(failed.retryAllowed, false);
    assert.equal(messageToolReportState(failed), undefined);
    assert.equal(f.state.reportRequests.length, 0);
    const effects = f.state.effects.length;
    await f.retry();
    assert.equal(f.state.effects.length, effects);
    assert.equal(f.state.requests.length, 1);
  });
});

test('실제 Provider: 보고 중 중단·중복 클릭·새 대화는 도구 재실행이나 늦은 답변 반영을 만들지 않는다', async t => {
  await t.test('보고 중 사용자 중단', async t => {
    const f = providerReportFixture(t, { reportMode: 'hold' });
    const running = f.run();
    await f.untilReport();
    f.stop();
    f.state.finishReport();
    await running;
    const stopped = f.state.messages.at(-1);
    assert.equal(stopped.toolTaskProgress.status, 'completed');
    assert.equal(stopped.toolReportState, 'stopped');
    assert.equal(stopped.generationState, 'stopped');
    assert.equal(stopped.retryAllowed, false);
    await f.retry();
    assert.equal(f.state.effects.length, 4);
    assert.equal(f.state.requests.length, 2);
  });
  await t.test('보고 재시도 버튼 연타', async t => {
    const f = providerReportFixture(t, { reportMode: 'network' });
    await f.run();
    f.state.reportMode = 'hold';
    const retrying = f.retry();
    await f.untilReport(2);
    await f.retry();
    assert.equal(f.state.reportRequests.length, 2);
    f.state.finishReport();
    await retrying;
    assert.equal(f.state.messages.at(-1).toolReportState, 'complete');
    assert.equal(f.state.effects.length, 4);
  });
  await t.test('새 대화 뒤 늦은 이전 보고', async t => {
    const f = providerReportFixture(t, { reportMode: 'hold' });
    const running = f.run();
    await f.untilReport();
    f.refs.abortRef.current = new AbortController();
    f.state.messages = [];
    f.state.finishReport();
    await running;
    assert.deepEqual(f.state.messages, []);
    assert.equal(f.state.effects.length, 4);
  });
});

test('구형 완료4/4+실패 말풍선도 실제 완료를 부정하지 않고 불완전·실패·getter는 성공으로 승격하지 않는다', () => {
  const f = fourToolReportCase();
  const progress = { scope: f.scope, status: 'completed', dispatchComplete: true,
    steps: f.steps.map((step, index) => ({ ...step, state: f.results[index].status })) };
  const old = message('legacy', 'assistant', '', { generationState: 'failed', retryAllowed: false, toolTaskProgress: progress });
  assert.equal(messageToolReportState(old), 'failed');
  assert.match(toolReportFailureNotice(old), /화면 변경은 모두 확인/);
  assert.doesNotMatch(toolReportFailureNotice(old), /작업을 완료하지 못|새 질문으로 요청/);
  for (const change of [task => { task.dispatchComplete = false; }, task => { task.status = 'failed'; },
    task => { task.steps[3].state = 'failed'; }, task => { task.steps[3].state = 'running'; },
    task => { task.steps[3].stepIndex = 9; }, task => { task.steps = []; }]) {
    const task = structuredClone(progress); change(task);
    assert.equal(messageToolReportState({ ...old, toolTaskProgress: task }), undefined);
  }
});

test('보고 준비·전송·응답 실패 진단은 고정 코드만 남기고 비밀·원문을 출력하지 않는다', () => {
  const errors = [new ToolReportPreparationError('history_budget'), new ToolReportPreparationError('history_invalid'),
    new ToolReportPreparationError('manifest_mismatch'), new ChatApiError('PRIVATE', { code: 'timeout' }),
    new ToolTaskProtocolError(), new ChatApiError('PRIVATE', { code: 'invalid_response' }), new Error('PRIVATE')];
  const expected = ['history_budget', 'history_invalid', 'manifest_mismatch', 'timeout', 'response_contract', 'response_contract', 'request_failed'];
  errors.forEach((error, index) => {
    error.message = 'PRIVATE question token stack';
    error.request = { Authorization: 'PRIVATE' };
    const calls = [];
    logChatFailureLocally('tool_report', error, 'localhost', (...args) => calls.push(args));
    assert.equal(toolReportFailureCode(error), expected[index]);
    assert.equal(calls[0][1].reportFailure, expected[index]);
    assert.equal(JSON.stringify(calls).includes('PRIVATE'), false);
  });
});
