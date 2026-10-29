import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createChatAvailabilityMonitor, canSendUnverifiedExplanation, chatAvailabilityPresentation, chatFailureAvailability, CHAT_STATUS_TIMEOUT_MS } from '../../../../src/features/chat/transport/chatAvailability.ts';

const response = status => ({ status, checkedAt: '2026-10-12T00:00:00.000Z' });
test('오프라인 안내는 실제 동작과 같이 수동 재확인을 설명하고 자동 폴링을 약속하지 않는다', () => {
  const source = readFileSync(new URL('../../../../src/features/chat/ui/ChatOfflineNotice.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /자동으로 (?:다시 )?확인하고 있어요/u);
  assert.match(source, /연결 상태를 자동으로 재조회하지는 않아요/u);
  assert.match(source, /다시 확인/u);
});
async function settle() { for (let i = 0; i < 6; i++) await Promise.resolve(); }
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function fixture(t, requestStatus) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const states = [];
  let networkOnline = true;
  const monitor = createChatAvailabilityMonitor({
    requestStatus, onChange: state => states.push(state), isNetworkOnline: () => networkOnline,
  });
  return { monitor, states, setNetworkOnline: value => { networkOnline = value; } };
}

test('mount와 온라인·오프라인 시간 경과는 상태 확인을 시작하거나 반복하지 않는다', async t => {
  let calls = 0;
  const f = fixture(t, async () => { calls++; return response('online'); });
  f.monitor.start();
  t.mock.timers.tick(600_000);
  await settle();
  assert.equal(calls, 0);
  assert.deepEqual(f.states, []);
  await f.monitor.refresh();
  t.mock.timers.tick(600_000);
  await settle();
  assert.equal(calls, 1);
  f.monitor.report('offline');
  t.mock.timers.tick(600_000);
  await settle();
  assert.equal(calls, 1);
  f.monitor.stop();
});

test('오프라인 뒤 복구 확인은 명시적 액션에서만 한 번 실행한다', async t => {
  let calls = 0;
  const f = fixture(t, async () => response(++calls === 1 ? 'offline' : 'online'));
  f.monitor.start();
  await f.monitor.refresh();
  assert.deepEqual(f.states, ['checking', 'offline']);
  t.mock.timers.tick(600_000);
  await settle();
  assert.equal(calls, 1);
  await f.monitor.refresh();
  assert.equal(calls, 2);
  assert.deepEqual(f.states, ['checking', 'offline', 'checking', 'online']);
  f.monitor.stop();
});

test('겹치는 명시적 액션은 요청과 Promise를 하나만 공유한다', async t => {
  const pending = deferred();
  let calls = 0;
  const f = fixture(t, () => { calls++; return pending.promise; });
  f.monitor.start();
  const first = f.monitor.refresh();
  const second = f.monitor.refresh({ silent: true });
  assert.equal(first, second);
  await settle();
  assert.equal(calls, 1);
  pending.resolve(response('online'));
  await first;
  assert.deepEqual(f.states, ['checking', 'online']);
  f.monitor.stop();
});

test('상태 확인 시간 초과 한 번은 이전 온라인을 유지하고 연속 초과는 오프라인으로 바꾼다', async t => {
  let calls = 0;
  const f = fixture(t, () => { calls++; return new Promise(() => {}); });
  f.monitor.start();
  f.monitor.report('online');
  const first = f.monitor.refresh({ silent: true });
  await settle();
  t.mock.timers.tick(CHAT_STATUS_TIMEOUT_MS);
  await first;
  assert.deepEqual(f.states, ['online']);
  t.mock.timers.tick(600_000);
  await settle();
  assert.equal(calls, 1);
  const second = f.monitor.refresh({ silent: true });
  await settle();
  t.mock.timers.tick(CHAT_STATUS_TIMEOUT_MS);
  await second;
  assert.deepEqual(f.states, ['online', 'offline']);
  assert.equal(calls, 2);
  f.monitor.stop();
});

test('성공 기록 없는 초기 시간 초과는 온라인으로 추측하지 않는다', async t => {
  const f = fixture(t, () => new Promise(() => {}));
  f.monitor.start();
  const pending = f.monitor.refresh();
  await settle();
  t.mock.timers.tick(CHAT_STATUS_TIMEOUT_MS);
  await pending;
  assert.deepEqual(f.states, ['checking', 'offline']);
  f.monitor.stop();
});

test('서버의 명시적 offline과 인증 실패는 이전 온라인을 즉시 갱신한다', async t => {
  let authFailure = false;
  const f = fixture(t, async () => {
    if (authFailure) throw Object.assign(new Error('safe fixture'), { code: 'authentication_error' });
    return response('offline');
  });
  f.monitor.start();
  f.monitor.report('online');
  await f.monitor.refresh({ silent: true });
  assert.deepEqual(f.states, ['online', 'offline']);
  f.monitor.report('online');
  authFailure = true;
  await f.monitor.refresh({ silent: true });
  assert.deepEqual(f.states, ['online', 'offline', 'online', 'offline']);
  f.monitor.stop();
});

test('실제 채팅 보고가 진행 중 상태 확인보다 우선하고 추가 조회를 하지 않는다', async t => {
  const pending = deferred();
  let calls = 0;
  let signal;
  const f = fixture(t, requestSignal => { signal = requestSignal; calls++; return pending.promise; });
  f.monitor.start();
  const check = f.monitor.refresh();
  await settle();
  f.monitor.report('online');
  assert.equal(signal.aborted, true);
  pending.resolve(response('offline'));
  await check;
  t.mock.timers.tick(600_000);
  await settle();
  assert.equal(calls, 1);
  assert.deepEqual(f.states, ['checking', 'online']);
  f.monitor.stop();
});

test('브라우저 offline은 즉시 반영하고 복구 이벤트만으로 온라인을 추측하지 않는다', async t => {
  let calls = 0;
  const f = fixture(t, async () => { calls++; return response('online'); });
  f.monitor.start();
  f.monitor.report('online');
  f.setNetworkOnline(false);
  f.monitor.report('offline');
  f.monitor.report('online');
  assert.deepEqual(f.states, ['online', 'offline']);
  f.setNetworkOnline(true);
  t.mock.timers.tick(600_000);
  await settle();
  assert.equal(calls, 0);
  await f.monitor.refresh();
  assert.deepEqual(f.states, ['online', 'offline', 'checking', 'online']);
  f.monitor.stop();
});

test('stop은 진행 중 확인을 취소하고 이후 액션과 늦은 응답을 무시한다', async t => {
  let calls = 0;
  let signal;
  const f = fixture(t, requestSignal => { signal = requestSignal; calls++; return new Promise(() => {}); });
  f.monitor.start();
  const check = f.monitor.refresh();
  await settle();
  f.monitor.stop();
  assert.equal(signal.aborted, true);
  await check;
  await f.monitor.refresh();
  f.monitor.report('online');
  t.mock.timers.tick(600_000);
  await settle();
  assert.equal(calls, 1);
  assert.deepEqual(f.states, ['checking']);
});

test('실제 채팅 연결 실패만 offline으로 보고하고 도구·형식·혼잡 오류는 분리한다', () => {
  for (const code of ['upstream_not_configured', 'upstream_unreachable', 'upstream_unavailable', 'upstream_auth', 'network']) {
    assert.equal(chatFailureAvailability({ code }), 'offline', code);
  }
  for (const code of ['timeout', 'upstream_timeout', 'upstream_idle_timeout', 'upstream_busy', 'upstream_rate_limited',
    'upstream_stream_failed', 'upstream_empty_response', 'upstream_rejected', 'invalid_response', 'stream_incomplete',
    'rate_limited', 'session_not_found', 'session_busy', 'step_limit', 'internal_error']) {
    assert.equal(chatFailureAvailability({ code }), undefined, code);
  }
  for (const value of [null, undefined, 'network', new Error('network'), {}]) {
    assert.equal(chatFailureAvailability(value), undefined);
  }
});

test('실제 채팅 실패 보고는 상태 GET을 추가하거나 복구 조회를 예약하지 않는다', async t => {
  let calls = 0;
  const f = fixture(t, async () => { calls++; return response('online'); });
  f.monitor.start();
  f.monitor.report('online');
  f.monitor.report(chatFailureAvailability({ code: 'upstream_auth' }));
  t.mock.timers.tick(600_000);
  await settle();
  assert.deepEqual(f.states, ['online', 'offline']);
  assert.equal(calls, 0);
  f.monitor.stop();
});

test('hook은 focus·탭복귀·online 이벤트 GET을 등록하지 않고 채팅 실패 뒤 GET도 없다', () => {
  const hook = readFileSync(new URL('../../../../src/features/chat/transport/useChatAvailability.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(hook, /addEventListener\(\s*["'](?:focus|online|visibilitychange)["']/);
  const provider = readFileSync(new URL('../../../../src/features/chat/state/ChatProvider.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(provider, /refreshAvailability\(\{\s*silent:\s*true\s*\}\)/);
  assert.match(provider, /if \(options\?\.checkAvailability !== false && availability !== "online"\)\s*\{\s*void refreshAvailability\(\)/);
});

test('미확인 카드 질문은 실제 설명 한 번으로 연결을 확인하고 일반 전송 가드는 유지한다', () => {
  assert.equal(canSendUnverifiedExplanation('idle', 'explanation'), true);
  for (const state of ['online', 'checking', 'offline']) {
    assert.equal(canSendUnverifiedExplanation(state, 'explanation'), false);
  }
  assert.equal(canSendUnverifiedExplanation('idle', 'default'), false);
  const button = readFileSync(new URL('../../../../src/features/chat/ui/AskAiButton.tsx', import.meta.url), 'utf8');
  assert.match(button, /if \(availability === "offline"\) return null/);
  assert.match(button, /open\(\{ focusInput: false, checkAvailability: false, reopenAfterClose: true \}\)/);
  assert.match(button, /await sendMessage\(question, undefined, "explanation"\)/);
});

test('idle 첫 질문은 대화·작성 입력·진행 및 중단 UI를 보여 주되 일반 전송은 허용하지 않는다', () => {
  assert.deepEqual(chatAvailabilityPresentation('idle', true), {
    showCheckingScreen: false, showOfflineScreen: false, showOfflineBanner: false, composerVisible: true,
  });
  assert.equal(canSendUnverifiedExplanation('idle', 'default'), false);
  const widget = readFileSync(new URL('../../../../src/features/chat/ui/ChatWidget.tsx', import.meta.url), 'utf8');
  const vm = readFileSync(new URL('../../../../src/features/chat/view-model/chatViewModel.ts', import.meta.url), 'utf8');
  assert.match(vm, /chatAvailabilityPresentation\(availability, hasConversation\)/);
  assert.match(widget, /\{showCheckingScreen \? \(/);
  assert.match(widget, /\{composerVisible && \(/);
  assert.match(widget, /\{chatVm\.composer\.showStop \? \([\s\S]*?onClick=\{stopGenerating\}/);
  assert.match(widget, /disabled=\{!chatVm\.composer\.canSend \|\| draft\.trim\(\)\.length === 0\}/);
});

test('초기 준비·명시적 확인·확인된 오프라인의 기존 화면과 입력 경계를 유지한다', () => {
  const cases = [
    ['idle', false, true, false, false, false],
    ['checking', false, true, false, false, false],
    ['checking', true, true, false, false, false],
    ['online', false, false, false, false, true],
    ['online', true, false, false, false, true],
    ['offline', false, false, true, false, false],
    ['offline', true, false, false, true, true],
  ];
  for (const [state, hasConversation, showCheckingScreen, showOfflineScreen, showOfflineBanner, composerVisible] of cases) {
    assert.deepEqual(chatAvailabilityPresentation(state, hasConversation), {
      showCheckingScreen, showOfflineScreen, showOfflineBanner, composerVisible,
    });
  }
});
