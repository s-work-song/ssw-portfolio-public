import assert from 'node:assert/strict';
import { projectChatViewModel } from '../../../../src/features/chat/view-model/chatViewModel.ts';
import { projectMessageViewModel } from '../../../../src/features/chat/view-model/messageViewModel.ts';
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
} from '../../../../src/features/chat/transport/chatFailure.ts';
import { ChatApiError } from '../../../../src/features/chat/transport/sse.ts';
import { toolResultDisplayStatus, toolResultText } from '../../../../src/features/chat/workflow/toolResultPresentation.ts';
import { CHAT_QUICK_START_OPTION_BY_ACTION_ID } from '../../../../src/features/chat/constants.ts';
import { chatProviderFixture } from '../state/chatProviderFixtures.mjs';

const message = (id, role, content, extra = {}) => ({
  id, role, content, kind: 'message', ...extra,
});
const themeCall = { callId: 'theme-1', name: 'set_portfolio_theme', arguments: { theme: 'dark' } };

/** 실제 MessageItem TSX를 CSS 모듈만 대체해 렌더할 수 있게 불러온다. */
function loadMessageItem(stubs = {}) {
  const require = createRequire(new URL('../../../../src/features/chat/ui/MessageItem.tsx', import.meta.url));
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const ts = require('typescript');
  const source = readFileSync(new URL('../../../../src/features/chat/ui/MessageItem.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const componentModule = { exports: {} };
  const localRequire = name => {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    if (name === './ChatWidget.module.css') return { __esModule: true,
      default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (name === '../streaming/StreamingText') return { StreamingText: ({ text }) => text };
    return require(name);
  };
  new Function('require', 'module', 'exports', compiled)(localRequire, componentModule, componentModule.exports);
  return { ...componentModule.exports, render: props => renderToStaticMarkup(React.createElement(componentModule.exports.MessageItem, props)) };
}

test('실제 Provider send/reset/stop: 서버 cooldown은 flow 취소와 독립이며 새 대화로 early POST를 우회하지 못한다', async t => {
  for (const retryAfterMs of [30_000, 65_000]) {
    for (const action of ['stop', 'reset']) {
      await t.test(`${retryAfterMs}ms ${action}`, async t => {
        const f = chatProviderFixture(t, { messages: [message('chat-greeting', 'assistant', '인사', { kind: 'greeting' })],
          outcomes: [{ error: new ChatApiError('잠시 후 다시 시도해 주세요.', { code: 'upstream_busy', httpStatus: 503,
            retryAfterMs, retryable: true }) }] });
        await f.send('첫 질문');
        const serverDeadline = f.refs.requestCooldownDeadlineRef.current;
        assert.equal(serverDeadline, f.now() + retryAfterMs);
        assert.equal(f.refs.retryWaitDeadlineRef.current, serverDeadline, '재시도 버튼도 같은 시각까지 기다린다');
        assert.equal(f.state.messages.at(-1).generationState, 'failed');
        assert.equal(f.state.messages.at(-1).retryAllowed, true);
        f[action]();
        assert.equal(f.refs.inFlightRef.current, false);
        assert.equal(f.refs.abortRef.current, null);
        assert.equal(f.refs.requestCooldownDeadlineRef.current, serverDeadline, '서버 not-before는 취소하지 않는다');
        assert.equal(f.state.retryWaitSeconds, retryAfterMs / 1_000);
        if (action === 'reset') {
          assert.equal(f.refs.retryRef.current, null, '이전 대화의 재시도 재료는 버린다');
          assert.equal(f.refs.retryWaitDeadlineRef.current, 0, 'flow 전용 대기는 취소한다');
          assert.deepEqual(f.state.messages, f.initialMessages());
          assert.deepEqual(f.state.closed, [f.state.sessions[0]], '새 대화는 서버 채팅을 닫는다');
          assert.equal(f.refs.sessionRef.current, null);
        } else {
          assert.equal(f.state.messages.at(-1).generationState, 'failed', '끝난 요청의 중단은 아무것도 바꾸지 않는다');
          assert.ok(f.refs.retryRef.current);
        }
        const beforeMessages = structuredClone(f.state.messages);
        await f.send('대기 중 작성한 새 질문');
        await f.retry();
        assert.equal(f.state.turns.length, 1);
        assert.deepEqual(f.state.messages, beforeMessages);
        f.advanceTime(retryAfterMs - 1);
        assert.equal(f.state.retryWaitSeconds, 1);
        await f.send('1ms 먼저 전송 시도');
        assert.equal(f.state.turns.length, 1);
        f.advanceTime(1);
        assert.equal(f.state.retryWaitSeconds, 0);
        assert.equal(f.state.turns.length, 1, 'deadline 만료 자체는 HTTP 전송을 예약하지 않는다');
        await f.send('deadline 이후 명시한 새 질문');
        assert.equal(f.state.turns.length, 2);
        assert.equal(f.state.turns[1].message, 'deadline 이후 명시한 새 질문');
        assert.equal(f.state.messages.at(-1).generationState, 'complete');
        assert.equal(f.state.sessions.length, action === 'reset' ? 2 : 1);
      });
    }
  }
});

test('실제 Provider: 일시 실패의 수동 재시도는 같은 말풍선에서 같은 질문을 한 번만 다시 보낸다', async t => {
  const f = chatProviderFixture(t, { outcomes: [
    { delta: '받다 만 부분', error: new ChatApiError('연결이 끊겼어요.', { code: 'network', retryable: true }) },
    { answer: '다시 받은 답변' },
  ] });
  await f.send('같은 질문');
  const failed = f.state.messages.at(-1);
  assert.equal(failed.generationState, 'failed');
  assert.equal(failed.content, '받다 만 부분', '실패 전까지 받은 글은 실패 표시와 함께 남긴다');
  assert.equal(failed.failureNotice, '연결이 끊겼어요.');
  assert.deepEqual(f.state.availability, ['offline']);
  assert.deepEqual(f.state.diagnostics, [['request', 'network']]);
  // network 실패로 오프라인이 보고돼도 대화가 시작된 뒤에는 재시도할 수 있다.
  f.rerender({ availability: 'offline' });
  await Promise.all([f.retry(), f.retry()]);
  assert.equal(f.state.turns.length, 2);
  assert.equal(f.state.turns[1].message, '같은 질문');
  assert.equal(f.state.turns[1].session, f.state.turns[0].session);
  assert.equal(f.state.messages.filter(item => item.role === 'user').length, 1, '재시도는 질문 말풍선을 다시 만들지 않는다');
  const answer = f.state.messages.at(-1);
  assert.equal(answer.id, failed.id);
  assert.equal(answer.generationState, 'complete');
  assert.equal(answer.content, '다시 받은 답변');
  assert.equal(answer.failureNotice, undefined);
  assert.equal(f.refs.retryRef.current, null);
  assert.equal(f.state.availability.at(-1), 'online');
});

test('실제 Provider: 재시도 불가 실패와 앱 내부 오류는 재시도 재료를 남기지 않고 원문을 표시하지 않는다', async t => {
  for (const [error, notice] of [
    [new ChatApiError('응답 형식이 올바르지 않습니다.', { code: 'invalid_response' }), '응답 형식이 올바르지 않습니다.'],
    [new TypeError('secret internal stack'), undefined],
  ]) {
    const f = chatProviderFixture(t, { outcomes: [{ error }] });
    await f.send('질문');
    const failed = f.state.messages.at(-1);
    assert.equal(failed.generationState, 'failed');
    assert.equal(failed.retryAllowed, false);
    assert.equal(failed.failureNotice, notice);
    assert.equal(f.refs.retryRef.current, null);
    assert.equal(f.state.retryWaitSeconds, 0);
    assert.equal(projectChatViewModel({ messages: f.state.messages, availability: 'online', guidedTourStatus: 'idle',
      isLoading: false, retryWaitSeconds: 0, usedSuggestedQuestionKeys: new Set(), error: null }).retryTargetMessageId, null);
    const vm = projectMessageViewModel({ message: failed, activeQuickDestination: null, includeComplement: false,
      suggestedQuestions: [], slowResponse: false, canRetry: false, retryWaitSeconds: 0 });
    assert.equal(vm.failure.notice, notice ?? CHAT_FAILURE_NOTICE);
    assert.equal(JSON.stringify(f.state.messages).includes('secret'), false);
    await f.retry();
    assert.equal(f.state.turns.length, 1);
  }
});

test('실제 Provider: 화면 도구를 실행한 뒤 실패하면 재시도를 막고 실제 도구 결과와 바뀐 화면 안내를 남긴다', async t => {
  const f = chatProviderFixture(t, { outcomes: [
    { calls: [themeCall] },
    { error: new ChatApiError('연결이 끊겼어요.', { code: 'network', retryable: true }) },
  ] });
  await f.send('다크 모드로 바꾸고 설명해 줘');
  assert.deepEqual(f.state.requests.map(item => item.kind), ['turn', 'tool-results']);
  assert.deepEqual(f.state.effects, [['set_portfolio_theme', { theme: 'dark' }]]);
  const failed = f.state.messages.at(-1);
  assert.equal(failed.generationState, 'failed');
  assert.equal(failed.retryAllowed, false, '이미 바뀐 화면을 다시 조작하지 않도록 같은 질문을 재전송하지 않는다');
  assert.deepEqual(failed.toolResults.map(item => [item.callId, item.status]), [['theme-1', 'applied']]);
  assert.equal(f.refs.retryRef.current, null);
  const vm = projectMessageViewModel({ message: failed, activeQuickDestination: null, includeComplement: false,
    suggestedQuestions: [], slowResponse: false, canRetry: false, retryWaitSeconds: 0 });
  assert.equal(vm.failure.notice, '연결이 끊겼어요. 이미 바뀐 화면은 그대로 유지됩니다.');
  await f.retry();
  assert.equal(f.state.requests.length, 2);
  assert.equal(f.state.effects.length, 1);
});

test('실제 Provider: 이전 대화가 서버에서 만료되면 새 채팅으로 한 번 이어 답하고 앱 안내를 답변 앞에 남긴다', async t => {
  const f = chatProviderFixture(t, { outcomes: [
    { answer: '첫 답변' },
    { error: () => new ChatApiError('대화를 찾지 못했습니다.', { code: 'session_not_found', httpStatus: 404 }) },
    { answer: '새 채팅에서의 답변' },
  ] });
  await f.send('첫 질문');
  await f.send('만료 뒤 질문');
  assert.equal(f.state.sessions.length, 2);
  assert.deepEqual(f.state.turns.map(item => [item.session.token, item.message]),
    [['token-1', '첫 질문'], ['token-1', '만료 뒤 질문'], ['token-2', '만료 뒤 질문']]);
  const [notice, answer] = f.state.messages.slice(-2);
  assert.equal(notice.kind, 'chat_notice');
  assert.equal(notice.generated, false);
  assert.equal(notice.generationState, 'complete');
  assert.match(notice.content, /이전 대화가 만료되어 새 대화로 이어서 답합니다/u);
  assert.equal(answer.content, '새 채팅에서의 답변');
  assert.equal(answer.generationState, 'complete');
  assert.equal(f.refs.sessionRef.current, f.state.sessions[1]);
});

test('실제 Provider: 페이지를 떠나며 닫은 채팅을 뒤로가기로 돌아와 이어 물으면 새 대화 안내를 한 번 남긴다', async t => {
  const f = chatProviderFixture(t, { outcomes: [{ answer: '첫 답변' }, { answer: '돌아온 뒤 답변' }, { answer: '이어진 답변' }] });
  await f.send('첫 질문');
  // pagehide가 채팅을 닫고 표시만 남긴 상태다.
  f.refs.sessionRef.current = null; f.refs.sessionClosedOnPageHideRef.current = true;
  await f.send('돌아온 뒤 질문');
  const notices = () => f.state.messages.filter(item => item.kind === 'chat_notice');
  assert.equal(notices().length, 1); assert.match(notices()[0].content, /새 대화로 이어서 답합니다/u);
  assert.equal(f.state.messages.at(-1).content, '돌아온 뒤 답변');
  assert.equal(f.state.sessions.length, 2);
  await f.send('이어 묻기');
  assert.equal(notices().length, 1, '새 채팅이 이어지는 동안에는 다시 알리지 않는다');
});

test('실제 Provider: 요청 중 stop·새 대화·unmount·중복 클릭은 늦은 답변이나 추가 요청을 만들지 않는다', async t => {
  for (const kind of ['stop', 'new-chat', 'unmount', 'double-click']) {
    await t.test(kind, async t => {
      const f = chatProviderFixture(t, { outcomes: [{ wait: true, delta: '늦게 도착한 글' }] });
      const run = f.send('질문');
      await f.untilRequest(1);
      assert.equal(f.refs.inFlightRef.current, true);
      assert.equal(f.state.loading, true);
      if (kind === 'stop') f.stop();
      else if (kind === 'new-chat') f.reset();
      else if (kind === 'unmount') {
        f.refs.mountedRef.current = false;
        f.refs.abortRef.current.abort();
      } else {
        await f.send('중복 질문');
        await f.retry();
        f.state.finish();
      }
      await run;
      assert.equal(f.state.turns.length, 1);
      assert.equal(f.refs.inFlightRef.current, false);
      assert.equal(f.refs.abortRef.current, null);
      if (kind === 'stop') {
        assert.equal(f.state.messages.at(-1).generationState, 'stopped');
        assert.equal(f.state.messages.at(-1).retryAllowed, false);
        assert.equal(f.refs.retryRef.current, null);
        assert.equal(f.state.loading, false);
      }
      if (kind === 'new-chat') {
        assert.deepEqual(f.state.messages, f.initialMessages());
        assert.deepEqual(f.state.closed, [f.state.sessions[0]]);
      }
      if (kind === 'unmount') assert.equal(f.state.messages.at(-1).generationState, 'streaming', '언마운트 뒤에는 상태를 쓰지 않는다');
      if (kind === 'double-click') {
        assert.equal(f.state.messages.at(-1).generationState, 'complete');
        assert.equal(f.state.messages.at(-1).content, '완료한 답변 1', '완료되면 서버가 확정한 답으로 바꾼다');
        assert.equal(f.state.messages.filter(item => item.role === 'user').length, 1);
      } else {
        assert.equal(JSON.stringify(f.state.messages).includes('늦게 도착한 글'), false);
      }
    });
  }
});

test('실제 Provider: idle 카드 설명만 상태 확인 없이 보내고 일반 질문은 idle에서 보내지 않는다', async t => {
  const f = chatProviderFixture(t, { availability: 'idle' });
  await f.send('일반 질문');
  assert.equal(f.state.turns.length, 0);
  await f.send('카드 설명 질문', undefined, 'explanation');
  assert.equal(f.state.turns.length, 1);
  assert.deepEqual(f.state.turns[0].body, { message: '카드 설명 질문', clientState: {
    uiSettings: f.state.uiSettings, viewState: f.state.viewState } }, 'responseMode는 화면 힌트일 뿐 서버로 보내지 않는다');
  assert.equal(f.state.messages.at(-1).generationState, 'complete');
  assert.deepEqual(f.state.availability, ['online'], '실제 답변 성공이 연결 상태를 확인해 준다');
});

test('실제 Provider: idle 카드 설명의 일시 실패도 보이는 재시도 버튼으로 다시 보낼 수 있다', async t => {
  const f = chatProviderFixture(t, { availability: 'idle', outcomes: [
    { error: new ChatApiError('응답이 너무 오래 걸려 중단했어요.', { code: 'timeout', retryable: true }) }, {},
  ] });
  await f.send('카드 설명 질문', undefined, 'explanation');
  assert.equal(f.state.availability.length, 0, 'timeout은 연결 상태를 바꾸지 않아 idle이 유지된다');
  const vm = projectChatViewModel({ messages: f.state.messages, availability: 'idle', guidedTourStatus: 'idle',
    isLoading: false, retryWaitSeconds: 0, usedSuggestedQuestionKeys: new Set(), error: null });
  assert.equal(vm.rows.at(-1).canRetry, true, '재시도 버튼은 보인다');
  await f.retry();
  assert.equal(f.state.turns.length, 2, '보이는 재시도 버튼은 실제로 다시 보내야 한다');
});

test('실제 Widget submit: 서버 대기 중 버튼·Enter는 초안과 입력 이력을 지우지 않으며 본문 편집은 허용한다', async () => {
  const source = readFileSync(new URL('../../../../src/features/chat/ui/ChatWidget.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('  const submit = async (event: FormEvent<HTMLFormElement>) =>');
  const end = source.indexOf('\n  /**', start);
  assert.ok(start >= 0 && end > start);
  const ts = createRequire(import.meta.url)('typescript');
  const compiled = ts.transpileModule(source.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  for (const retryWaitSeconds of [1, 65]) {
    const effects = [];
    const canSend = projectChatViewModel({ messages: [], availability: 'online', guidedTourStatus: 'idle',
      isLoading: false, retryWaitSeconds, usedSuggestedQuestionKeys: new Set(), error: null }).canSend;
    const context = { canSend, draft: '작성 중인 새 질문', isLoading: false, retryWaitSeconds, availability: 'online',
      resetInputHistoryNavigation: value => effects.push(['history', value]), setDraft: value => effects.push(['draft', value]),
      sendMessage: async value => effects.push(['send', value]) };
    const submit = new Function(...Object.keys(context), `${compiled}\nreturn submit;`)(...Object.values(context));
    await submit({ preventDefault() {} });
    assert.deepEqual(effects, []);
  }
  assert.match(source, /disabled=\{!chatVm\.composer\.canSend \|\| draft\.trim\(\)\.length === 0\}/u);
  assert.match(source, /event\.currentTarget\.form\?\.requestSubmit\(\)/u, 'Enter도 같은 submit 가드를 사용한다');
  const textarea = source.slice(source.indexOf('<textarea'), source.indexOf('/>', source.indexOf('<textarea')));
  assert.doesNotMatch(textarea, /disabled|readOnly/u, 'cooldown은 본문 편집을 막지 않는다');
  assert.match(source, /chatVm\.composer\.showStop/u, '진행 중 요청은 명시적으로 중단할 수 있다');
});

test('실패 표시는 공개용 안내만 쓰고 오류 원문·추천·문단 액션을 렌더하지 않는다', () => {
  const failed = failedChatMessage(message('a', 'assistant', '정상 부분 답변', {
    segments: [{ markdown: '기술 오류', actions: [] }],
    actions: [{ id: 'resume', label: '이력서' }],
    suggestedQuestions: ['실패 후 추천 질문'],
    retryAllowed: true,
  }), false);
  assert.equal(failed.content, '정상 부분 답변');
  assert.equal(failed.generationState, 'failed');
  assert.equal(failed.segments, undefined);
  assert.equal(failed.actions, undefined);
  assert.equal(failed.suggestedQuestions, undefined);
  assert.equal(failed.retryAllowed, true, '재시도 가능 여부는 호출한 쪽이 정한 값을 보존한다');
  assert.equal(CHAT_FAILURE_NOTICE, '응답 생성을 완료하지 못했어요. 다시 시도해 주세요.');

  // 표현 컴포넌트의 실제 DOM 경로가 view-model의 안내만 쓰는지 함께 확인한다.
  const item = readFileSync(new URL('../../../../src/features/chat/ui/MessageItem.tsx', import.meta.url), 'utf8');
  const vm = readFileSync(new URL('../../../../src/features/chat/view-model/messageViewModel.ts', import.meta.url), 'utf8');
  assert.ok(vm.includes('message.failureNotice ?? CHAT_FAILURE_NOTICE'));
  assert.ok(item.includes('{vm.failure.notice}</p>'));
  assert.equal(item.includes('{message.failureNotice}'), false);
  const provider = readFileSync(new URL('../../../../src/features/chat/state/ChatProvider.tsx', import.meta.url), 'utf8');
  assert.match(provider, /const failureNotice = requestError instanceof ChatApiError \? requestError\.message : undefined;/u,
    'ChatApiError(공개용 문구)만 화면 안내로 쓰고 그 밖의 예외 문구는 쓰지 않는다');
  assert.match(provider, /logChatFailureLocally\("request", requestError\)/u);
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
  assert.equal(toolResultText(started, 'streaming'), '도구 호출 중… · 연구 2025년');
  assert.equal(toolResultText(started), '도구 호출 중… · 연구 2025년');
  assert.equal(toolResultDisplayStatus(started, 'complete'), 'unverified');
  assert.equal(toolResultText(started, 'complete'), '도구 호출 완료 미확인 · 연구 2025년');
  assert.equal(toolResultText({ status: 'failed', label: '다크', detail: '설정이 화면에 반영되지 않았어요' }),
    '도구 호출 실패 · 다크: 설정이 화면에 반영되지 않았어요');
});

const pickCall = { callId: 'pick-1', name: 'choose_portfolio_setting', arguments: { setting: 'accent' } };

test('실제 Provider: 선택지 도구는 말풍선에 선택지를 띄우고 같은 턴을 바로 이어 가며, 버튼은 턴 없이 설정을 바꾼다', async t => {
  const f = chatProviderFixture(t, { outcomes: [{ calls: [pickCall] }, { answer: '아래 버튼을 누르시면 바로 적용됩니다.' }] });
  await f.send('포인트 컬러 바꾸자');
  assert.deepEqual(f.state.requests.map(item => item.kind), ['turn', 'tool-results']);
  assert.deepEqual(f.state.requests[1].body.results, [{ callId: 'pick-1', ok: true,
    output: { setting: 'accent', shown: true, current: 'royalblue' } }]);
  const done = f.state.messages.at(-1);
  assert.equal(done.generationState, 'complete');
  assert.deepEqual(done.settingChoice, { callId: 'pick-1', setting: 'accent' });
  assert.deepEqual(f.state.effects, [], '선택지를 띄우는 것만으로 설정을 바꾸지 않는다');

  f.choose('accent', 'emerald');
  f.choose('accent', 'violet');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.state.effects, [['set_portfolio_accent', { accent: 'emerald' }], ['set_portfolio_accent', { accent: 'violet' }]]);
  assert.equal(f.state.uiSettings.accent, 'violet');
  assert.equal(f.state.requests.length, 2, '버튼은 서버 요청을 보내지 않는다');
});

test('실제 MessageItem 렌더: 설정 선택지는 실제 현재 값을 표시하고 연출 선택지에는 미리보기를 붙인다', () => {
  const { render } = loadMessageItem({ '../constants': { CHAT_QUICK_START_OPTION_BY_ACTION_ID: new Map() } });
  const props = {
    activeQuickDestination: null, streamAnimation: 'none', includeComplement: false,
    suggestedQuestions: [], revealCompletionControls: true,
    slowResponse: false, canRetry: false, retryWaitSeconds: 0,
    onActivateAction() {}, onAskSuggestedQuestion() {}, onRetry() {},
  };
  const settings = { theme: 'dark', accent: 'emerald', chatLayout: 'floating', chatFont: 'pretendard',
    chatFontSize: 'medium', streamAnimation: 'typewriter' };
  const buttons = html => html.split('</button>').filter(part => part.includes('class="clarificationChoice"'));
  const button = (html, label) => buttons(html).find(part => part.includes(label));
  const accent = message('c', 'assistant', '아래 버튼을 누르시면 바로 적용됩니다.',
    { generationState: 'complete', settingChoice: { callId: 'pick-1', setting: 'accent' } });
  const html = render({ ...props, message: accent, uiSettings: settings });
  assert.ok(html.includes('포인트 색상 선택지예요. 누르면 바로 적용되고, 여러 번 바꿔 볼 수 있어요.'));
  assert.equal(buttons(html).length, 6);
  assert.ok(buttons(html).every(part => !part.includes('disabled')), '턴이 끝난 뒤에도 누를 수 있다');
  assert.ok(button(html, '에메랄드').includes('aria-pressed="true"') && button(html, '에메랄드').includes('현재'));
  assert.ok(button(html, '로얄블루').includes('aria-pressed="false"'));
  assert.ok(button(html, '로즈').includes('--clarification-swatch:#e11d48'));
  assert.equal(html.includes('settingChoicePreview'), false, '연출이 아닌 선택지에는 미리보기가 없다');
  const unknown = render({ ...props, message: accent });
  assert.ok(buttons(unknown).every(part => part.includes('aria-pressed="false"')), '설정을 모르면 현재 값을 표시하지 않는다');

  const stream = render({ ...props, uiSettings: settings, message: message('s', 'assistant', '',
    { generationState: 'streaming', statusStage: 'working', settingChoice: { callId: 'pick-2', setting: 'stream_animation' } }) });
  assert.equal(buttons(stream).length, 11);
  assert.ok(stream.includes('미리보기 · 타자기'), '가리킨 버튼이 없으면 현재 연출로 미리보기한다');
});

test('실제 MessageItem 렌더: 생성 단계·실패·중단 상태를 칩과 함께 한 번씩만 표시한다', () => {
  const { render } = loadMessageItem({ '../constants': { CHAT_QUICK_START_OPTION_BY_ACTION_ID: new Map() } });
  const props = {
    activeQuickDestination: null, streamAnimation: 'none', includeComplement: false,
    suggestedQuestions: [], revealCompletionControls: true,
    slowResponse: false, canRetry: true, retryWaitSeconds: 0,
    onActivateAction() {}, onAskSuggestedQuestion() {}, onRetry() {},
  };
  const chip = { callId: 'theme-1', tool: 'set_portfolio_theme', label: '화면 모드 · 다크', status: 'applied' };
  const normal = render({ ...props, message: message('b', 'assistant', '모델이 만든 자연어 설명',
    { generationState: 'complete', toolResults: [chip] }) });
  assert.ok(normal.includes('모델이 만든 자연어 설명'));
  assert.ok(normal.includes('class="markdownMessage"'));
  assert.ok(normal.includes('data-tool-status="applied">도구 호출 · 화면 모드 · 다크'));
  for (const [statusStage, label] of [[undefined, '응답 생성 중'], ['searching', '자료 찾는 중'], ['working', '화면 조작 중']]) {
    const loading = render({ ...props, message: message('loading', 'assistant', '', { generationState: 'streaming', statusStage }) });
    assert.ok(loading.includes(label));
    assert.ok(loading.includes('<span class="generationDots" aria-hidden="true"><span></span><span></span><span></span></span>'));
    assert.equal((loading.match(/role="status"/gu) ?? []).length, 1);
    assert.equal((loading.match(/aria-live="polite"/gu) ?? []).length, 1);
    assert.equal(loading.includes('messageText'), false, '생성 안내를 본문으로 중복 표시하지 않는다');
    assert.equal(loading.includes('role="alert"'), false);
  }
  for (const state of ['complete', 'failed', 'stopped']) {
    assert.equal(render({ ...props, message: message('done', 'assistant', '본문', { generationState: state }) })
      .includes('generationDots'), false);
  }
  const working = render({ ...props, message: message('tools', 'assistant', '', {
    generationState: 'streaming', statusStage: 'working', toolResults: [chip] }) });
  const toolsEnd = working.indexOf('</div>', working.indexOf('aria-label="화면 도구 실행 결과"'));
  assert.ok(toolsEnd >= 0);
  assert.ok(working.indexOf('role="status"') > toolsEnd, '진행 상태는 도구 결과 아래에 표시한다');
  const widgetCss = readFileSync(new URL('../../../../src/features/chat/ui/ChatWidget.module.css', import.meta.url), 'utf8');
  const widget = readFileSync(new URL('../../../../src/features/chat/ui/ChatWidget.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(widget, /className=\{styles\.loading\}/u, '생성 안내는 하단에서 중복하지 않는다');
  assert.match(widget, /retryWaitSeconds=\{row\.retryWaitSeconds\}/u,
    '대기는 마지막 활성 말풍선에만 전달하며 이전 실패 말풍선에 붙이지 않는다');
  assert.match(widgetCss, /\.generationDots span\s*\{[^}]*animation:\s*generationDot 1\.2s[^}]*infinite/u);
  const failed = render({ ...props, message: failedChatMessage(message('c', 'assistant', '', { toolResults: [chip] }), true) });
  assert.ok(failed.includes('data-tool-status="applied"'));
  assert.ok(failed.includes(`${CHAT_FAILURE_NOTICE} 이미 바뀐 화면은 그대로 유지됩니다.`));
  assert.ok(failed.includes('다시 시도'));
  const waiting = render({ ...props, retryWaitSeconds: 9, message: failedChatMessage(message('w', 'assistant', ''), true) });
  assert.match(waiting, /<button type="button" disabled="">9초 후 다시 시도<\/button>/u);
  const mixedResults = Object.freeze(['started', 'arrived', 'applied', 'failed'].map(status =>
    Object.freeze({ callId: status, tool: 'control_portfolio_view', label: `${status} 작업`, status })));
  const stopped = render({ ...props, message: message('stopped', 'assistant', '', {
    generationState: 'stopped', toolResults: mixedResults,
  }) });
  assert.ok(stopped.includes('응답 생성이 중단되었습니다'));
  assert.ok(stopped.includes('data-tool-status="stopped">도구 호출 중단 · started 작업'));
  assert.equal(stopped.includes('도구 호출 중…'), false);
  assert.equal(stopped.includes('data-tool-status="started"'), false);
  for (const status of ['arrived', 'applied', 'failed']) assert.ok(stopped.includes(`data-tool-status="${status}"`));
  assert.deepEqual(mixedResults.map(result => result.status), ['started', 'arrived', 'applied', 'failed']);
  const notice = render({ ...props, message: message('n', 'assistant', '이전 대화가 만료되었습니다.', {
    kind: 'chat_notice', generated: false, generationState: 'complete' }) });
  assert.match(notice, /data-response-provenance="application"/u, '앱 안내는 모델 답변과 출처를 구분한다');
});

test('추천 생략 말풍선은 문단·하단·빠른 시작 보완·후속 질문만 숨기고 모델 본문·결과 칩은 보존한다', () => {
  const { render, summaryActionsForMessage } = loadMessageItem({ '../constants': { CHAT_QUICK_START_OPTION_BY_ACTION_ID } });
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
    const html = render({ ...props, message: suppressed });
    assert.ok(html.includes('모델이 만든 현재 시간 답변'));
    assert.ok(html.includes('data-tool-status="applied"'));
    assert.equal(html.includes('<nav'), false);
    assert.equal(html.includes('<button'), false);
    for (const flag of [undefined, false]) {
      const ordinary = { ...base, ...(flag === false ? { recommendationsSuppressed: false } : {}) };
      const normal = render({ ...props, message: ordinary });
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

test('localhost 로그도 원문·Error·질문·요청·스택을 포함하지 않는다', () => {
  const error = new ChatApiError('secret question and backend stack', {
    code: 'upstream_timeout', retryAfterMs: 10_000,
  });
  error.headers = { Authorization: 'secret' };
  error.request = { message: 'secret', body: 'secret' };
  const calls = [];
  logChatFailureLocally('request', error, 'localhost', (...args) => calls.push(args));
  assert.deepEqual(calls, [['채팅 진단', {
    stage: 'request', type: 'ChatApiError', code: 'upstream_timeout', retryAfterMs: 10_000,
  }]]);
  assert.equal(JSON.stringify(calls).includes('secret'), false);
  logChatFailureLocally('tool', new Error('secret'), '::1', (...args) => calls.push(args));
  assert.deepEqual(calls[1], ['채팅 진단', { stage: 'tool', type: 'unknown' }]);
  logChatFailureLocally('request', new ChatApiError('secret', { code: 'secret_token' }),
    '127.0.0.1', (...args) => calls.push(args));
  assert.equal(calls[2][1].code, 'unknown');
  for (const code of ['session_not_found', 'session_busy', 'upstream_auth', 'step_limit']) {
    logChatFailureLocally('request', new ChatApiError('x', { code }), 'localhost', (...args) => calls.push(args));
    assert.equal(calls.at(-1)[1].code, code);
  }
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
