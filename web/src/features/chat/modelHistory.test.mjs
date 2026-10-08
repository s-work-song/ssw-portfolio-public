import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { historyFromMessages } from './chatHistory.ts';
import { modelHistoryCharacters, parseModelHistory } from './modelHistory.ts';
import { parseChatResponse } from './parse.ts';
import { requestVerifiedToolResponse, verifiedToolHistory } from './toolVerificationRequest.ts';

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

test('verification과 재시도는 원래 bare question과 이전 completed history를 바꾸지 않는다', async () => {
  const original = request();
  let retryRequest;
  const error = new Error('network');
  await assert.rejects(requestVerifiedToolResponse(Promise.resolve(), original, verification,
    () => browser, async (value) => { retryRequest = value; throw error; },
    new AbortController().signal, batch()), (actual) => actual === error);
  assert.equal(retryRequest.message, original.message);
  assert.equal(retryRequest.history, original.history);
  assert.equal(retryRequest.turnId, original.turnId);
  assert.deepEqual(retryRequest.toolHistory, verifiedToolHistory(batch(), verification, browser));
  assert.deepEqual(retryRequest.toolVerification.results, verification);
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
    async (value) => { assert.equal(Object.hasOwn(value, 'toolHistory'), false); return response(); },
    new AbortController().signal);
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

test('native 이력도 최근 다섯 USER turn을 보존하고 여섯 번째 오래된 턴 전체를 제외한다', () => {
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
  assert.equal(history.length, 20);
  assert.deepEqual(history, Array.from({ length: 5 }, (_, i) => [
    { role: 'user', content: `질문${i + 1}` }, ...completed(`call_${i + 1}`),
  ]).flat());
});

test('native 호출 없는 일반 대화는 기존과 같이 최근 다섯 USER turn/열 개 메시지를 유지한다', () => {
  const messages = Array.from({ length: 6 }, (_, i) => [
    message(`u${i}`, 'user', `질문${i}`),
    message(`a${i}`, 'assistant', `답변${i}`, { generationState: 'complete' }),
  ]).flat();
  assert.equal(historyFromMessages(messages.slice(0, 10)).length, 10);
  assert.deepEqual(historyFromMessages(messages), Array.from({ length: 5 }, (_, i) => [
    { role: 'user', content: `질문${i + 1}` }, { role: 'assistant', content: `답변${i + 1}` },
  ]).flat());
});

test('연속 assistant 선행 안내는 하나의 legacy group으로 USER turn과 함께 다섯 그룹까지만 보존한다', () => {
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
    pairs.map(({ role, content }) => ({ role, content })), '다섯 USER 턴이 생기면 가장 오래된 선행 안내 그룹 전체를 제외한다');
});

test('다섯 native USER turn의 최대 130개 wire item도 문자 예산 안이면 체인 그대로 유지한다', () => {
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
  assert.equal(history.length, 130);
  assert.ok(modelHistoryCharacters(history) <= 12_000);
  assert.deepEqual(history, Array.from({ length: 5 }, (_, i) => [
    { role: 'user', content: `질문${i + 1}` }, ...nativeTurn(i + 1),
  ]).flat());
});

test('12000자 예산에는 raw 인수/호출 ID/도구명/결과/본문이 모두 포함되고 큰 턴 전체를 제외한다', () => {
  const native = completed();
  native[1].content = 'x'.repeat(11_930);
  assert.ok(modelHistoryCharacters(native) > 11_930);
  const messages = [message('old-u', 'user', '앞 질문'), message('old-a', 'assistant', '앞 답변'),
    message('big-u', 'user', '큰 질문'.repeat(50)),
    message('big-a', 'assistant', '공개 최종 답변', { generationState: 'complete', modelHistory: native })];
  // 최신 턴 자체가 초과하면 더 오래된 부분 이력도 남기지 않는다.
  assert.deepEqual(historyFromMessages(messages), []);
  native[1].content = 'x'.repeat(11_800);
  const history = historyFromMessages([message('u', 'user', '질문'),
    message('a', 'assistant', '공개 최종 답변', { modelHistory: native })]);
  assert.ok(history.length <= 130);
  assert.ok(modelHistoryCharacters(history) <= 12_000);
  assert.equal(history[0].role, 'user');
});

test('CURRENT chain의 item/문자 상한을 넘으면 잘라내지 않고 선택 필드만 제외한다', () => {
  const tooMany = [...Array.from({ length: 13 }, (_, i) => batch(`call_${i}`)).flat()];
  assert.equal(parseModelHistory(tooMany), undefined);
  const tooLarge = completed();
  tooLarge[1].content = 'x'.repeat(20_001);
  assert.equal(parseModelHistory(tooLarge), undefined);
  const requestTooLarge = batch();
  requestTooLarge[1].content = 'x'.repeat(12_001);
  assert.equal(verifiedToolHistory(requestTooLarge, [], browser), undefined);
});
