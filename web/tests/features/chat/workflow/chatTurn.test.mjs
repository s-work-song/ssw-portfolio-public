import assert from 'node:assert/strict';
import test from 'node:test';
import { ChatApiError } from '../../../../src/features/chat/transport/sse.ts';
import { ChatTurnError, runChatTurn } from '../../../../src/features/chat/workflow/chatTurn.ts';

const abortError = () => new DOMException('The operation was aborted.', 'AbortError');
const themeCall = { callId: 'theme-1', name: 'set_portfolio_theme', arguments: { theme: 'dark' } };
const navCall = { callId: 'nav-1', name: 'control_portfolio_view', arguments: { action: 'research-2025' } };

/**
 * runChatTurn에 주입할 가짜 서버다. 구간마다 준비한 결말을 하나씩 꺼내 쓰고,
 * 받은 요청·세션·화면 상태를 그대로 기록한다.
 */
function fixture(options = {}) {
  const state = { sessions: [], requests: [], events: [], toolRuns: [], sessionWrites: [], renewed: 0,
    clientStates: 0, settings: { theme: 'light' } };
  const outcomes = [...(options.outcomes ?? [])];
  let session = options.session ?? null;
  const respond = async (kind, current, body, signal, onEvent) => {
    state.requests.push({ kind, session: current, body: structuredClone(body) });
    const outcome = outcomes.shift() ?? {};
    if (outcome.wait) await new Promise(resolve => { state.finish = resolve; signal.addEventListener('abort', resolve, { once: true }); });
    if (signal.aborted) throw abortError();
    for (const item of outcome.events ?? []) onEvent(item);
    if (outcome.error) throw outcome.error;
    if (outcome.calls) return { type: 'tool_request', turnId: outcome.turnId ?? 'turn-1', calls: outcome.calls };
    return { type: 'done', turnId: outcome.turnId ?? 'turn-1', answer: outcome.answer ?? '최종 답변',
      suggestedQuestions: outcome.suggestedQuestions ?? [] };
  };
  const api = {
    async createSession(signal) {
      if (signal.aborted) throw abortError();
      const failure = options.createFailures?.shift();
      if (failure) throw failure;
      const created = { sessionId: String(state.sessions.length + 1).padStart(32, '0'), token: `token-${state.sessions.length + 1}` };
      state.sessions.push(created);
      return created;
    },
    streamTurn: (current, body, signal, onEvent) => respond('turn', current, body, signal, onEvent),
    streamToolResults: (current, body, signal, onEvent) => respond('tool-results', current, body, signal, onEvent),
  };
  const controller = options.controller ?? new AbortController();
  const run = (message = '다크 모드로 바꿔 줘') => runChatTurn({
    api, message, signal: controller.signal,
    getSession: () => session,
    setSession: value => { session = value; state.sessionWrites.push(value); },
    clientState: () => {
      state.clientStates += 1;
      return { uiSettings: structuredClone(state.settings), viewState: { page: 'overview', anchor: null,
        researchTab: null, researchYear: null, researchDetails: null } };
    },
    onEvent: item => state.events.push(item),
    runTools: options.runTools ?? (async calls => {
      state.toolRuns.push(calls.map(item => item.callId));
      if (calls.some(item => item.name === 'set_portfolio_theme')) state.settings.theme = 'dark';
      return calls.map(item => ({ callId: item.callId, ok: true, output: { applied: true } }));
    }),
    onSessionRenewed: () => { state.renewed += 1; },
  });
  return { state, api, controller, run, get session() { return session; } };
}

test('세션이 없으면 첫 질문에서 만들고 질문 원문과 현재 화면 상태만 보낸 뒤 done 답을 돌려준다', async () => {
  const f = fixture({ outcomes: [{ events: [{ type: 'turn', turnId: 'turn-1' }, { type: 'status', stage: 'answering' },
    { type: 'delta', text: '부분' }], answer: '완성된 답변', suggestedQuestions: ['어떤 프로젝트가 있나요?'] }] });
  const result = await f.run('포트폴리오를 소개해 줘');
  assert.deepEqual(result, { answer: '완성된 답변', suggestedQuestions: ['어떤 프로젝트가 있나요?'] });
  assert.equal(f.state.sessions.length, 1);
  assert.deepEqual(f.state.sessionWrites, [f.state.sessions[0]]);
  assert.equal(f.session, f.state.sessions[0]);
  assert.equal(f.state.requests.length, 1);
  assert.equal(f.state.requests[0].kind, 'turn');
  assert.equal(f.state.requests[0].session, f.state.sessions[0]);
  assert.deepEqual(Object.keys(f.state.requests[0].body).sort(), ['clientState', 'message']);
  assert.equal(f.state.requests[0].body.message, '포트폴리오를 소개해 줘');
  assert.equal(f.state.requests[0].body.clientState.uiSettings.theme, 'light');
  assert.deepEqual(f.state.events.map(item => item.type), ['turn', 'status', 'delta']);
  assert.deepEqual(f.state.toolRuns, []);
});

test('기존 세션은 다시 만들지 않고 그대로 이어 쓴다', async () => {
  const session = { sessionId: 'a'.repeat(32), token: 'kept' };
  const f = fixture({ session });
  await f.run('이어서 질문');
  assert.equal(f.state.sessions.length, 0);
  assert.deepEqual(f.state.sessionWrites, []);
  assert.equal(f.state.requests[0].session, session);
});

test('tool_request는 도구 실행 결과와 바뀐 화면 상태를 tool-results로 보내 done까지 같은 턴을 이어 간다', async () => {
  const f = fixture({ outcomes: [
    { calls: [themeCall], turnId: 'turn-7' },
    { calls: [navCall], turnId: 'turn-7' },
    { answer: '다크 모드로 바꾸고 연구 2025로 이동했어요.', turnId: 'turn-7' },
  ] });
  const result = await f.run();
  assert.equal(result.answer, '다크 모드로 바꾸고 연구 2025로 이동했어요.');
  assert.deepEqual(f.state.toolRuns, [['theme-1'], ['nav-1']]);
  assert.deepEqual(f.state.requests.map(item => item.kind), ['turn', 'tool-results', 'tool-results']);
  const [, firstResults, secondResults] = f.state.requests;
  assert.equal(firstResults.session, f.state.sessions[0]);
  assert.deepEqual(firstResults.body.results, [{ callId: 'theme-1', ok: true, output: { applied: true } }]);
  assert.equal(firstResults.body.turnId, 'turn-7');
  assert.equal(firstResults.body.clientState.uiSettings.theme, 'dark', '도구 실행 뒤의 화면 상태를 다시 읽어 보낸다');
  assert.deepEqual(secondResults.body.results.map(item => item.callId), ['nav-1']);
  assert.equal(f.state.clientStates, 3);
});

test('턴 시작에서 기존 채팅이 404 session_not_found면 한 번만 새 채팅을 만들어 다시 보내고 알린다', async () => {
  const expired = { sessionId: 'e'.repeat(32), token: 'expired' };
  const missing = () => new ChatApiError('대화를 찾지 못했습니다.', { code: 'session_not_found', httpStatus: 404 });
  const f = fixture({ session: expired, outcomes: [{ error: missing() }, { answer: '새 채팅의 답변' }] });
  const result = await f.run('만료 뒤 질문');
  assert.equal(result.answer, '새 채팅의 답변');
  assert.equal(f.state.renewed, 1);
  assert.equal(f.state.sessions.length, 1);
  assert.deepEqual(f.state.sessionWrites, [null, f.state.sessions[0]]);
  assert.deepEqual(f.state.requests.map(item => [item.kind, item.session.token, item.body.message]),
    [['turn', 'expired', '만료 뒤 질문'], ['turn', 'token-1', '만료 뒤 질문']]);

  const twice = fixture({ session: expired, outcomes: [{ error: missing() }, { error: missing() }] });
  await assert.rejects(twice.run(), error => error instanceof ChatTurnError
    && error.code === 'session_not_found' && error.toolsExecuted === false);
  assert.equal(twice.state.renewed, 1, '새로 만든 채팅까지 없다고 하면 다시 반복하지 않는다');
  assert.equal(twice.state.requests.length, 2);
  assert.equal(twice.session, null, '실패한 채팅은 다음 질문이 새로 만들도록 비운다');
});

test('세션 재생성은 404·session_not_found가 함께일 때와 턴 시작 시점에만 일어난다', async () => {
  const session = { sessionId: 'b'.repeat(32), token: 'busy' };
  for (const error of [
    new ChatApiError('없음', { code: 'session_not_found', httpStatus: 409 }),
    new ChatApiError('없음', { code: 'not_found', httpStatus: 404 }),
    new ChatApiError('바쁨', { code: 'session_busy', httpStatus: 409, retryable: true }),
  ]) {
    const f = fixture({ session, outcomes: [{ error }] });
    await assert.rejects(f.run(), item => item instanceof ChatTurnError && item.code === error.code);
    assert.equal(f.state.renewed, 0);
    assert.equal(f.state.sessions.length, 0);
    assert.equal(f.session, session);
  }
  const midTurn = fixture({ session, outcomes: [{ calls: [themeCall] },
    { error: new ChatApiError('없음', { code: 'session_not_found', httpStatus: 404 }) }] });
  await assert.rejects(midTurn.run(), item => item instanceof ChatTurnError && item.toolsExecuted === true);
  assert.equal(midTurn.state.renewed, 0, '도구를 실행한 뒤에는 새 채팅으로 질문을 다시 보내지 않는다');
  assert.equal(midTurn.state.requests.length, 2);
  assert.equal(midTurn.session, null);
});

test('실패는 ChatTurnError로 감싸 원래 코드·재시도 정보와 도구 실행 여부를 함께 싣는다', async () => {
  const before = fixture({ outcomes: [{ error: new ChatApiError('혼잡', {
    code: 'upstream_busy', httpStatus: 503, retryable: true, retryAfterMs: 4_000 }) }] });
  await assert.rejects(before.run(), error => {
    assert.ok(error instanceof ChatTurnError);
    assert.ok(error instanceof ChatApiError);
    assert.equal(error.name, 'ChatTurnError');
    assert.deepEqual({ message: error.message, code: error.code, httpStatus: error.httpStatus,
      retryable: error.retryable, retryAfterMs: error.retryAfterMs, toolsExecuted: error.toolsExecuted },
    { message: '혼잡', code: 'upstream_busy', httpStatus: 503, retryable: true, retryAfterMs: 4_000, toolsExecuted: false });
    return true;
  });
  const after = fixture({ outcomes: [{ calls: [themeCall] },
    { error: new ChatApiError('스트림 끊김', { code: 'network', retryable: true }) }] });
  await assert.rejects(after.run(), error => error instanceof ChatTurnError
    && error.toolsExecuted === true && error.retryable === true && error.code === 'network');
  assert.deepEqual(after.state.toolRuns, [['theme-1']]);

  const createFailed = fixture({ createFailures: [new ChatApiError('혼잡', { code: 'rate_limited', httpStatus: 429 })] });
  await assert.rejects(createFailed.run(), error => error instanceof ChatTurnError && error.code === 'rate_limited');
  assert.equal(createFailed.state.requests.length, 0);
});

test('ChatApiError가 아닌 실패는 감싸지 않고 그대로 던진다', async () => {
  const bug = new TypeError('runner bug');
  const f = fixture({ outcomes: [{ calls: [themeCall] }], runTools: async () => { throw bug; } });
  await assert.rejects(f.run(), error => error === bug);
  assert.equal(f.state.requests.length, 1);
});

test('중단은 AbortError로 그대로 전파하고 도구 실행 뒤 중단이면 결과를 보내지 않는다', async () => {
  const waiting = fixture({ outcomes: [{ wait: true }] });
  const running = waiting.run();
  for (let index = 0; index < 10 && waiting.state.requests.length === 0; index++) await Promise.resolve();
  waiting.controller.abort();
  await assert.rejects(running, { name: 'AbortError' });
  assert.ok(!(await running.catch(error => error) instanceof ChatTurnError));

  const controller = new AbortController();
  const afterTools = fixture({ controller, outcomes: [{ calls: [themeCall] }], runTools: async calls => {
    controller.abort();
    return calls.map(item => ({ callId: item.callId, ok: true, output: {} }));
  } });
  await assert.rejects(afterTools.run(), { name: 'AbortError' });
  assert.deepEqual(afterTools.state.requests.map(item => item.kind), ['turn'], '중단 뒤 tool-results를 보내지 않는다');

  const before = new AbortController();
  before.abort();
  const early = fixture({ controller: before });
  await assert.rejects(early.run(), { name: 'AbortError' });
  assert.equal(early.state.sessions.length, 0);
  assert.equal(early.state.requests.length, 0);
});
