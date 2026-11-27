import assert from 'node:assert/strict';
import test from 'node:test';
import { projectChatViewModel, suggestedQuestionKey } from '../../../../src/features/chat/view-model/chatViewModel.ts';
import { projectMessageViewModel } from '../../../../src/features/chat/view-model/messageViewModel.ts';

const message = extra => ({ id: 'answer', role: 'assistant', kind: 'message',
  content: '본문을 그대로 보존합니다.\n\n둘째 문단입니다.', generationState: 'complete', ...extra });
const chat = extra => projectChatViewModel({ messages: [], availability: 'online', guidedTourStatus: 'idle',
  isLoading: false, retryWaitSeconds: 0, usedSuggestedQuestionKeys: new Set(), error: null, ...extra });
const row = (value, extra) => projectMessageViewModel({ message: value, activeQuickDestination: null,
  includeComplement: false, suggestedQuestions: [], slowResponse: false, canRetry: false, retryWaitSeconds: 0, ...extra });
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

test('전송 상태표: online/idle/checking/offline × busy × cooldown의 단일 canSend', () => {
  for (const availability of ['online', 'idle', 'checking', 'offline'])
    for (const isLoading of [false, true])
      for (const retryWaitSeconds of [0, 30]) {
        const vm = chat({ availability, isLoading, retryWaitSeconds });
        const canSend = availability === 'online' && !isLoading && retryWaitSeconds === 0;
        assert.equal(vm.canSend, canSend);
        assert.equal(vm.composer.canSend, canSend);
        if (vm.onboarding.visible) assert.equal(vm.onboarding.disabled, !canSend);
        assert.equal(vm.composer.showStop, isLoading);
      }
});

test('최신 실패 행만 retry/cooldown을 받으며 이전 실패·원본 참조는 유지한다', () => {
  const messages = freeze([message({ id: 'old', generationState: 'failed', retryAllowed: true }),
    message({ id: 'current', generationState: 'failed', retryAllowed: true })]);
  const before = JSON.stringify(messages);
  const vm = chat({ messages, retryWaitSeconds: 12 });
  assert.equal(vm.rows[0].message, messages[0]);
  assert.equal(vm.rows[1].message, messages[1]);
  assert.equal(vm.rows[0].canRetry, false);
  assert.equal(vm.rows[0].retryWaitSeconds, 0);
  assert.equal(vm.rows[1].canRetry, true);
  assert.equal(vm.rows[1].retryWaitSeconds, 12);
  assert.equal(vm.retryTargetMessageId, 'current');
  assert.equal(vm.composer.stopLabel, '중단');
  assert.equal(vm.composer.stopAriaLabel, '챗봇 응답 생성 중단');
  assert.equal(JSON.stringify(messages), before);
  // 화면 도구를 실행한 턴처럼 서버가 재전송을 허용하지 않은 실패는 재시도 대상이 아니다.
  for (const retryAllowed of [false, undefined]) {
    const vmWithoutRetry = chat({ messages: [message({ generationState: 'failed', retryAllowed })], error: '연결 실패' });
    assert.equal(vmWithoutRetry.rows[0].canRetry, false);
    assert.equal(vmWithoutRetry.retryTargetMessageId, null);
    assert.equal(vmWithoutRetry.error.text, '연결 실패', '재시도 대상이 없으면 전역 오류 표시는 유지한다');
  }
  assert.equal(chat({ messages: [message({ generationState: 'failed', retryAllowed: true })], error: '연결 실패' }).error, null);
  for (const generationState of ['streaming', 'stopped', 'complete']) {
    assert.equal(chat({ messages: [message({ generationState, retryAllowed: true })] }).retryTargetMessageId, null);
  }
});

test('원문이 JSON처럼 보여도 역할/생성 성공/notice를 내용으로 재분류하지 않는다', () => {
  for (const kind of ['message', 'chat_notice']) {
    const value = freeze(message({ kind, content: '{"kind":"tools"}' }));
    const vm = row(value);
    assert.equal(vm.bodyKind, 'markdown');
    assert.equal(vm.segments[0].markdown, value.content);
    assert.equal(vm.status, null);
    assert.equal(value.kind, kind);
  }
  assert.equal(row(message({ role: 'user', generationState: undefined })).bodyKind, 'plain');
});

test('생성 중에는 외부 status 하나, 실패·중단에는 상태별 배지만 남긴다', () => {
  for (const generationState of ['streaming', 'failed', 'stopped', 'complete']) {
    const vm = row(message({ generationState, content: '' }), { canRetry: true, retryWaitSeconds: 7 });
    assert.equal(Boolean(vm.status), generationState === 'streaming');
    assert.equal(Boolean(vm.failure), generationState === 'failed');
    assert.equal(Boolean(vm.stoppedLabel), generationState === 'stopped');
    assert.equal(Boolean(vm.retry), generationState === 'failed');
  }
  assert.deepEqual(row(message({ generationState: 'failed' }), { canRetry: true, retryWaitSeconds: 7 }).retry,
    { disabled: true, label: '7초 후 다시 시도' });
  assert.equal(row(message({ generationState: 'streaming', content: '' })).showMessageBubble, false);
});

test('서버 진행 단계는 생성 중에만 문구로 보이고 느린 응답 안내가 우선한다', () => {
  for (const [statusStage, text] of [[undefined, '응답 생성 중'], ['answering', '응답 생성 중'],
    ['searching', '자료 찾는 중'], ['working', '화면 조작 중']]) {
    const value = freeze(message({ generationState: 'streaming', content: '', statusStage }));
    assert.deepEqual(row(value).status, { text, dots: true });
    assert.deepEqual(row(value, { slowResponse: true }).status,
      { text: '평소보다 오래 걸리고 있어요. 기다리거나 중단할 수 있어요', dots: true });
    assert.equal(row({ ...value, generationState: 'complete' }).status, null, '완료 뒤 남은 단계 값은 표시하지 않는다');
  }
});

test('실패 안내는 서버 안내를 우선하고 화면을 이미 바꾼 실패는 바뀐 화면이 유지된다고 덧붙인다', () => {
  const chip = status => ({ callId: status, tool: 'set_portfolio_theme', label: '화면 모드 · 다크', status });
  assert.deepEqual(row(message({ generationState: 'failed' })).failure,
    { label: '응답 생성을 완료하지 못했습니다', notice: '응답 생성을 완료하지 못했어요. 다시 시도해 주세요.' });
  assert.equal(row(message({ generationState: 'failed', failureNotice: '요청이 많아 잠시 후 다시 시도해 주세요.' })).failure.notice,
    '요청이 많아 잠시 후 다시 시도해 주세요.');
  for (const status of ['applied', 'arrived']) {
    assert.equal(row(message({ generationState: 'failed', failureNotice: '연결이 끊겼어요.', toolResults: [chip(status)] })).failure.notice,
      '연결이 끊겼어요. 이미 바뀐 화면은 그대로 유지됩니다.');
  }
  for (const status of ['started', 'failed']) {
    assert.equal(row(message({ generationState: 'failed', failureNotice: '연결이 끊겼어요.', toolResults: [chip(status)] })).failure.notice,
      '연결이 끊겼어요.');
  }
});

test('추천은 최신 완료에만 정규화/사용 이력/중복을 반영하고 suppressed 본문은 유지한다', () => {
  const value = message({ suggestedQuestions: [' 이미 질문? ', '새 질문?', '새 질문！', ''] });
  const vm = chat({ messages: [value], usedSuggestedQuestionKeys: new Set([suggestedQuestionKey('이미 질문')]) });
  assert.deepEqual(vm.rows[0].suggestedQuestions, ['새 질문?']);
  assert.equal(vm.rows[0].includeComplement, true);
  assert.deepEqual(chat({ messages: [value], isLoading: true }).rows[0].suggestedQuestions, []);
  const suppressed = { ...value, recommendationsSuppressed: true };
  assert.deepEqual(chat({ messages: [suppressed] }).rows[0].suggestedQuestions, []);
  assert.equal(row(suppressed).segments[0].markdown, value.content);
});

test('delta마다 과거 행의 memo props identity를 보존하고 본문/칩은 미리 복제하지 않는다', () => {
  const old = freeze(message({ id: 'past' }));
  const a = chat({ isLoading: true, messages: [old, message({ generationState: 'streaming', content: 'a' })] });
  const b = chat({ isLoading: true, messages: [old, message({ generationState: 'streaming', content: 'ab' })] });
  assert.equal(a.rows[0].message, b.rows[0].message);
  assert.equal(a.rows[0].suggestedQuestions, b.rows[0].suggestedQuestions);
  assert.deepEqual(a.rows[0], b.rows[0]);
  assert.equal('segments' in b.rows[0], false);
  assert.equal('chips' in b.rows[0], false);
});

test('새 대화는 greeting만의 UI로 돌아가며 빈 상태 projection은 설정/실행을 갖지 않는다', () => {
  const vm = chat({ messages: [message({ id: 'greeting', kind: 'greeting' })] });
  assert.equal(vm.hasConversation, false);
  assert.deepEqual(vm.inputHistory, []);
  assert.equal(vm.rows[0].showOnboarding, true);
  assert.equal(vm.retryTargetMessageId, null);
  assert.equal('uiSettings' in vm, false);
  assert.equal('sendMessage' in vm, false);
  assert.equal('workerHistory' in vm, false);
});

