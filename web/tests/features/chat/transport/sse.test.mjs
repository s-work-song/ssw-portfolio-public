import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ChatApiError,
  DEFAULT_RETRY_AFTER_MS,
  nextSseBlock,
  parseSseBlock,
  parseTurnEvent,
  retryAfterMsFromHeader,
} from '../../../../src/features/chat/transport/sse.ts';
import { PORTFOLIO_CHAT_TOOL_NAMES, PORTFOLIO_UI_TOOL_NAMES } from '../../../../src/features/portfolio-tools/schema.ts';

const event = (name, data) => parseTurnEvent({ event: name, data: JSON.stringify(data) });
const call = (index, extra = {}) => ({ callId: `call-${index}`, name: 'set_portfolio_theme',
  arguments: { theme: 'dark' }, ...extra });
const assertInvalid = (name, data) => assert.throws(
  () => parseTurnEvent({ event: name, data: typeof data === 'string' ? data : JSON.stringify(data) }),
  error => error instanceof ChatApiError && error.code === 'invalid_response' && error.retryable === false,
  `${name} ${typeof data === 'string' ? data : JSON.stringify(data)}`,
);

test('SSE 블록은 event와 여러 data 줄을 합치고 주석·BOM·CRLF를 무시한다', () => {
  assert.deepEqual(parseSseBlock('event: delta\ndata: {"text":"가"}'), { event: 'delta', data: '{"text":"가"}' });
  assert.deepEqual(parseSseBlock(': keep-alive\r\nevent: done\r\ndata: {"a":1,\r\ndata:"b":2}'),
    { event: 'done', data: '{"a":1,\n"b":2}' });
  assert.deepEqual(parseSseBlock('﻿event:turn\ndata:{"turnId":"t"}'), { event: 'turn', data: '{"turnId":"t"}' });
  assert.deepEqual(parseSseBlock('event: delta\ndata:  앞 공백은 하나만 뗀다'),
    { event: 'delta', data: ' 앞 공백은 하나만 뗀다' });
  assert.deepEqual(parseSseBlock('id: 7\nevent: delta\nretry: 10\ndata: {}'), { event: 'delta', data: '{}' });
  for (const block of [': heartbeat', '', 'data: {"text":"이름 없음"}', 'event: delta', 'event: delta\n: 데이터 없음']) {
    assert.equal(parseSseBlock(block), null, JSON.stringify(block));
  }
});

test('버퍼에서 완결된 블록만 순서대로 떼고 나머지는 다음 청크를 기다린다', () => {
  let buffer = 'event: turn\ndata: {"turnId":"t1"}\n\nevent: delta\r\ndata: {"text":"a"}\r\n\r\nevent: delta\rdata: {}\r\revent: do';
  const blocks = [];
  for (let next = nextSseBlock(buffer); next; next = nextSseBlock(buffer)) {
    blocks.push(next.block);
    buffer = next.rest;
  }
  assert.deepEqual(blocks, ['event: turn\ndata: {"turnId":"t1"}', 'event: delta\r\ndata: {"text":"a"}', 'event: delta\rdata: {}']);
  assert.equal(buffer, 'event: do');
  assert.equal(nextSseBlock('event: delta\ndata: {}\n'), null, '빈 줄이 오기 전에는 블록을 확정하지 않는다');
  assert.equal(nextSseBlock(''), null);
});

test('계약 이벤트 여섯 종을 화면이 쓰는 값으로 읽는다', () => {
  assert.deepEqual(event('turn', { turnId: 'turn-1' }), { type: 'turn', turnId: 'turn-1' });
  for (const stage of ['answering', 'searching', 'working']) {
    assert.deepEqual(event('status', { stage }), { type: 'status', stage });
  }
  assert.deepEqual(event('delta', { text: '' }), { type: 'delta', text: '' });
  assert.deepEqual(event('delta', { text: '부분 답변' }), { type: 'delta', text: '부분 답변' });
  assert.deepEqual(event('done', { turnId: 'turn-1', answer: '최종 답변', extra: true }),
    { type: 'done', turnId: 'turn-1', answer: '최종 답변', suggestedQuestions: [] });
  // 후속 질문은 부가 정보라 잘못된 항목만 거르고 답변은 그대로 받는다.
  assert.deepEqual(event('done', { turnId: 'turn-1', answer: '최종 답변',
    suggestedQuestions: [' 어떤 모델을 쓰나요? ', '', 3, 'x'.repeat(121), '둘째?', '셋째?', '넷째?'] }).suggestedQuestions,
  ['어떤 모델을 쓰나요?', '둘째?', '셋째?']);
  assert.deepEqual(event('done', { turnId: 'turn-1', answer: '최종 답변', suggestedQuestions: '문자열' }).suggestedQuestions, []);
  const args = { action: 'research-2025' };
  const request = event('tool_request', { turnId: 'turn-1', calls: [
    { callId: 'nav-1', name: 'control_portfolio_view', arguments: args, ignored: 'x' },
    { callId: 'get-1', name: 'get_portfolio_view_state', arguments: {} },
  ] });
  assert.deepEqual(request, { type: 'tool_request', turnId: 'turn-1', calls: [
    { callId: 'nav-1', name: 'control_portfolio_view', arguments: args },
    { callId: 'get-1', name: 'get_portfolio_view_state', arguments: {} },
  ] });
  assert.deepEqual(event('error', { code: 'upstream_busy', message: '잠시 후 다시 시도해 주세요.', retryable: true }),
    { type: 'error', code: 'upstream_busy', message: '잠시 후 다시 시도해 주세요.', retryable: true });
});

test('error 이벤트는 코드 형식·문구 길이를 제한하고 retryable은 true일 때만 인정한다', () => {
  assert.deepEqual(event('error', {}), { type: 'error', code: 'internal_error',
    message: '응답을 완료하지 못했습니다.', retryable: false });
  for (const code of ['Upstream', 'has-dash', '1digit', 'a'.repeat(65), 42]) {
    assert.equal(event('error', { code }).code, 'internal_error', String(code));
  }
  assert.equal(event('error', { code: 'a'.repeat(64) }).code, 'a'.repeat(64));
  assert.equal(event('error', { message: '가'.repeat(400) }).message, '가'.repeat(300));
  assert.equal(event('error', { message: '' }).message, '응답을 완료하지 못했습니다.');
  for (const retryable of ['true', 1, null]) assert.equal(event('error', { retryable }).retryable, false);
});

test('아는 이벤트의 데이터가 계약과 다르면 invalid_response로 끝낸다', () => {
  assertInvalid('delta', '{not json');
  assertInvalid('delta', 'null');
  assertInvalid('delta', '"문자열"');
  assertInvalid('delta', {});
  assertInvalid('delta', { text: 3 });
  assertInvalid('turn', {});
  assertInvalid('status', { stage: 'thinking' });
  assertInvalid('done', { turnId: 't' });
  assertInvalid('done', { answer: '턴 없음' });
  assertInvalid('tool_request', { calls: [call(0)] });
  assertInvalid('tool_request', { turnId: 't', calls: [] });
  assertInvalid('tool_request', { turnId: 't', calls: {} });
  assertInvalid('tool_request', { turnId: 't', calls: [call(0, { name: 'run_shell' })] });
  assertInvalid('tool_request', { turnId: 't', calls: [call(0, { name: 'set-portfolio-theme' })] });
  assertInvalid('tool_request', { turnId: 't', calls: [call(0, { callId: '' })] });
  assertInvalid('tool_request', { turnId: 't', calls: [call(0, { callId: 'x'.repeat(201) })] });
  assertInvalid('tool_request', { turnId: 't', calls: [call(0, { arguments: [] })] });
  assertInvalid('tool_request', { turnId: 't', calls: [call(0, { arguments: null })] });
  assertInvalid('tool_request', { turnId: 't', calls: [call(0), 'call'] });
  assert.equal(event('tool_request', { turnId: 't', calls: [call(0, { callId: 'x'.repeat(200) })] }).calls.length, 1);
});

test('모르는 이벤트는 건너뛰고 한 번에 실행할 도구 호출은 20개까지만 받는다', () => {
  assert.equal(event('heartbeat', { at: 1 }), null);
  assert.equal(event('meta', { toolTask: {} }), null);
  assert.equal(parseTurnEvent({ event: 'future_event', data: 'not json' }), null, '새 이벤트는 데이터 형식과 무관하게 건너뛴다');
  const twenty = event('tool_request', { turnId: 't', calls: Array.from({ length: 20 }, (_, index) => call(index)) });
  assert.equal(twenty.calls.length, 20);
  assertInvalid('tool_request', { turnId: 't', calls: Array.from({ length: 21 }, (_, index) => call(index)) });
});

test('도구 인자는 원본과 분리한 사본으로 넘긴다', () => {
  const sse = { event: 'tool_request', data: JSON.stringify({ turnId: 't', calls: [call(0)] }) };
  const first = parseTurnEvent(sse);
  first.calls[0].arguments.theme = 'light';
  assert.equal(parseTurnEvent(sse).calls[0].arguments.theme, 'dark');
});

test('retry-after는 초·소수·0·HTTP-date를 읽고 형식이 틀리면 기본 대기를 쓴다', () => {
  const now = Date.parse('2026-10-28T00:00:00Z');
  assert.equal(retryAfterMsFromHeader('30', now), 30_000);
  assert.equal(retryAfterMsFromHeader(' 1.2 ', now), 1_200);
  assert.equal(retryAfterMsFromHeader('0', now), 0);
  assert.equal(retryAfterMsFromHeader('Wed, 28 Oct 2026 00:00:45 GMT', now), 45_000);
  assert.equal(retryAfterMsFromHeader('Tue, 27 Oct 2026 23:59:00 GMT', now), 0, '지난 시각은 0으로 자른다');
  for (const value of [null, '', '-5', 'soon', '2026-10-28T00:00:45Z']) {
    assert.equal(retryAfterMsFromHeader(value, now), DEFAULT_RETRY_AFTER_MS, String(value));
  }
  assert.equal(retryAfterMsFromHeader(null, now, 1_234), 1_234);
});

test('ChatApiError는 retryable을 명시했을 때만 재시도 가능으로 본다', () => {
  const plain = new ChatApiError('안내');
  assert.equal(plain.name, 'ChatApiError');
  assert.equal(plain.retryable, false);
  assert.equal(plain.code, undefined);
  const busy = new ChatApiError('안내', { code: 'rate_limited', httpStatus: 429, retryAfterMs: 5_000, retryable: true });
  assert.deepEqual({ code: busy.code, httpStatus: busy.httpStatus, retryAfterMs: busy.retryAfterMs, retryable: busy.retryable },
    { code: 'rate_limited', httpStatus: 429, retryAfterMs: 5_000, retryable: true });
});

test('채팅 전용 선택지 도구는 tool_request로 받되 WebMCP가 쓰는 UI 도구 목록에는 없다', () => {
  const pick = { callId: 'pick-1', name: 'choose_portfolio_setting', arguments: { setting: 'accent' } };
  assert.deepEqual(event('tool_request', { turnId: 't', calls: [pick] }).calls, [pick]);
  assert.ok(PORTFOLIO_CHAT_TOOL_NAMES.includes('choose_portfolio_setting'));
  assert.ok(!PORTFOLIO_UI_TOOL_NAMES.includes('choose_portfolio_setting'));
  assert.deepEqual(PORTFOLIO_CHAT_TOOL_NAMES.filter(name => !PORTFOLIO_UI_TOOL_NAMES.includes(name)), ['choose_portfolio_setting']);
});
