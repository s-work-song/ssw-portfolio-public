import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { historyFromMessages } from './chatHistory.ts';
import { compactRepeatedSupportedOptions } from './historyCompaction.ts';
import { modelHistoryCharacters, parseModelHistory } from './modelHistory.ts';
import { parseChatResponse } from './parse.ts';
import { fourToolReportCase } from './toolReportFixtures.mjs';
import { ToolReportPreparationError } from './toolReport.ts';
import { historyForCapacityRetry } from './chatRetryRecovery.ts';
import {
  requestVerifiedToolResponse,
  toolFollowupForVerification,
  verifiedToolHistory,
} from './toolVerificationRequest.ts';

const rawArguments = ' { "theme" : "dark" } \n';
const batch = (id = 'call_theme', name = 'set_portfolio_theme', args = rawArguments) => [
  { role: 'assistant', content: null, tool_calls: [{
    id, type: 'function', function: { name, arguments: args },
  }] },
  { role: 'tool', tool_call_id: id, content: ' { "awaiting_browser" : true } ' },
];
const completed = (id = 'call_theme', answer = '공개 최종 답변') => [
  ...batch(id), { role: 'assistant', content: answer },
];
const message = (id, role, content, extra = {}) => ({
  id, role, content, kind: 'message', ...extra,
});
const response = (extra = {}) => ({
  mode: 'model', status: 'online', generated: true, answer: '공개 최종 답변',
  segments: [], audience: 'default', tone: 'official', pageContext: 'overview',
  actions: [], suggestedQuestions: [], toolExecutions: [], cached: false, ...extra,
});
const browser = {
  pageContext: 'resume', uiSettings: { theme: 'dark' }, uiSettingChanges: [],
  viewState: { page: 'resume', anchor: null },
};
const verification = [{
  toolCallId: 'call_theme', toolName: 'set_portfolio_theme', status: 'applied', elapsedMs: 500,
}];
const request = () => ({
  conversationId: 'c-1', turnId: 't-1', message: '다크 모드로 바꿔 줘',
  history: [{ role: 'user', content: '앞 질문' }, { role: 'assistant', content: '앞 답변' }],
  audience: 'default', tone: 'official', pageContext: 'overview', reasoningEnabled: true,
  uiSettings: { theme: 'light' }, uiSettingChanges: [], viewState: { page: 'overview' },
});

test('다음 턴은 이전 native 호출/결과/공개 final을 그대로 재생하고 답변을 중복하지 않는다', () => {
  const native = completed('call.theme:0-1');
  const parsed = parseChatResponse(response({ modelHistory: native }));
  assert.equal(parsed.modelHistory, native);
  assert.deepEqual(historyFromMessages([
    message('u1', 'user', '  원래 질문  '),
    message('a1', 'assistant', parsed.answer, { generationState: 'complete', modelHistory: parsed.modelHistory }),
  ]), [{ role: 'user', content: '  원래 질문  ' }, ...native]);
  assert.equal(native[0].tool_calls[0].function.arguments, rawArguments);
});

test('legacy 응답과 ordinary 응답은 이전 user/assistant 이력 그대로 남는다', () => {
  const legacy = parseChatResponse(response());
  assert.equal(Object.hasOwn(legacy, 'modelHistory'), false);
  const ordinary = parseChatResponse(response({ modelHistory: [{ role: 'assistant', content: '공개 최종 답변' }] }));
  assert.deepEqual(historyFromMessages([
    message('u1', 'user', '앞 질문'), message('a1', 'assistant', legacy.answer),
    message('u2', 'user', '다음 질문'), message('a2', 'assistant', ordinary.answer, ordinary),
  ]), [
    { role: 'user', content: '앞 질문' }, { role: 'assistant', content: legacy.answer },
    { role: 'user', content: '다음 질문' }, { role: 'assistant', content: ordinary.answer },
  ]);
});

test('상태 전용 완료는 실제 native 호출/결과만 보존하고 고정 완료 문장과 빈 assistant를 만들지 않는다', () => {
  const native = verifiedToolHistory(batch(), verification, browser);
  const payload = response({ mode: 'tool_status', generated: false, answer: '', modelHistory: native });
  const parsed = parseChatResponse(payload, { toolVerification: { results: verification } });
  assert.deepEqual(parsed.modelHistory, native);
  const history = historyFromMessages([
    message('u', 'user', '다크 모드로 바꿔 줘'),
    message('a', 'assistant', '', { kind: 'tool_status', generationState: 'complete', modelHistory: parsed.modelHistory }),
  ]);
  assert.deepEqual(history, [{ role: 'user', content: '다크 모드로 바꿔 줘' }, ...native]);
  assert.equal(history.at(-1).role, 'tool');
  assert.equal(history.some((item) => item.role === 'assistant' && !item.tool_calls), false);
  assert.equal(parseChatResponse({ ...payload, modelHistory: completed() },
    { toolVerification: { results: verification } }).modelHistory, undefined);
  assert.deepEqual(historyFromMessages([
    message('u', 'user', '다크 모드로 바꿔 줘'),
    message('a', 'assistant', '', { kind: 'tool_status', generationState: 'complete' }),
  ]), [{ role: 'user', content: '다크 모드로 바꿔 줘' }]);
});

test('병렬 도구 batch와 여러 batch도 완전한 호출/결과 쌍만 받아들인다', () => {
  const first = batch();
  first[0].tool_calls.push(batch('call_second', 'get_portfolio_view_state', '{}')[0].tool_calls[0]);
  first.push({ role: 'tool', tool_call_id: 'call_second', content: '{"page":"overview"}' });
  const native = [...first, ...batch('call_third'), { role: 'assistant', content: '공개 최종 답변' }];
  assert.equal(parseModelHistory(native), native);
});

test('nonpublic 역할/도구, unknown metadata와 malformed/orphan/duplicate native chain은 field 전체를 버린다', () => {
  const broken = [
    [{ role: 'system', content: 'secret' }], [{ role: 'user', content: 'extra question' }],
    [{ role: 'developer', content: 'secret' }], batch('call_x', 'search_portfolio_logs'),
    [{ ...completed()[0], reasoning_content: 'secret' }, ...completed().slice(1)],
    [{ ...batch()[0], content: '도구 실행 전 내부 추론 문장' }, batch()[1]],
    [batch()[0], { ...batch()[1], content: '' }],
    [batch()[0], { ...batch()[1], content: '\n  ' }],
    [{ ...batch()[0], tool_calls: [{ ...batch()[0].tool_calls[0], type: 'custom' }] }, batch()[1]],
    [batch()[1]], [batch()[0]], [batch()[0], batch()[1], batch()[1]],
    [...batch(), ...batch()], batch('call_x', 'set_portfolio_theme', 'not json'),
    batch('call_x', 'set_portfolio_theme', '[]'), batch('', 'set_portfolio_theme'),
    batch('call with space'),
    batch('x'.repeat(129)), batch('call_x', 'set_portfolio_theme', ' '.repeat(2001)),
    [{ ...batch()[0], tool_calls: [{ ...batch()[0].tool_calls[0], function: {
      ...batch()[0].tool_calls[0].function, extra: true,
    } }] }, batch()[1]],
  ];
  for (const invalid of broken) {
    assert.equal(parseModelHistory(invalid), undefined, JSON.stringify(invalid));
    assert.equal(parseChatResponse(response({ modelHistory: invalid })).modelHistory, undefined);
  }
});

test('초기 mutation 응답에는 placeholder final이 없고 getter/ordinary 완료에는 answer와 같은 final이 필요하다', () => {
  const mutation = { type: 'set_portfolio_theme', toolName: 'set_portfolio_theme', toolCallId: 'call_theme', theme: 'dark' };
  assert.deepEqual(parseChatResponse(response({ toolExecutions: [mutation], modelHistory: batch() })).modelHistory, batch());
  assert.equal(parseChatResponse(response({ toolExecutions: [mutation], modelHistory: completed() })).modelHistory, undefined);
  assert.equal(parseChatResponse(response({ modelHistory: batch() })).modelHistory, undefined);
  assert.equal(parseChatResponse(response({ modelHistory: completed('call_theme', '내부 다른 답변') })).modelHistory, undefined);
  const getter = batch('call_getter', 'get_portfolio_ui_settings', '{}');
  assert.deepEqual(parseChatResponse(response({ modelHistory: [...getter, { role: 'assistant', content: '공개 최종 답변' }] })).modelHistory,
    [...getter, { role: 'assistant', content: '공개 최종 답변' }]);
});

test('브라우저 결과를 덮어써도 raw id/name/인수/assistant 공백 본문 및 다른 getter 결과는 불변이다', () => {
  const initial = [...batch('call_getter', 'get_portfolio_view_state', '{}'), ...batch('call_theme', 'set-portfolio-theme')];
  initial[2].content = '\n  ';
  const before = structuredClone(initial);
  const verified = verifiedToolHistory(initial, verification, browser);
  assert.deepEqual(initial, before);
  assert.equal(verified[0], initial[0]);
  assert.equal(verified[1], initial[1]);
  assert.equal(verified[2], initial[2]);
  assert.equal(verified[2].content, '\n  ');
  assert.equal(verified[2].tool_calls[0].function.arguments, rawArguments);
  assert.equal(verified[2].tool_calls[0].function.name, 'set-portfolio-theme');
  assert.equal(verified[3].tool_call_id, 'call_theme');
  assert.deepEqual(JSON.parse(verified[3].content), { ...verification[0], ...browser });
  assert.equal(verifiedToolHistory(initial, [{ ...verification[0], toolCallId: 'missing' }], browser), undefined);
});

test('다중 변경 호출은 모든 브라우저 관측이 있을 때만 native 이력을 전달한다', () => {
  const initial = batch();
  initial[0].tool_calls.push(
    batch('call_size', 'set_portfolio_chat_font_size', '{"size":"xlarge"}')[0].tool_calls[0],
  );
  initial.push({ role: 'tool', tool_call_id: 'call_size', content: '{"awaiting_browser":true}' });
  const sizeResult = {
    toolCallId: 'call_size', toolName: 'set_portfolio_chat_font_size', status: 'applied', elapsedMs: 500,
  };
  assert.equal(verifiedToolHistory(initial, verification, browser), undefined);
  const verified = verifiedToolHistory(initial, [...verification, sizeResult], browser);
  assert.deepEqual(JSON.parse(verified[1].content), verification[0]);
  assert.deepEqual(JSON.parse(verified[2].content), { ...sizeResult, ...browser });
});

test('4도구와 누적 설정20개는 최종 snapshot을 1회 보존하고 호출·관측·상태 값을 잃지 않는다', async () => {
  const f = fourToolReportCase();
  const original = JSON.stringify(f.native);
  const repeated = f.native.map((item, index) => index === 0 ? item
    : { ...item, content: JSON.stringify({ ...f.results[index - 1], ...f.latest }) });
  assert.ok(modelHistoryCharacters(repeated) > 12_000, '기존 정상 사용 경로의 상한 초과를 재현한다');
  const compact = verifiedToolHistory(f.native, f.results, f.latest);
  assert.ok(modelHistoryCharacters(compact) < modelHistoryCharacters(repeated));
  assert.equal(compact.length, f.native.length);
  assert.equal(JSON.stringify(f.native), original);
  assert.equal(compact[0], f.native[0]);
  assert.deepEqual(compact.map(item => item.tool_call_id), f.native.map(item => item.tool_call_id));
  assert.equal(JSON.stringify(compact[0].tool_calls), JSON.stringify(f.calls));
  const payloads = compact.slice(1).map(item => JSON.parse(item.content));
  assert.equal(payloads.filter(item => Object.hasOwn(item, 'uiSettings')).length, 1);
  payloads.forEach((payload, index) => {
    const { pageContext, uiSettings, uiSettingChanges, viewState, ...observation } = payload;
    assert.deepEqual(observation, f.results[index]);
    if (index === payloads.length - 1) {
      assert.deepEqual({ pageContext, uiSettings, uiSettingChanges, viewState }, f.latest);
    } else assert.equal(uiSettings, undefined);
  });
  let sent;
  await requestVerifiedToolResponse(Promise.resolve(), f.request, f.results, () => f.latest,
    async request => { sent = request; return response({ toolTask: { ...f.scope, steps: f.steps,
      dispatchComplete: true, status: 'completed' } }); }, new AbortController().signal, f.native);
  assert.deepEqual(sent.toolHistory, compact);
  assert.deepEqual(sent.uiSettingChanges, f.latest.uiSettingChanges);
  assert.deepEqual(sent.toolVerification.results, f.results);
  for (const value of [sent, sent.toolTask, sent.toolTask.steps, sent.toolVerification.results[0],
    sent.toolHistory[0].tool_calls[0].function, sent.uiSettings, sent.uiSettingChanges[0], sent.history]) {
    assert.ok(Object.isFrozen(value));
  }
  const snapshot = JSON.stringify(sent);
  f.latest.uiSettings.theme = 'light';
  f.results[0].status = 'failed';
  f.request.history[0].content = '나중에 바뀐 원본';
  assert.equal(JSON.stringify(sent), snapshot, '원본과 현재 화면 변경은 준비된 보고 재시도를 바꾸지 못한다');
});

test('마지막 관측 뒤의 getter 원문도 보존하고 snapshot은 마지막 mutation 결과에만 남긴다', () => {
  const f = fourToolReportCase();
  const getter = batch('getter_after', 'get_portfolio_view_state', ' { } ');
  getter[1].content = ' { "originalGetter": "값 그대로" } ';
  const native = [...f.native, ...getter];
  const verified = verifiedToolHistory(native, f.results, f.latest);
  assert.equal(verified.at(-2), getter[0]);
  assert.equal(verified.at(-1), getter[1]);
  assert.deepEqual(JSON.parse(verified[4].content), { ...f.results[3], ...f.latest });
  assert.equal(verified.filter(item => item.role === 'tool' && Object.hasOwn(JSON.parse(item.content), 'uiSettings')).length, 1);
});

test('16개 도구의 29항목·20k 초과 getter 원문도 관측·manifest와 함께 불변 보고 요청에 보존한다', async () => {
  const f = fourToolReportCase();
  const getters = Array.from({ length: 12 }, (_, index) => {
    const id = `getter_${index}`;
    const pair = batch(id, 'get_portfolio_view_state', ' { } ');
    pair[1].content = index === 0 ? ` { "unmodified": "${'x'.repeat(20_001)}" } ` : ' { "page": "research" } ';
    f.steps.push({ stepIndex: 4 + index, toolCallId: id, toolName: 'get_portfolio_view_state',
      source: 'native', dispatchStatus: 'reported' });
    return pair;
  });
  f.native.push(...getters.flat());
  const before = structuredClone(f.native);
  let sent;
  await requestVerifiedToolResponse(Promise.resolve(), f.request, f.results, () => f.latest,
    async value => { sent = value; return response({ toolTask: { ...f.scope, steps: f.steps,
      dispatchComplete: true, status: 'completed' } }); }, new AbortController().signal, f.native);
  assert.ok(modelHistoryCharacters(sent.toolHistory) > 20_000);
  assert.equal(sent.toolHistory.length, 29);
  assert.deepEqual(sent.toolHistory.slice(5), getters.flat());
  assert.deepEqual(sent.toolVerification.results, f.results);
  assert.deepEqual(sent.toolTask.steps, f.steps);
  assert.deepEqual(f.native, before);
  assert.ok(Object.isFrozen(sent.toolHistory.at(-1)));
  const snapshot = JSON.stringify(sent);
  getters[0][1].content = '나중에 바뀐 getter';
  assert.equal(JSON.stringify(sent), snapshot);
});

test('잘못된 native·manifest 불일치는 여전히 전송 전 안전 코드로 거절한다', async () => {
  for (const reason of ['history_invalid', 'manifest_mismatch']) {
    const f = fourToolReportCase();
    if (reason === 'history_invalid') f.native[0].tool_calls[0].function.arguments = '{broken';
    else f.request.toolTask.steps[0].toolCallId = 'different-native-id';
    let sends = 0;
    await assert.rejects(requestVerifiedToolResponse(Promise.resolve(), f.request, f.results, () => f.latest,
      async () => { sends++; return response(); }, new AbortController().signal, f.native),
    error => error instanceof ToolReportPreparationError && error.reportFailure === reason);
    assert.equal(sends, 0);
  }
});

test('이동·상세 혼합 체인은 순서와 raw 인수를 보존하고 상세 action,target 실제 관측을 전달한다', async () => {
  const navigation = batch('nav-1', 'control_portfolio_view', '{"action":"research-2026"}');
  const fold = batch('fold-1', 'control_portfolio_research_details', ' { "action":"collapse", "target":"2026" } ');
  const native = [...navigation, ...fold];
  const results = [
    { toolCallId: 'nav-1', toolName: 'control_portfolio_view', action: 'research-2026', status: 'arrived', elapsedMs: 700 },
    { toolCallId: 'fold-1', toolName: 'control_portfolio_research_details', action: 'collapse', target: '2026', status: 'applied', elapsedMs: 1200 },
  ];
  const latest = { ...browser, pageContext: 'research', viewState: { page: 'research', researchTab: 'timeline',
    researchYear: '2026', researchDetails: { expanded: 1, total: 3, expandedYears: ['2025'] } } };
  const verified = verifiedToolHistory(native, results, latest);
  assert.equal(verified[0], navigation[0]);
  assert.equal(verified[2], fold[0]);
  assert.deepEqual(JSON.parse(verified[3].content), { ...results[1], ...latest });
  assert.equal(Object.hasOwn(JSON.parse(verified[3].content), 'year'), false);
  assert.equal(verifiedToolHistory(native, results.slice(0, 1), latest), undefined);
  let release;
  let sent = false;
  const completion = new Promise(resolve => { release = resolve; });
  const pending = requestVerifiedToolResponse(completion, request(), results, () => latest, async payload => {
    sent = true;
    assert.deepEqual(payload.toolVerification.results, results);
    assert.deepEqual(payload.toolHistory, verified);
    return response();
  }, new AbortController().signal, native);
  await Promise.resolve();
  assert.equal(sent, false);
  release();
  await pending;
  assert.equal(sent, true);
});

test('verification과 재시도는 원래 bare question과 이전 completed history를 바꾸지 않는다', async () => {
  const original = request();
  let retryRequest;
  const error = new Error('network');
  await assert.rejects(requestVerifiedToolResponse(Promise.resolve(), original, verification,
    () => browser, async (value) => { retryRequest = value; throw error; },
    new AbortController().signal, batch()), (actual) => actual === error);
  assert.equal(retryRequest.message, original.message);
  assert.deepEqual(retryRequest.history, original.history);
  assert.notEqual(retryRequest.history, original.history, '재시도 스냅숏은 이전 이력과 값이 같지만 별도 불변 복제본이다');
  assert.equal(Object.isFrozen(retryRequest), true);
  assert.equal(Object.isFrozen(retryRequest.history), true);
  assert.equal(retryRequest.turnId, original.turnId);
  assert.deepEqual(retryRequest.toolHistory, verifiedToolHistory(batch(), verification, browser));
  assert.deepEqual(retryRequest.toolVerification.results, verification);
  assert.equal(retryRequest.toolVerification.explanationRequested, false);
  assert.equal(retryRequest.reasoningEnabled, false);
  const verified = parseChatResponse(response({ modelHistory: [...retryRequest.toolHistory, { role: 'assistant', content: '공개 최종 답변' }] }));
  assert.deepEqual(historyFromMessages([
    message('u', 'user', original.message), message('a', 'assistant', verified.answer, {
      generationState: 'complete', modelHistory: verified.modelHistory,
    }),
  ]), [{ role: 'user', content: original.message }, ...verified.modelHistory]);
  const provider = readFileSync(new URL('./ChatProvider.tsx', import.meta.url), 'utf8');
  assert.ok(provider.includes('pending.toolVerification = verificationRequest.toolVerification'));
  assert.ok(provider.includes('pending.toolHistory = verificationRequest.toolHistory'));
  assert.ok(provider.includes('message: pending.message'));
  assert.ok(provider.includes('modelHistory: response.modelHistory'));
});

test('legacy verification 요청은 새 toolHistory 없이 원래 계약대로 보낸다', async () => {
  await requestVerifiedToolResponse(Promise.resolve(), request(), verification, () => browser,
    async (value) => {
      assert.equal(Object.hasOwn(value, 'toolHistory'), false);
      assert.equal(value.toolVerification.explanationRequested, false);
      return response();
    },
    new AbortController().signal);
});

test('옛 서버 응답은 기존 boolean 계약으로 설명만 요청한다', async () => {
  await requestVerifiedToolResponse(Promise.resolve(), request(), verification, () => browser,
    async (value) => {
      assert.equal(value.toolVerification.explanationRequested, true);
      assert.equal(Object.hasOwn(value.toolVerification, 'knowledgeRequested'), false);
      return response();
    }, new AbortController().signal, batch(), true);
  const provider = readFileSync(new URL('./ChatProvider.tsx', import.meta.url), 'utf8');
  assert.ok(provider.includes('toolFollowupForVerification(response)'));
  assert.equal(toolFollowupForVerification({ uiOnly: false }), true);
  assert.equal(toolFollowupForVerification({ uiOnly: true }), false);
  assert.equal(toolFollowupForVerification({}), false);
});

test('새 서버의 조회 설명과 자료 기반 계획은 검증 요청과 실패 재시도에 그대로 보존한다', async () => {
  const uiLookup = { explanationRequested: true, knowledgeRequested: false };
  await requestVerifiedToolResponse(Promise.resolve(), request(), verification, () => browser,
    async (value) => {
      assert.deepEqual(value.toolVerification, { results: verification, ...uiLookup });
      return response();
    }, new AbortController().signal, batch(), uiLookup);

  const knowledge = {
    explanationRequested: true,
    knowledgeRequested: true,
    answerPlan: { subject: '프로젝트 최적화', aspects: ['reason', 'examples'] },
    contextTopic: '최근 프로젝트',
  };
  let retryRequest;
  const failure = new Error('network');
  await assert.rejects(requestVerifiedToolResponse(
    Promise.resolve(), request(), verification, () => browser,
    async (value) => { retryRequest = value; throw failure; },
    new AbortController().signal, batch(), knowledge,
  ), (actual) => actual === failure);
  assert.deepEqual(retryRequest.toolVerification, { results: verification, ...knowledge });
  assert.deepEqual(retryRequest.toolHistory, verifiedToolHistory(batch(), verification, browser));
});

test('단순 변경은 설명과 자료 조회를 모두 끈 새 계약으로 전달한다', async () => {
  const simpleChange = { explanationRequested: false, knowledgeRequested: false };
  assert.equal(toolFollowupForVerification({
    uiOnly: false,
    toolFollowup: simpleChange,
  }), simpleChange, '새 서버 계획이 있으면 uiOnly로 덮어쓰지 않는다');
  await requestVerifiedToolResponse(Promise.resolve(), request(), verification, () => browser,
    async (value) => {
      assert.deepEqual(value.toolVerification, { results: verification, ...simpleChange });
      return response();
    }, new AbortController().signal, batch(), simpleChange);
});

test('failed/stopped/greeting/legacy failure explanation의 native 이력은 재전송하지 않는다', () => {
  const native = completed();
  assert.deepEqual(historyFromMessages([
    message('g', 'assistant', '인사', { kind: 'greeting', modelHistory: native }),
    message('u1', 'user', '실패한 질문'),
    message('a1', 'assistant', '공개 최종 답변', { generationState: 'failed', modelHistory: native }),
    message('e', 'assistant', '구형 실패 설명', { kind: 'failure_explanation', modelHistory: native }),
    message('u2', 'user', '중단한 질문'),
    message('a2', 'assistant', '공개 최종 답변', { generationState: 'stopped', modelHistory: native }),
  ]), [{ role: 'user', content: '중단한 질문' }]);
});

test('native 이력은 여섯 USER turn도 오래된 질문·호출·결과·답변부터 모두 보존한다', () => {
  const messages = Array.from({ length: 6 }, (_, i) => [
    message(`u${i}`, 'user', `질문${i}`),
    message(`a${i}`, 'assistant', '공개 최종 답변', { generationState: 'complete', modelHistory: completed(`call_${i}`) }),
  ]).flat();
  const firstFive = historyFromMessages(messages.slice(0, 10));
  assert.equal(firstFive.length, 20);
  assert.deepEqual(firstFive, Array.from({ length: 5 }, (_, i) => [
    { role: 'user', content: `질문${i}` }, ...completed(`call_${i}`),
  ]).flat());
  const history = historyFromMessages(messages);
  assert.equal(history.length, 24);
  assert.deepEqual(history, Array.from({ length: 6 }, (_, i) => [
    { role: 'user', content: `질문${i}` }, ...completed(`call_${i}`),
  ]).flat());
});

test('native 호출 없는 일반 대화도 다섯 턴을 넘겨 모든 원문 메시지를 유지한다', () => {
  const messages = Array.from({ length: 6 }, (_, i) => [
    message(`u${i}`, 'user', `질문${i}`),
    message(`a${i}`, 'assistant', `답변${i}`, { generationState: 'complete' }),
  ]).flat();
  assert.equal(historyFromMessages(messages.slice(0, 10)).length, 10);
  assert.deepEqual(historyFromMessages(messages), Array.from({ length: 6 }, (_, i) => [
    { role: 'user', content: `질문${i}` }, { role: 'assistant', content: `답변${i}` },
  ]).flat());
});

test('연속 assistant 선행 안내도 USER turn 수와 무관하게 같은 순서로 보존한다', () => {
  const leading = Array.from({ length: 12 }, (_, i) =>
    message(`legacy${i}`, 'assistant', `안내${i}`, { generationState: 'complete' }));
  const pairs = Array.from({ length: 5 }, (_, i) => [
    message(`u${i}`, 'user', `질문${i}`),
    message(`a${i}`, 'assistant', `답변${i}`, { generationState: 'complete' }),
  ]).flat();
  const fourTurns = historyFromMessages([...leading, ...pairs.slice(0, 8)]);
  assert.equal(fourTurns.length, 20, '선행 안내 열두 개는 네 USER 턴과 함께 다섯 그룹으로 보존한다');
  assert.deepEqual(fourTurns, [...leading, ...pairs.slice(0, 8)].map(({ role, content }) => ({ role, content })));
  assert.deepEqual(historyFromMessages([...leading, ...pairs]),
    [...leading, ...pairs].map(({ role, content }) => ({ role, content })), 'USER 턴이 늘어도 선행 안내를 버리지 않는다');
});

test('여섯 native USER turn의 156개 wire item도 체인을 끊거나 앞부분을 버리지 않는다', () => {
  const nativeTurn = (i) => [
    ...Array.from({ length: 12 }, (_, n) => [
      { role: 'assistant', content: null, tool_calls: [{
        id: `t${i}_c${n}`, type: 'function',
        function: { name: 'get_portfolio_view_state', arguments: '{}' },
      }] },
      { role: 'tool', tool_call_id: `t${i}_c${n}`, content: '{}' },
    ]).flat(),
    { role: 'assistant', content: `최종 답변${i}` },
  ];
  const messages = Array.from({ length: 6 }, (_, i) => [
    message(`u${i}`, 'user', `질문${i}`),
    message(`a${i}`, 'assistant', `최종 답변${i}`, { generationState: 'complete', modelHistory: nativeTurn(i) }),
  ]).flat();
  const history = historyFromMessages(messages);
  assert.equal(history.length, 156);
  assert.deepEqual(history, Array.from({ length: 6 }, (_, i) => [
    { role: 'user', content: `질문${i}` }, ...nativeTurn(i),
  ]).flat());
});

test('12000자를 넘는 턴도 raw 인수·호출 ID·도구명·결과·본문을 잘라내지 않는다', () => {
  const native = completed();
  native[1].content = 'x'.repeat(20_001);
  assert.ok(modelHistoryCharacters(native) > 20_000);
  const messages = [message('old-u', 'user', '앞 질문'), message('old-a', 'assistant', '앞 답변'),
    message('big-u', 'user', '큰 질문'.repeat(50)),
    message('big-a', 'assistant', '공개 최종 답변', { generationState: 'complete', modelHistory: native })];
  const history = historyFromMessages(messages);
  assert.deepEqual(history, [{ role: 'user', content: '앞 질문' }, { role: 'assistant', content: '앞 답변' },
    { role: 'user', content: '큰 질문'.repeat(50) }, ...native]);
  assert.ok(modelHistoryCharacters(history) > 20_000);
  assert.equal(history.at(-2), native[1]);
});

test('CURRENT chain은 25항목·12k/20k를 넘겨도 완결된 공개 이력 원문을 보존한다', () => {
  const many = [...Array.from({ length: 16 }, (_, i) => batch(`call_${i}`)).flat(),
    { role: 'assistant', content: '공개 최종 답변' }];
  assert.equal(many.length, 33);
  assert.equal(parseModelHistory(many), many);
  assert.equal(parseChatResponse(response({ modelHistory: many })).modelHistory, many);
  const tooLarge = completed();
  tooLarge[1].content = 'x'.repeat(20_001);
  assert.equal(parseModelHistory(tooLarge), tooLarge);
  assert.equal(parseChatResponse(response({ modelHistory: tooLarge })).modelHistory, tooLarge);
  const requestTooLarge = batch('large_getter', 'get_portfolio_view_state', '{}');
  requestTooLarge[1].content = 'x'.repeat(12_001);
  assert.deepEqual(verifiedToolHistory(requestTooLarge, [], browser), requestTooLarge);
});

test('2k를 넘는 유효한 native JSON 인수도 공백과 순서를 포함해 원문 그대로 보존한다', () => {
  const largeArguments = ` ${' '.repeat(2_001)}{ "theme" : "dark" }\n`;
  const native = batch('long_arguments', 'set_portfolio_theme', largeArguments);
  assert.ok(largeArguments.length > 2_000);
  assert.equal(parseModelHistory(native), native);
  const result = { ...verification[0], toolCallId: 'long_arguments' };
  const verified = verifiedToolHistory(native, [result], browser);
  assert.equal(verified[0].tool_calls[0].function.arguments, largeArguments);
  assert.deepEqual(JSON.parse(verified[1].content), { ...result, ...browser });
});

test('질문 입력창은 고정 maxLength 없이 2k를 넘는 원문을 상태로 전달한다', () => {
  const widget = readFileSync(new URL('./ChatWidget.tsx', import.meta.url), 'utf8');
  const input = widget.match(/<textarea\s+id="chat-message"[\s\S]*?\/>/u)?.[0];
  assert.ok(input);
  assert.doesNotMatch(input, /maxLength\s*=/u);
  assert.match(input, /changeDraft\(event\.currentTarget\.value\)/u);
  const question = `  ${'질문 원문 '.repeat(500)}  `;
  assert.ok(question.length > 2_000);
  assert.deepEqual(historyFromMessages([message('long-question', 'user', question)]),
    [{ role: 'user', content: question }]);
});

const optionsRound = (id, catalog, snapshot = {}) => [
  { role: 'assistant', content: null, tool_calls: [{
    id: `get:${id}`, type: 'function',
    function: { name: 'get_portfolio_ui_settings', arguments: ' { } ' },
  }] },
  { role: 'tool', tool_call_id: `get:${id}`, content: JSON.stringify({
    available: true, uiSettings: { theme: 'dark' }, supportedOptions: catalog, snapshot,
  }) },
  { role: 'assistant', content: `조회 ${id} 완료` },
];

test('같은 지원 목록의 과거 사본만 줄이고 최신 턴·다른 버전·native 필드를 보존한다', () => {
  const catalogA = { theme: { label: '테마', values: { dark: '다크', light: '라이트' } } };
  const reorderedA = { theme: { values: { light: '라이트', dark: '다크' }, label: '테마' } };
  const catalogB = { theme: { label: '테마', values: { system: '시스템' } } };
  const history = [
    { role: 'user', content: '첫 조회' }, ...optionsRound('old-a', catalogA, { sequence: 1 }),
    { role: 'user', content: '둘째 조회' }, ...optionsRound('old-b', catalogB, { sequence: 2 }),
    { role: 'user', content: '최근 조회' }, ...optionsRound('latest-a', reorderedA, { sequence: 3 }),
  ];
  const before = structuredClone(history);
  const compacted = compactRepeatedSupportedOptions(history);
  const results = compacted.filter(({ role }) => role === 'tool').map(({ content }) => JSON.parse(content));

  assert.equal(Object.hasOwn(results[0], 'supportedOptions'), false);
  assert.deepEqual(results[0], {
    available: true, uiSettings: { theme: 'dark' }, snapshot: { sequence: 1 },
  });
  assert.deepEqual(results[1].supportedOptions, catalogB);
  assert.deepEqual(results[2].supportedOptions, reorderedA);
  assert.deepEqual(compacted.filter(({ tool_calls }) => tool_calls).map(({ tool_calls }) => tool_calls[0]),
    history.filter(({ tool_calls }) => tool_calls).map(({ tool_calls }) => tool_calls[0]));
  assert.deepEqual(history, before);

  const currentChain = [...optionsRound('current-1', catalogA), ...optionsRound('current-2', catalogA)];
  const currentResults = compactRepeatedSupportedOptions(currentChain)
    .filter(({ role }) => role === 'tool').map(({ content }) => JSON.parse(content));
  assert.deepEqual(currentResults[0].supportedOptions, catalogA,
    'USER 경계가 없는 현재 체인의 첫 카탈로그를 훼손하지 않는다');
  assert.equal(Object.hasOwn(currentResults[1], 'supportedOptions'), false,
    '현재 체인에서도 첫 조회 뒤 동일한 반복만 줄인다');
});

test('중복 목록 정책은 유지하되 12k 초과 이력의 여섯 턴과 각 관측값을 모두 보존한다', () => {
  const catalog = { theme: { label: '테마', values: { dark: 'd'.repeat(680) } } };
  const nativeHistories = Array.from({ length: 6 }, (_, index) =>
    optionsRound(String(index), catalog, { state: 's'.repeat(3_000), sequence: index }));
  const before = structuredClone(nativeHistories);
  const messages = nativeHistories.flatMap((modelHistory, index) => [
    message(`catalog-u${index}`, 'user', `카탈로그 질문${index}`),
    message(`catalog-a${index}`, 'assistant', `조회 ${index} 완료`, {
      generationState: 'complete', modelHistory,
    }),
  ]);

  assert.ok(modelHistoryCharacters(nativeHistories.slice(1).flat()) > 12_000,
    '축약 전 최근 다섯 턴은 문자 예산을 넘는 fixture다');
  const history = historyFromMessages(messages);
  assert.deepEqual(history.filter(({ role }) => role === 'user').map(({ content }) => content),
    ['카탈로그 질문0', '카탈로그 질문1', '카탈로그 질문2', '카탈로그 질문3', '카탈로그 질문4', '카탈로그 질문5']);
  assert.ok(modelHistoryCharacters(history) > 12_000);
  const catalogs = history.filter(({ role }) => role === 'tool')
    .map(({ content }) => JSON.parse(content))
    .filter((result) => Object.hasOwn(result, 'supportedOptions'));
  assert.equal(catalogs.length, 1);
  assert.equal(catalogs[0].snapshot.sequence, 5, '가장 최근 카탈로그 원문이 남는다');
  assert.deepEqual(history.filter(({ role }) => role === 'tool').map(({ content }) => JSON.parse(content).snapshot.sequence),
    [0, 1, 2, 3, 4, 5], '중복 목록 외에 각 턴의 관측값은 모두 보존한다');
  assert.deepEqual(nativeHistories, before, '응답 modelHistory 원본을 바꾸지 않는다');
});

test('용량 재시도는 최신 한 턴을 보호하고 오래된 완결 native 턴 절반만 앞에서 제외한다', () => {
  const turns = Array.from({ length: 6 }, (_, index) => [
    { role: 'user', content: `질문${index}` }, ...completed(`retry_${index}`),
  ]);
  const original = turns.flat();
  const before = structuredClone(original);
  const reduced = historyForCapacityRetry(original);
  assert.deepEqual(reduced, turns.slice(3).flat());
  assert.equal(reduced[1], turns[3][1]);
  assert.equal(reduced[1].tool_calls[0].function.arguments, rawArguments);
  assert.deepEqual(historyForCapacityRetry(reduced), turns.slice(4).flat());
  assert.deepEqual(historyForCapacityRetry(historyForCapacityRetry(reduced)), turns[5]);
  assert.equal(historyForCapacityRetry(turns[5]), undefined);
  assert.deepEqual(original, before);
  assert.deepEqual(historyFromMessages(turns.flatMap((items, index) => [
    message(`u${index}`, 'user', items[0].content), message(`a${index}`, 'assistant', '공개 최종 답변', {
      generationState: 'complete', modelHistory: items.slice(1),
    }),
  ])), original, '일반 요청 이력에는 실패 복구 축소를 상시 적용하지 않는다');
});

test('용량 재시도는 미완결·고아·중복·사설 체인이나 선행 안내를 추측해 자르지 않는다', () => {
  const latest = [{ role: 'user', content: '최신 질문' }, ...completed('latest')];
  for (const invalid of [[], [{ role: 'assistant', content: '선행 안내' }],
    [{ role: 'user', content: '중단한 질문' }],
    [{ role: 'user', content: '고아 체인' }, batch()[1]],
    [{ role: 'user', content: '중복 체인' }, ...batch(), ...batch()],
    [{ role: 'user', content: '사설 체인' }, ...batch('bad', 'private_tool')]]) {
    assert.equal(historyForCapacityRetry([...invalid, ...latest]), undefined);
  }
  const first = [{ role: 'user', content: '첫 질문' }, ...completed('first')];
  const second = [{ role: 'user', content: '둘째 질문' }, ...completed('second')];
  const incomplete = [{ role: 'user', content: '중단한 질문' }];
  assert.deepEqual(historyForCapacityRetry([...first, ...second, ...incomplete, ...latest]),
    [...second, ...incomplete, ...latest], '미완결 경계 앞의 연속 완결 그룹만 제거 후보로 본다');
});
