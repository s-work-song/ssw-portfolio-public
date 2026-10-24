import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as chatParse from './parse.ts';
import {
  CLARIFICATION_CANCEL_MESSAGE, CLARIFICATION_PROTOCOL, ChatClarificationSession,
  clarificationAccentColors, clarificationChoiceLabel, clarificationChoicePrompt, clarificationCurrentValue,
  clarificationQuestion, clarificationValues, isExplicitClarificationCancel, parseChatClarification,
} from './chatClarification.ts';
import { historyFromMessages } from './chatHistory.ts';
import { expectedToolTaskScope, stepFromExecution } from './toolTaskRuntime.ts';
import { fourToolReportCase, providerReportFixture } from './toolReportFixtures.mjs';
import { ACCENTS as ACCENT_PALETTE } from '../../context/accentPalette.ts';
import { THEMES, ACCENTS } from '../portfolio-tools/settings.ts';
import { CHAT_FAILURE_NOTICE } from './chatFailure.ts';
import { toolResultDisplayStatus, toolResultText } from './toolResultPresentation.ts';

const req = (extra = {}) => ({ message: '테마를 바꿔줘', history: [], conversationId: 'clarify-conversation', turnId: 'clarify-turn',
  toolTask: { schemaVersion: 'portfolio-tool-task-v1', taskId: 'clarify-task', generation: 1 },
  clarificationProtocol: CLARIFICATION_PROTOCOL, audience: 'default', tone: 'official', pageContext: 'default', ...extra });

function clarificationFor(request, options = {}) {
  const previous = request.clarificationReply;
  const reason = options.reason ?? 'missing_value';
  const target = Object.hasOwn(options, 'target') ? options.target : 'set_portfolio_theme';
  const question = clarificationQuestion({ target, reason });
  const exchanges = previous ? [...previous.continuation.exchanges, { reason: previous.reason, target: previous.target,
    reply: request.message, ...(previous.choiceValue === undefined ? {} : { choiceValue: previous.choiceValue }) }] : [];
  return { schemaVersion: CLARIFICATION_PROTOCOL, id: request.turnId, reason, target, question,
    choices: clarificationValues({ reason, target }).map(value => ({ value, label: clarificationChoiceLabel({ target }, value) })),
    continuation: { conversationId: request.conversationId, originTurnId: previous?.continuation.originTurnId ?? request.turnId,
      originalMessage: previous?.continuation.originalMessage ?? request.message, exchanges,
      sourceTurnId: request.turnId, sourceTaskId: request.toolTask?.taskId ?? null,
      sourceGeneration: request.toolTask?.generation ?? null } };
}

function clarificationResponse(request, options = {}) {
  const clarification = clarificationFor(request, options);
  return { mode: 'clarification', status: 'online', generated: false, answer: clarification.question,
    segments: [{ markdown: clarification.question, actions: [] }], audience: 'default', tone: 'official', pageContext: 'default',
    sources: [], actions: [], suggestedQuestions: [], toolExecutions: [], uiOnly: true, uiToolOutcome: 'not_required', cached: false,
    modelHistory: [{ role: 'assistant', content: clarification.question }], clarification,
    toolTask: { ...expectedToolTaskScope(request), status: 'not_required', steps: [], dispatchComplete: true } };
}

const normalResponse = request => ({ mode: 'model', status: 'online', generated: true, answer: '새 질문에 대한 답변입니다.',
  segments: [], audience: 'default', tone: 'official', pageContext: 'default', actions: [], suggestedQuestions: [],
  toolExecutions: [], cached: false, toolTask: { ...expectedToolTaskScope(request), status: 'not_required', steps: [], dispatchComplete: true } });

function singleSettingCase(target = 'set_portfolio_theme', value = 'dark') {
  const f = fourToolReportCase();
  const [field, setting] = {
    set_portfolio_theme: ['theme', 'theme'], set_portfolio_accent: ['accent', 'accent'],
    set_portfolio_chat_layout: ['layout', 'chatLayout'], set_portfolio_chat_font: ['font', 'chatFont'],
    set_portfolio_chat_font_size: ['size', 'chatFontSize'], set_portfolio_stream_animation: ['animation', 'streamAnimation'],
  }[target];
  const input = { [field]: value };
  const call = { id: 'original_native_setting_01', type: 'function', function: { name: target, arguments: ` ${JSON.stringify(input)}\n` } };
  f.calls = [call];
  f.executions = [{ type: target, toolName: target, toolCallId: call.id, ...input,
    toolTask: { ...f.scope, stepIndex: 0, source: 'native', dispatchStatus: 'accepted' } }];
  f.steps = f.executions.map(stepFromExecution);
  f.native = [{ role: 'assistant', content: null, tool_calls: [call] }, { role: 'tool', tool_call_id: call.id, content: '{"accepted":true}' }];
  f.results = [{ toolCallId: call.id, toolName: target, stepIndex: 0, status: 'applied', elapsedMs: 500 }];
  f.latest.uiSettings[setting] = value;
  f.request = { ...f.request, toolTask: { ...f.request.toolTask, steps: f.steps } };
  return f;
}

test('선택 prompt는 6개 설정의 모든 정본 값을 대상과 한 문장에 묶고 자연스러운 조사를 쓴다', () => {
  const expected = {
    set_portfolio_theme: {
      light: '화면 모드를 라이트로 변경해 줘.', dark: '화면 모드를 다크로 변경해 줘.', system: '화면 모드를 시스템으로 변경해 줘.',
    },
    set_portfolio_accent: {
      blue: '포인트 색상을 로얄블루로 변경해 줘.', indigo: '포인트 색상을 인디고로 변경해 줘.',
      emerald: '포인트 색상을 에메랄드로 변경해 줘.', amber: '포인트 색상을 앰버로 변경해 줘.',
      rose: '포인트 색상을 로즈로 변경해 줘.', violet: '포인트 색상을 바이올렛으로 변경해 줘.',
    },
    set_portfolio_chat_layout: {
      floating: '채팅 배치를 플로팅으로 변경해 줘.', dock: '채팅 배치를 오른쪽 고정으로 변경해 줘.',
    },
    set_portfolio_chat_font: {
      pretendard: '채팅 글꼴을 프리텐다드로 변경해 줘.', 'noto-sans-kr': '채팅 글꼴을 노토 산스 KR로 변경해 줘.',
      system: '채팅 글꼴을 시스템으로 변경해 줘.',
    },
    set_portfolio_chat_font_size: {
      small: '채팅 글자 크기를 작게 변경해 줘.', medium: '채팅 글자 크기를 보통으로 변경해 줘.',
      large: '채팅 글자 크기를 크게 변경해 줘.', xlarge: '채팅 글자 크기를 매우 크게 변경해 줘.',
    },
    set_portfolio_stream_animation: {
      none: '스트리밍 연출을 없음으로 변경해 줘.', typewriter: '스트리밍 연출을 타자기로 변경해 줘.',
      'word-fade': '스트리밍 연출을 단어 페이드로 변경해 줘.', 'token-chunks': '스트리밍 연출을 토큰 청크로 변경해 줘.',
      'blur-focus': '스트리밍 연출을 블러 포커스로 변경해 줘.', 'slide-up': '스트리밍 연출을 슬라이드 업으로 변경해 줘.',
      skeleton: '스트리밍 연출을 스켈레톤으로 변경해 줘.', 'mask-wipe': '스트리밍 연출을 마스크 와이프로 변경해 줘.',
      scramble: '스트리밍 연출을 스크램블로 변경해 줘.', 'letter-drop': '스트리밍 연출을 레터 드롭으로 변경해 줘.',
      'highlight-trail': '스트리밍 연출을 하이라이트 트레일로 변경해 줘.',
    },
  };
  assert.deepEqual(Object.keys(expected), [...clarificationValues({ target: null, reason: 'ambiguous_target' })]);
  let count = 0;
  for (const [target, values] of Object.entries(expected)) {
    const clarification = clarificationFor(req(), { target });
    const original = structuredClone(clarification);
    assert.deepEqual(Object.keys(values), clarification.choices.map(choice => choice.value));
    for (const [value, prompt] of Object.entries(values)) {
      assert.equal(clarificationChoicePrompt(clarification, value), prompt);
      assert.equal((prompt.match(/\./g) ?? []).length, 1);
      assert.equal(prompt.includes('선택한 값:'), false);
      count++;
    }
    assert.deepEqual(clarification, original, '선택 메타데이터나 질문·원문을 바꾸지 않는다');
    assert.equal(clarificationChoicePrompt(clarification, 'unknown-value'), undefined);
  }
  assert.equal(count, 29);
  const targetOnly = clarificationFor(req(), { target: null, reason: 'ambiguous_target' });
  assert.equal(clarificationChoicePrompt(targetOnly, 'set_portfolio_chat_font'), '채팅 글꼴 설정을 변경하고 싶어.');
});

test('명료화는 opt-in 정상 완료이며 질문 한 개와 무도구 manifest를 정확히 보존한다', () => {
  const request = req();
  const raw = clarificationResponse(request);
  const parsed = chatParse.parseChatResponse(raw, request);
  assert.equal(parsed.mode, 'clarification');
  assert.equal(parsed.generated, false);
  assert.equal(parsed.recommendationsSuppressed, true);
  assert.deepEqual(parsed.clarification, raw.clarification);
  assert.deepEqual(parsed.modelHistory, [{ role: 'assistant', content: raw.answer }]);
  assert.deepEqual(parsed.toolExecutions, []);
  assert.equal(parsed.toolTask.status, 'not_required');
  assert.deepEqual(parsed.toolTask.steps, []);
  assert.throws(() => chatParse.parseChatResponse(raw, { ...request, clarificationProtocol: undefined }));
  assert.throws(() => chatParse.parseChatResponse(raw, { ...request, toolVerification: { results: [] } }));
  assert.equal(chatParse.parseChatResponse(normalResponse(request), request).mode, 'model', '구형 API 응답은 계속 읽는다');
});

test('명료화에 도구·가짜 완료·추천·변조된 scope/history를 섞으면 질문 카드로 승격하지 않는다', () => {
  const request = req();
  for (const mutate of [
    value => { value.generated = true; }, value => { value.cached = true; }, value => { value.status = 'upstream_offline'; },
    value => { value.answer = '이미 바꿨어요'; }, value => { value.uiToolOutcome = 'not_called'; }, value => { value.uiOnly = false; },
    value => { value.actions = [{ id: 'settings', label: '설정' }]; }, value => { value.suggestedQuestions = ['설명해 줘']; },
    value => { value.toolExecutions = singleSettingCase().executions; }, value => { value.sources = [{}]; },
    value => { value.toolFollowup = { explanationRequested: true }; }, value => { value.segments[0].actions = [{ id: 'settings' }]; },
    value => { value.modelHistory.push({ role: 'assistant', content: '추가 문구' }); },
    value => { value.modelHistory[0].content = '다른 질문'; }, value => { value.modelHistory[0].tool_calls = []; },
    value => { value.modelHistory[0].private = 'private'; }, value => { value.toolTask.status = 'failed'; },
    value => { value.clarification.continuation.conversationId = 'old-conversation'; },
    value => { value.clarification.continuation.sourceTurnId = 'old-turn'; },
    value => { value.clarification.continuation.sourceTaskId = 'old-task'; },
    value => { value.clarification.continuation.sourceGeneration = 2; },
    value => { value.mode = 'model'; value.generated = true; },
  ]) {
    const raw = clarificationResponse(request); mutate(raw);
    assert.throws(() => chatParse.parseChatResponse(raw, request));
  }
});

test('명료화 옵션은 정본 값·순서·라벨만 허용하며 원문과 21개 이상 보충 교환을 자르지 않는다', () => {
  for (const target of [null, ...clarificationValues({ target: null, reason: 'ambiguous_target' })]) {
    const value = clarificationFor(req(), { target, reason: target ? 'missing_value' : 'ambiguous_target' });
    assert.deepEqual(parseChatClarification(value, req()), value);
    if (value.choices.length > 1) {
      const reversed = structuredClone(value); reversed.choices.reverse();
      assert.equal(parseChatClarification(reversed), undefined);
      const duplicate = structuredClone(value); duplicate.choices[1] = duplicate.choices[0];
      assert.equal(parseChatClarification(duplicate), undefined);
    }
  }
  for (const mutate of [
    value => { value.choices[0].label = '<script>run()</script>'; },
    value => { value.choices[0].color = '#ff0000'; }, value => { value.choices[0].value = 'red'; },
    value => { value.choices.pop(); }, value => { value.target = 'execute_shell'; },
    value => { value.id += '\n'; }, value => { value.continuation.originTurnId += '\r'; },
    value => { value.continuation.sourceGeneration = 0; }, value => { value.continuation.sourceTaskId = null; },
    value => { value.continuation.exchanges = [{ reason: 'missing_value', target: 'set_portfolio_theme', reply: 'private', choiceValue: 'red' }]; },
    value => { value.question = '다른 확인 질문'; },
    value => { value.target = null; value.choices = []; },
    value => { value.continuation.exchanges = [{ reason: 'missing_value', target: null, reply: 'private' }]; },
  ]) {
    const value = clarificationFor(req()); mutate(value);
    assert.equal(parseChatClarification(value), undefined);
  }
  const value = clarificationFor(req({ message: '원문 '.repeat(10_000) }));
  value.continuation.exchanges = Array.from({ length: 25 }, (_, index) => ({ reason: 'missing_value', target: 'set_portfolio_theme',
    reply: `원래 보충 답변 ${index}`, choiceValue: 'dark' }));
  assert.deepEqual(parseChatClarification(value, req()), value);
  assert.equal(parseChatClarification(value).continuation.exchanges.length, 25);
  assert.deepEqual(parseChatClarification(clarificationFor(req(), { target: null, reason: 'unintelligible' })).choices, []);
});

test('명료화 세션은 local epoch·최신 완료 말풍선에만 한 번 연결하고 새 task 세대는 다루지 않는다', () => {
  const value = clarificationFor(req());
  const source = { id: 'assistant-1', role: 'assistant', kind: 'message', content: value.question, generationState: 'complete', clarification: value };
  const session = new ChatClarificationSession();
  const first = session.activate(source.id, value);
  assert.equal(session.matches(source.id, first.epoch, [source]), true);
  const reply = session.consume(source.id, first.epoch, [source], 'dark');
  assert.deepEqual(reply, { ...value, choiceValue: 'dark' });
  assert.equal(Object.isFrozen(reply.continuation.exchanges), true);
  assert.equal(session.consume(source.id, first.epoch, [source], 'dark'), undefined);
  const second = session.activate(source.id, value);
  assert.notEqual(second.epoch, first.epoch);
  assert.equal(session.consume(source.id, first.epoch, [source]), undefined);
  assert.equal(session.consume(source.id, second.epoch, [source, { id: 'new-user', role: 'user' }]), undefined);
  session.clear();
  assert.equal(session.current, null);
  for (const text of ['취소', '됐어', '안 바꿀래', '안바꿀래']) assert.equal(isExplicitClarificationCancel(text), true);
  for (const text of ['취소 방법 알려줘', '이전 변경 취소해줘', '됐어 다음은 라이트로', '취소하고 파랑으로', '취소 말고 다크']) {
    assert.equal(isExplicitClarificationCancel(text), false);
  }
});

function fixtureApi(fetchFixture) {
  const require = createRequire(import.meta.url);
  const ts = require('typescript');
  const source = readFileSync(new URL('./api.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const api = { exports: {} };
  new Function('require', 'module', 'exports', 'fetch', 'process', compiled)(
    name => name === './parse' ? chatParse : require(name), api, api.exports, fetchFixture,
    { env: { NEXT_PUBLIC_RAG_API_BASE_URL: 'https://fixture.invalid' } });
  return api.exports;
}

test('실제 JSON/SSE API는 명료화를 정상 done으로 받고 도구 callback을 한 번도 부르지 않는다', async () => {
  const request = req();
  const raw = clarificationResponse(request);
  for (const streaming of [false, true]) {
    let tools = 0;
    const api = fixtureApi(async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.clarificationProtocol, CLARIFICATION_PROTOCOL);
      assert.deepEqual(body.history, request.history);
      return streaming ? new Response([
      ['meta', { toolTask: { ...expectedToolTaskScope(request), status: 'running' } }], ['delta', { text: raw.answer }], ['done', raw],
    ].map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } }) : Response.json(raw);
    });
    const result = streaming ? await api.requestChatStream(request, new AbortController().signal,
      { onDelta() {}, onTool() { tools++; } }) : await api.requestChat(request, new AbortController().signal);
    assert.equal(result.mode, 'clarification');
    assert.equal(tools, 0);
    assert.deepEqual(result.clarification, raw.clarification);
  }
});

test('실제 Provider: theme3·accent6 선택 전 변경0, 선택은 새 turn/task와 기존 browser report를 통과한다', async t => {
  for (const [target, values] of [['set_portfolio_theme', THEMES], ['set_portfolio_accent', ACCENTS]]) {
    for (const value of values) {
      await t.test(`${target} ${value}`, async t => {
        const f = providerReportFixture(t, { fixture: singleSettingCase(target, value), streaming: value !== 'light',
          requestOutcomes: [{ response: request => clarificationResponse(request, { target }) }] });
        const original = '설정을 바꿔 주고 변경한 내용도 설명해 줘.';
        await f.send(original);
        const active = f.state.pendingClarification;
        assert.ok(active);
        assert.equal(f.state.messages.at(-1).generationState, 'complete');
        assert.equal(f.state.effects.length, 0);
        assert.equal(f.state.reportRequests.length, 0);
        assert.equal(f.state.telemetry.length, 0);
        const question = f.state.messages.at(-1).content;
        const firstRequest = f.state.requests[0];
        await f.choose(active.messageId, active.epoch, value);
        assert.equal(f.state.effects.length, 1);
        assert.equal(f.state.reportRequests.length, 1);
        const selected = f.state.requests[1];
        assert.equal(selected.responseMode, 'default');
        assert.equal(selected.clarificationProtocol, CLARIFICATION_PROTOCOL);
        assert.deepEqual(selected.clarificationReply, { ...active.clarification, choiceValue: value });
        assert.equal(selected.clarificationReply.continuation.originalMessage, original);
        assert.equal(selected.conversationId, firstRequest.conversationId);
        assert.notEqual(selected.turnId, firstRequest.turnId);
        assert.notEqual(selected.toolTask.taskId, firstRequest.toolTask.taskId);
        assert.equal(selected.toolTask.generation, 1);
        assert.deepEqual(selected.history, [{ role: 'user', content: original }, { role: 'assistant', content: question }]);
        assert.equal(selected.message, clarificationChoicePrompt(active.clarification, value));
        assert.equal(f.state.messages.find(item => item.role === 'user' && item.content !== original).content, selected.message);
        assert.deepEqual(f.state.reportRequests[0].clarificationReply, selected.clarificationReply);
        assert.equal(Object.isFrozen(f.state.reportRequests[0].clarificationReply.continuation), true);
        assert.deepEqual(f.state.reportRequests[0].toolHistory[0].tool_calls, f.calls);
        assert.equal(f.state.messages.at(-1).generationState, 'complete');
        assert.equal(f.state.pendingClarification, null);
      });
    }
  }
});

test('실제 Provider: 라이트로·두번째·보이는 정본 라벨을 그대로 보내고 choiceValue를 합성하지 않는다', async t => {
  for (const [text, value] of [['라이트로', 'light'], ['두번째', 'dark'], ['시스템', 'system']]) {
    const f = providerReportFixture(t, { fixture: singleSettingCase('set_portfolio_theme', value),
      requestOutcomes: [{ response: request => clarificationResponse(request) }] });
    await f.send('화면 모드를 바꾸고 결과를 알려줘');
    const active = f.state.pendingClarification;
    await f.send(text);
    assert.equal(f.state.requests[1].message, text);
    assert.deepEqual(f.state.requests[1].clarificationReply, active.clarification);
    assert.equal(Object.hasOwn(f.state.requests[1].clarificationReply, 'choiceValue'), false);
    assert.equal(f.state.effects.length, 1);
  }
});

test('실제 Provider: 항목 질문 뒤 값 질문도 원복합요청·질문·사용자 선택 순서를 그대로 이어간다', async t => {
  const f = providerReportFixture(t, { fixture: singleSettingCase(), requestOutcomes: [
    { response: request => clarificationResponse(request, { target: null, reason: 'ambiguous_target' }) },
    { response: request => clarificationResponse(request) },
  ] });
  const original = '색을 바꾸고 결과를 설명해 줘';
  await f.send(original);
  const first = f.state.pendingClarification;
  await f.choose(first.messageId, first.epoch, 'set_portfolio_theme');
  assert.equal(f.state.effects.length, 0);
  const second = f.state.pendingClarification;
  assert.notEqual(second.epoch, first.epoch);
  assert.equal(second.clarification.continuation.originalMessage, original);
  assert.equal(second.clarification.continuation.originTurnId, first.clarification.continuation.originTurnId);
  assert.deepEqual(second.clarification.continuation.exchanges, [{ reason: 'ambiguous_target', target: null,
    reply: f.state.requests[1].message, choiceValue: 'set_portfolio_theme' }]);
  await f.choose(first.messageId, first.epoch, 'set_portfolio_theme');
  assert.equal(f.state.requests.length, 2, '이전 질문의 늦은 버튼은 새 요청을 만들지 않는다');
  await f.choose(second.messageId, second.epoch, 'dark');
  assert.equal(f.state.effects.length, 1);
  assert.deepEqual(f.state.requests[2].history.map(item => item.content), [original, first.clarification.question,
    f.state.requests[1].message, second.clarification.question]);
});

test('실제 Provider/MessageItem: 같은 질문이 다시 와도 최신 선택만 활성화하고 이전 버튼은 재실행하지 않는다', async t => {
  const { render } = messageItemRenderer();
  for (const streaming of [false, true]) {
    for (const [target, value, setting, before] of [
      ['set_portfolio_theme', 'system', 'theme', 'light'],
      ['set_portfolio_accent', 'amber', 'accent', 'blue'],
      ['set_portfolio_chat_font', 'noto-sans-kr', 'chatFont', 'pretendard'],
    ]) {
      await t.test(`${streaming ? 'SSE' : 'JSON'} ${target}`, async t => {
        const f = providerReportFixture(t, { fixture: singleSettingCase(target, value), streaming,
          requestOutcomes: [
            { response: request => clarificationResponse(request, { target }) },
            { response: request => clarificationResponse(request, { target }) },
          ] });
        f.state.uiSettings[setting] = before;
        const original = '설정을 바꾸고 결과를 알려줘';
        await f.send(original);
        const first = f.state.pendingClarification;
        await f.choose(first.messageId, first.epoch, value);
        const latest = f.state.pendingClarification;
        assert.ok(latest, '재질문 완료 후 pending을 소모된 이전 상태로 남기지 않는다');
        assert.notEqual(latest.messageId, first.messageId);
        assert.notEqual(latest.epoch, first.epoch);
        assert.equal(latest.clarification.question, first.clarification.question);
        assert.equal(latest.clarification.continuation.originalMessage, original);
        assert.equal(f.refs.clarificationSessionRef.current.matches(latest.messageId, latest.epoch, f.state.messages), true);
        assert.equal(f.state.effects.length, 0);
        assert.equal(f.state.uiSettings[setting], before);
        assert.equal(f.state.reportRequests.length, 0);
        const questions = f.state.messages.filter(message => message.clarification);
        assert.equal(questions.length, 2);
        assert.equal(questions[0].clarificationState, 'closed');
        assert.equal(questions[1].clarificationState, undefined);
        const html = questions.map(message => render({ message,
          activeQuickDestination: null, streamAnimation: 'none', includeComplement: false, suggestedQuestions: [],
          revealCompletionControls: false, slowResponse: false, canRetry: false, retryWaitSeconds: 0,
          clarificationEpoch: latest.messageId === message.id ? latest.epoch : undefined,
          clarificationSettings: f.state.uiSettings, clarificationCanSubmit: true,
          onActivateAction() {}, onAskSuggestedQuestion() {}, onRetry() {},
          onClarificationChoice: f.choose, onClarificationCancel: f.cancelClarification,
        }));
        assert.ok(html[0].includes('data-clarification-state="closed"'));
        assert.ok(html[0].includes('이전 선택 안내입니다.'));
        assert.equal((html[0].match(/disabled=""/g) ?? []).length, first.clarification.choices.length);
        assert.ok(html[1].includes('data-clarification-state="active"'));
        assert.equal(html[1].includes('이전 선택 안내입니다.'), false);
        assert.equal(html[1].includes('disabled=""'), false);
        assert.equal(html[1].includes('role="alert"'), false);
        await f.choose(first.messageId, first.epoch, value);
        assert.equal(f.state.requests.length, 2, '옛 질문의 늦은 클릭은 무시한다');
        await f.choose(latest.messageId, latest.epoch, value);
        assert.equal(f.state.effects.length, 1);
        assert.equal(f.state.uiSettings[setting], value);
        assert.equal(f.state.reportRequests.length, 1);
        assert.deepEqual(f.state.reportRequests[0].toolHistory[0].tool_calls, f.calls);
        assert.equal(f.state.messages.at(-1).generationState, 'complete');
      });
    }
  }
});

test('실제 Provider: 취소버튼·명시 취소는 모델/도구0이고 다음 짧은 답을 옛 복합요청에 결속하지 않는다', async t => {
  for (const method of ['button', '취소', '됐어', '안 바꿀래', '안바꿀래']) {
    const f = providerReportFixture(t, { fixture: singleSettingCase('set_portfolio_theme', 'light'),
      requestOutcomes: [{ response: request => clarificationResponse(request) }] });
    await f.send('테마와 글꼴을 바꿔 줘');
    const active = f.state.pendingClarification;
    if (method === 'button') f.cancelClarification(active.messageId, active.epoch);
    else await f.send(method);
    assert.equal(f.state.pendingClarification, null);
    assert.equal(f.state.requests.length, 1);
    assert.equal(f.state.effects.length, 0);
    assert.equal(f.state.messages.at(-1).content, method === 'button' ? CLARIFICATION_CANCEL_MESSAGE : method);
    assert.equal(f.state.messages.at(-2).clarificationState, 'cancelled');
    await f.choose(active.messageId, active.epoch, 'dark');
    assert.equal(f.state.requests.length, 1);
    await f.send('라이트로');
    assert.equal(f.state.requests[1].message, '라이트로');
    assert.equal(f.state.requests[1].clarificationReply, undefined);
    assert.ok(f.state.requests[1].history.some(item => item.content === (method === 'button' ? CLARIFICATION_CANCEL_MESSAGE : method)));
  }
});

test('실제 Provider: 선택 더블클릭·진행 중 클릭·새 주제 뒤 옛 버튼은 중복 요청이나 설정 변경을 만들지 않는다', async t => {
  const f = providerReportFixture(t, { fixture: singleSettingCase(), requestOutcomes: [
    { response: request => clarificationResponse(request) }, { wait: true },
  ] });
  await f.send('테마 바꿔줘');
  const active = f.state.pendingClarification;
  const running = f.choose(active.messageId, active.epoch, 'dark');
  await f.untilRequest(2);
  await f.choose(active.messageId, active.epoch, 'dark');
  await f.choose(active.messageId, active.epoch, 'light');
  assert.equal(f.state.requests.length, 2);
  assert.equal(f.state.effects.length, 0);
  f.state.finishInitial(); await running;
  assert.equal(f.state.effects.length, 1);
  await f.choose(active.messageId, active.epoch, 'dark');
  assert.equal(f.state.requests.filter(item => !item.toolVerification).length, 2);
  const next = providerReportFixture(t, { requestOutcomes: [
    { response: request => clarificationResponse(request) }, { response: normalResponse },
  ] });
  await next.send('테마 바꿔줘');
  const old = next.state.pendingClarification;
  await next.send('이제 연구 경험을 설명해 줘');
  assert.deepEqual(next.state.requests[1].clarificationReply, old.clarification, '새 주제 판정 자료는 서버에 전달한다');
  assert.equal(next.state.pendingClarification, null);
  await next.choose(old.messageId, old.epoch, 'dark');
  assert.equal(next.state.requests.length, 2);
  assert.equal(next.state.effects.length, 0);
});

test('실제 Provider: 새 대화·unmount 뒤 늦은 명료화 완료는 선택권을 되살리지 않는다', async t => {
  for (const action of ['reset', 'unmount']) {
    const f = providerReportFixture(t, { requestOutcomes: [{ wait: true, ignoreAbort: true, response: clarificationResponse }] });
    const running = f.send('테마 바꿔줘');
    await f.untilRequest();
    if (action === 'reset') f.reset();
    else f.refs.mountedRef.current = false;
    f.state.finishInitial(); await running;
    assert.equal(f.state.pendingClarification, null);
    assert.equal(f.state.effects.length, 0);
    if (action === 'reset') assert.deepEqual(f.state.messages, []);
  }
});

test('실제 Provider: 실패 재시도는 새 선택권 없이 동일 보충원문을 보존하고 보고 재시도는 도구를 반복하지 않는다', async t => {
  const f = providerReportFixture(t, { fixture: singleSettingCase(), requestOutcomes: [
    { response: clarificationResponse }, { error: new chatParse.ChatApiError('private', { code: 'network', retryExhausted: true }) },
  ], reportOutcomes: [{ error: new chatParse.ChatApiError('private', { code: 'timeout' }) }] });
  await f.send('테마를 바꾸고 변경 이유도 설명해 줘');
  const active = f.state.pendingClarification;
  await f.choose(active.messageId, active.epoch, 'dark');
  assert.equal(f.state.messages.at(-1).generationState, 'failed');
  assert.equal(f.state.pendingClarification, null);
  const selected = structuredClone(f.state.requests[1]);
  await f.choose(active.messageId, active.epoch, 'dark');
  assert.equal(f.state.requests.length, 2);
  f.advanceTime(1_000); await f.retry();
  assert.deepEqual(f.state.requests[2].clarificationReply, selected.clarificationReply);
  assert.equal(f.state.requests[2].turnId, selected.turnId);
  assert.equal(f.state.requests[2].toolTask.taskId, selected.toolTask.taskId);
  assert.equal(f.state.requests[2].toolTask.generation, 2);
  assert.equal(f.state.effects.length, 1);
  assert.equal(f.state.reportRequests.length, 2);
  assert.deepEqual(f.state.reportRequests[1], f.state.reportRequests[0]);
  assert.equal(f.state.messages.at(-1).generationState, 'complete');
});

test('실제 Provider: 보고 용량 복구에서 history가 줄어도 복합 원문·보충문맥·native 원문은 고정된다', async t => {
  const messages = Array.from({ length: 6 }, (_, index) => [
    { id: `old-u-${index}`, role: 'user', kind: 'message', content: `이전 질문 ${index}` },
    { id: `old-a-${index}`, role: 'assistant', kind: 'message', content: `이전 답변 ${index}`, generationState: 'complete' },
  ]).flat();
  const f = providerReportFixture(t, { fixture: singleSettingCase(), messages,
    requestOutcomes: [{ response: clarificationResponse }],
    reportOutcomes: [{ error: new chatParse.ChatApiError('private', { code: 'context_length_exceeded', httpStatus: 400 }) }] });
  const original = '테마를 바꾸고 변경 후 현재 설정도 설명해 줘';
  await f.send(original);
  const active = f.state.pendingClarification;
  await f.choose(active.messageId, active.epoch, 'dark');
  assert.equal(f.state.reportRequests.length, 2);
  assert.ok(f.state.reportRequests[1].history.length < f.state.reportRequests[0].history.length);
  assert.deepEqual(f.state.reportRequests[1].clarificationReply, f.state.reportRequests[0].clarificationReply);
  assert.equal(f.state.reportRequests[1].clarificationReply.continuation.originalMessage, original);
  assert.deepEqual(f.state.reportRequests[1].toolHistory, f.state.reportRequests[0].toolHistory);
  assert.equal(f.state.effects.length, 1);
});

test('명료화 질문과 선택 사용자 문구는 history에 원문 한 번씩만 남고 UI 상태를 섞지 않는다', () => {
  const value = clarificationFor(req());
  const messages = [{ id: 'u', role: 'user', kind: 'message', content: req().message },
    { id: 'a', role: 'assistant', kind: 'message', content: value.question, clarification: value, clarificationState: 'closed',
      generationState: 'complete', modelHistory: [{ role: 'assistant', content: value.question }] },
    { id: 'u2', role: 'user', kind: 'message', content: '두번째' }];
  assert.deepEqual(historyFromMessages(messages), [{ role: 'user', content: req().message },
    { role: 'assistant', content: value.question }, { role: 'user', content: '두번째' }]);
});

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return r * .2126 + g * .7152 + b * .0722;
}

test('여섯 색상 태그는 실제 팔레트 swatch를 쓰고 light/dark 라벨 대비 4.5 이상을 유지한다', () => {
  const clarification = clarificationFor(req(), { target: 'set_portfolio_accent' });
  const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
  const background = selector => {
    const block = css.slice(css.indexOf(`${selector} {`)).split('}')[0];
    return block.match(/--bg-elev:\s*(#[0-9a-f]{6});/i)[1];
  };
  for (const value of ACCENTS) {
    const colors = clarificationAccentColors(clarification, value);
    assert.equal(colors.swatch, ACCENT_PALETTE[value].color);
    assert.equal(clarificationChoiceLabel(clarification, value), ACCENT_PALETTE[value].label);
    for (const [theme, surface] of [['light', background(':root')], ['dark', background("[data-theme='dark']")]]) {
      const values = [luminance(colors[theme]), luminance(surface)].sort((a, b) => b - a);
      assert.ok((values[0] + .05) / (values[1] + .05) >= 4.5, `${value}/${theme}`);
    }
  }
  assert.equal(clarificationAccentColors(clarification, '#f00'), undefined);
  assert.equal(clarificationAccentColors(clarificationFor(req()), 'light'), undefined);
  assert.equal(clarificationCurrentValue(clarification, { accent: 'blue' }), 'blue');
});

function messageItemRenderer() {
  const require = createRequire(import.meta.url);
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const ts = require('typescript');
  const source = readFileSync(new URL('./MessageItem.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const component = { exports: {} };
  const localRequire = name => {
    if (name === './ChatWidget.module.css') return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (name === './constants') return { CHAT_QUICK_START_OPTION_BY_ACTION_ID: new Map() };
    if (name === './StreamingText') return { StreamingText: ({ text }) => text };
    if (name === './toolResultPresentation') return { toolResultDisplayStatus, toolResultText };
    if (name === './chatFailure') return { CHAT_FAILURE_NOTICE };
    return require(name);
  };
  new Function('require', 'module', 'exports', compiled)(localRequire, component, component.exports);
  return { source, render: props => renderToStaticMarkup(React.createElement(component.exports.MessageItem, props)) };
}

test('실제 MessageItem: 색상6개·현재값·키보드 버튼·안전한 취소를 표시하고 실패·재시도·직접실행은 없다', () => {
  const { source, render: renderMessage } = messageItemRenderer();
  const clarification = clarificationFor(req(), { target: 'set_portfolio_accent' });
  const props = { message: { id: 'a', role: 'assistant', kind: 'message', content: clarification.question, generationState: 'complete',
    clarification, recommendationsSuppressed: true }, activeQuickDestination: null, streamAnimation: 'none', includeComplement: false,
    suggestedQuestions: [], revealCompletionControls: true, slowResponse: false, canRetry: true, retryWaitSeconds: 0,
    clarificationEpoch: 1, clarificationSettings: { accent: 'blue' }, clarificationCanSubmit: true,
    onActivateAction() {}, onAskSuggestedQuestion() {}, onRetry() {}, onClarificationChoice() {}, onClarificationCancel() {} };
  const render = extra => renderMessage({ ...props, ...extra });
  const html = render({});
  assert.equal((html.match(/data-clarification-value=/g) ?? []).length, 6);
  for (const [key, palette] of Object.entries(ACCENT_PALETTE)) {
    assert.ok(html.includes(`data-clarification-value="${key}"`));
    assert.ok(html.includes(palette.label));
    assert.ok(html.includes(`--clarification-swatch:${palette.color}`));
  }
  assert.ok(html.includes('현재: 로얄블루'));
  assert.ok(html.includes('data-current="true"'));
  assert.ok(html.includes('선택하면 해당 값으로 변경 요청을 보내요'));
  assert.ok(html.includes('이 변경 요청 취소'));
  assert.equal(html.includes('role="alert"'), false);
  assert.equal(html.includes('다시 시도'), false);
  assert.equal(html.includes('응답 생성 중'), false);
  assert.equal((html.match(/type="button"/g) ?? []).length, 7);
  const closed = render({ clarificationEpoch: undefined });
  assert.equal((closed.match(/disabled=""/g) ?? []).length, 6);
  assert.equal(closed.includes('이 변경 요청 취소'), false);
  const busy = render({ clarificationCanSubmit: false, clarificationBusy: true });
  assert.equal((busy.match(/disabled=""/g) ?? []).length, 7);
  const css = readFileSync(new URL('./ChatWidget.module.css', import.meta.url), 'utf8');
  assert.match(css, /\.clarificationChoice:focus-visible/u);
  assert.match(css, /min-height: 44px/u);
  assert.match(css, /data-motion='off'[\s\S]*?\.clarificationChoice \{ transition: none/u);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.clarificationChoice \{ transition: none/u);
  assert.doesNotMatch(source, /setAccent\(|setMode\(|executePortfolioUiTool\(/u);
});
