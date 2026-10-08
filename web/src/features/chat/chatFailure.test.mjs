import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
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
  assert.ok(item.includes('<p>{CHAT_FAILURE_NOTICE}</p>'));
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
      assert.equal(request.viewState.page, 'resume');
      assert.deepEqual(request.toolVerification.results, results);
      return finalResponse;
    }, new AbortController().signal);
  await Promise.resolve();
  assert.deepEqual(events, []);
  snapshot = { pageContext: 'resume', uiSettings: { theme: 'dark' },
    uiSettingChanges: [], viewState: { page: 'resume' } };
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
