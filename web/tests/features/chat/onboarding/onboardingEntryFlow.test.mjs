import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ACTION_ROUTES, GREETING } from '../../../../src/features/chat/constants.ts';
import * as chatConstants from '../../../../src/features/chat/constants.ts';
import { chatProviderFixture, loadChatApi } from '../state/chatProviderFixtures.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
// 정본 옵션에서 기대값까지 파생하지 않는다. 공개 버튼의 문구가 바뀌면 명시적으로 검토한다.
const CASES = [
  { key: 'recruiter', prompt: '채용·평가 관점에서 경력, 역할과 강점을 중심으로 포트폴리오를 소개해 주세요.' },
  { key: 'developer', prompt: '개발·기술 검토 관점에서 기술 스택, 구조와 검증 방식을 중심으로 소개해 주세요.' },
  { key: 'collaboration', prompt: '협업·의뢰 관점에서 맡길 수 있는 업무, 작업 방식과 결과물을 중심으로 소개해 주세요.' },
  { key: 'personality', prompt: '성격과 취미, 평소 관심사를 소개해 주세요.' },
  { key: 'values', prompt: '일과 협업, 삶에서 중요하게 생각하는 가치관을 알려 주세요.' },
  { key: 'casual', prompt: '처음 방문한 사람에게 포트폴리오의 핵심만 짧게 소개해 주세요.' },
  { key: 'project_overview', quick: true, prompt: '공개용 프로젝트의 목적과 차이를 간단히 소개해 주세요.' },
  { key: 'research_optimization', quick: true, prompt: '성능 최적화 연구를 CPU, 메모리·파일 I/O, 직렬화·전송 관점으로 나누어 개요를 설명해 주세요.' },
];
const THEME_MESSAGE = '화면 모드를 다크로 바꿔 줘';
const THEME_ANSWER = '합성 테마 결과: 화면 모드를 다크로 반영한 것을 확인했습니다.';
const OVERVIEW = { page: 'overview', anchor: null, researchTab: null, researchYear: null, researchDetails: null };
const explanation = key => `합성 근거 ${key}: 테스트용 포트폴리오 자료는 담당 역할과 구현 범위, 협업 방식 및 검증 결과를 구분하여 설명합니다. 경력 소개에서는 문제를 발견한 배경과 설계 선택의 이유를 함께 살펴보고, 실제로 확인한 성과와 아직 검증하지 않은 사항을 분리하여 판단할 수 있습니다.\n\n이 관점의 소개에서는 기술 이름을 나열하는 데 그치지 않고 요구사항을 구조로 옮긴 과정과 결과를 확인한 방법을 연결합니다. 공개 자료에 포함된 작업 사례를 중심으로 맡길 수 있는 업무와 강점을 설명하며, 합성 테스트에 없는 수치나 개인의 실제 경력을 새로 만들어 주장하지 않습니다.`;
const compile = (source, jsx = false) => ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  ...(jsx ? { jsx: ts.JsxEmit.ReactJSX } : {}),
} }).outputText;

function declarations(path, names) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(ast))) found.push(`const ${node.getText(ast)};`);
    if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) found.push(node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.equal(found.length, names.length);
  return compile(found.join('\n') + `\nreturn { ${names.join(', ')} };`);
}
const widgetCallbacks = declarations('../../../../src/features/chat/ui/ChatWidget.tsx', ['chooseAudience', 'startQuickAction']);
const initialMessages = new Function('GREETING', declarations('../../../../src/features/chat/state/ChatProvider.tsx', ['initialMessages']))(GREETING).initialMessages;

function loadComponent(path, stubs = {}) {
  const absolute = new URL(path, import.meta.url);
  const localRequire = createRequire(absolute);
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', compile(readFileSync(absolute, 'utf8'), true))(
    name => Object.hasOwn(stubs, name) ? stubs[name] : name === '../constants' ? chatConstants
      : name === '../streaming/StreamingText' ? { StreamingText: ({ text }) => text }
      : name.endsWith('.css') ? { default: {} } : localRequire(name),
    loaded, loaded.exports);
  return loaded.exports;
}
const { ChatOnboarding } = loadComponent('../../../../src/features/chat/onboarding/ChatOnboarding.tsx');
const { MessageItem } = loadComponent('../../../../src/features/chat/ui/MessageItem.tsx');

test('공통 canSend가 false면 관점/빠른 시작 콜백도 선택·전송·화면 이동을 만들지 않는다', () => {
  const effects = [];
  const record = (...args) => effects.push(args);
  const callbacks = new Function('useCallback', 'selectAudience', 'sendMessage', 'setActiveQuickDestination', 'window', 'navigateAction', 'canSend', widgetCallbacks)(
    fn => fn, record, record, record, { requestAnimationFrame: record }, record, false);
  callbacks.chooseAudience('recruiter', '소개해 줘');
  callbacks.startQuickAction('프로젝트 설명', 'project_overview', 'developer');
  assert.deepEqual(effects, []);
});

test('실제 MessageItem: cooldown은 전송형 추천만 잠그고 단순 페이지 이동은 유지한다', () => {
  const html = renderToStaticMarkup(React.createElement(MessageItem, {
    message: { id: 'cooldown', role: 'assistant', kind: 'message', content: '완료한 본문', generationState: 'complete',
      actions: [{ id: 'project_overview', label: '프로젝트' }, { id: 'resume', label: '이력서' }] },
    activeQuickDestination: null, streamAnimation: 'none', includeComplement: false,
    suggestedQuestions: ['더 설명해 줘'], revealCompletionControls: false, slowResponse: false,
    canRetry: false, retryWaitSeconds: 4, canSend: false,
    onActivateAction() {}, onAskSuggestedQuestion() {}, onRetry() {},
  }));
  const buttons = [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/gu)];
  assert.equal(buttons.length, 3);
  assert.match(buttons[0][1], /disabled/u);
  assert.doesNotMatch(buttons[1][1], /disabled/u);
  assert.match(buttons[2][1], /disabled/u);
  assert.ok(html.includes('완료한 본문'));
});
function buttons(node, result = []) {
  if (Array.isArray(node)) node.forEach(child => buttons(child, result));
  else if (node && typeof node === 'object') {
    if (node.type === 'button') result.push(node);
    buttons(node.props?.children, result);
  }
  return result;
}
function renderedAnswer(message) {
  return renderToStaticMarkup(React.createElement(MessageItem, { message,
    activeQuickDestination: null, streamAnimation: 'none', includeComplement: false, suggestedQuestions: [],
    revealCompletionControls: false, slowResponse: false, canRetry: message.retryAllowed === true, retryWaitSeconds: 0,
    onActivateAction() {}, onAskSuggestedQuestion() {}, onRetry() {},
  }));
}
function assertExplanation(message, key) {
  assert.equal(message.kind, 'message', '앱 안내(chat_notice)를 소개 성공 본문으로 세지 않는다');
  assert.equal(message.generationState, 'complete');
  assert.equal(message.content, explanation(key));
  const html = renderedAnswer(message);
  assert.ok(html.includes(`합성 근거 ${key}:`), '실제 말풍선에 근거가 있는 소개 본문을 표시해야 한다');
  assert.doesNotMatch(html, /응답 생성을 완료하지 못했습니다/u);
}

const sseBody = events => events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');
const sseResponse = events => new Response(sseBody(events), { headers: { 'content-type': 'text/event-stream' } });

/**
 * 실제 클릭→Widget 콜백→Provider→실제 api.ts(HTTP·SSE 파싱)까지 잇는다.
 * 서버만 fetch 대역으로 바꾸며, 오가는 요청은 wire에 경로·헤더·본문 그대로 남긴다.
 */
function flowFixture(t, { streaming = true } = {}) {
  let selected = null;
  const wire = []; const frames = []; const navigations = []; const pendingSends = [];
  let sessionCount = 0;
  let failure = null;
  const fetch = async (url, init) => {
    const path = new URL(url).pathname;
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    wire.push({ path, method: init.method, authorization: init.headers?.authorization, body });
    if (path === '/api/chat/sessions') {
      sessionCount += 1;
      return Response.json({ sessionId: sessionCount.toString(16).padStart(32, '0'), token: `flow-token-${sessionCount}` });
    }
    if (path.endsWith('/close')) return new Response(null, { status: 204 });
    const turnId = `turn-${wire.length}`;
    if (path.endsWith('/tool-results')) {
      return sseResponse([['status', { stage: 'answering' }], ['delta', { text: THEME_ANSWER }],
        ['done', { turnId: body.turnId, answer: THEME_ANSWER }]]);
    }
    if (failure) return sseResponse([['turn', { turnId }], ['status', { stage: 'answering' }], ['error', failure]]);
    if (body.message === THEME_MESSAGE) {
      return sseResponse([['turn', { turnId }], ['status', { stage: 'working' }], ['tool_request', { turnId,
        calls: [{ callId: 'theme-1', name: 'set_portfolio_theme', arguments: { theme: 'dark' } }] }]]);
    }
    const entry = CASES.find(item => item.prompt === body.message);
    const answer = explanation(entry?.key ?? 'followup');
    return sseResponse([['turn', { turnId }], ['status', { stage: 'searching' }],
      ['delta', { text: answer.slice(0, 40) }], ['delta', { text: answer.slice(40) }], ['done', { turnId, answer }]]);
  };
  const api = loadChatApi(fetch);
  const f = chatProviderFixture(t, { streaming, messages: initialMessages(), onAudience: value => { selected = value; },
    api: { createChatSession: api.createChatSession, streamChatTurn: api.streamChatTurn,
      streamChatToolResults: api.streamChatToolResults, closeChatSession: api.closeChatSession } });
  const callbacks = new Function('useCallback', 'selectAudience', 'sendMessage', 'setActiveQuickDestination', 'window', 'navigateAction', 'canSend', widgetCallbacks)(
    fn => fn, value => { selected = value; }, (...args) => {
      const pending = f.send(...args); pendingSends.push(pending); return pending;
    }, () => {}, { requestAnimationFrame: callback => frames.push(callback) }, actionId => navigations.push(ACTION_ROUTES[actionId]), true);
  const turns = () => wire.filter(item => item.path.endsWith('/turns'));
  return { f, wire, turns, navigations, get selected() { return selected; },
    async click(entry) {
      const tree = ChatOnboarding({ audience: selected, onSelectAudience: callbacks.chooseAudience,
        onStartQuickAction: callbacks.startQuickAction, onStartGuidedTour() {}, onShowSettingsGuide() {} });
      const button = buttons(tree).find(item => item.key === entry.key); assert.ok(button, entry.key);
      button.props.onClick();
      await Promise.all(pendingSends.splice(0));
      return f.state.messages.at(-1);
    },
    async theme() { await f.send(THEME_MESSAGE); },
    async followup() { await f.send('선택한 관점으로 이어서 설명해 주세요.'); },
    reset() { f.reset(); },
    flushFrames() { frames.splice(0).forEach(callback => callback()); },
    failWith(error) { failure = error; },
  };
}

test('온보딩 테마 선행 대화: 실제 tool_request→브라우저 실행→tool-results가 같은 턴·같은 채팅으로 이어진다', async t => {
  const flow = flowFixture(t);
  await flow.theme();
  assert.deepEqual(flow.wire.map(item => item.path.replace(/[0-9a-f]{32}/u, ':id')),
    ['/api/chat/sessions', '/api/chat/sessions/:id/turns', '/api/chat/sessions/:id/tool-results']);
  const [, turn, results] = flow.wire;
  assert.equal(turn.authorization, 'Bearer flow-token-1');
  assert.deepEqual(turn.body, { message: THEME_MESSAGE, clientState: { uiSettings: { theme: 'light', accent: 'royalblue',
    chatLayout: 'floating', chatFont: 'pretendard', chatFontSize: 'medium', streamAnimation: 'none' }, viewState: OVERVIEW } });
  assert.equal(results.authorization, 'Bearer flow-token-1');
  assert.equal(results.body.turnId, 'turn-2');
  assert.deepEqual(results.body.results, [{ callId: 'theme-1', ok: true, output: { theme: 'dark', previous: 'light' } }]);
  assert.equal(results.body.clientState.uiSettings.theme, 'dark', '도구 실행 뒤 바뀐 설정을 함께 보낸다');
  assert.deepEqual(flow.f.state.effects, [['set_portfolio_theme', { theme: 'dark' }]]);
  const message = flow.f.state.messages.at(-1);
  assert.equal(message.content, THEME_ANSWER);
  assert.equal(message.generationState, 'complete');
  assert.equal(message.statusStage, undefined);
  assert.deepEqual(message.toolResults.map(item => [item.callId, item.status, item.label]),
    [['theme-1', 'applied', '화면 모드 · 다크']]);
});

for (const streaming of [true, false]) {
  test(`온보딩 8진입점 ${streaming ? '스트리밍' : '일괄 표시'}: 실제 클릭→Widget→Provider→API·SSE 파서→최종 설명 본문`, async t => {
    const scenarios = streaming ? ['fresh', 'theme-history', 'theme-new-chat'] : ['fresh'];
    for (const scenario of scenarios) for (const entry of CASES) {
      await t.test(`${scenario} ${entry.key}`, async t => {
        const flow = flowFixture(t, { streaming });
        let priorSessionPath;
        if (scenario !== 'fresh') {
          await flow.theme(); priorSessionPath = flow.turns()[0].path;
          assert.equal(flow.f.state.uiSettings.theme, 'dark'); assert.equal(flow.f.state.effects.length, 1);
        }
        if (scenario === 'theme-new-chat') flow.reset();
        const before = flow.turns().length;
        const message = await flow.click(entry); const req = flow.turns()[before];
        assert.equal(flow.turns().length, before + 1, '소개는 도구 후속이나 중복 요청 없이 한 번 전송한다');
        assert.deepEqual(Object.keys(req.body).sort(), ['clientState', 'message'],
          '대화 이력·관점·응답 모드는 보내지 않는다(이력은 서버 채팅이 보관한다)');
        assert.equal(req.body.message, entry.prompt);
        assert.deepEqual(req.body.clientState.viewState, OVERVIEW);
        assert.equal(req.body.clientState.uiSettings.theme, scenario === 'fresh' ? 'light' : 'dark');
        if (scenario === 'theme-history') assert.equal(req.path, priorSessionPath, '같은 서버 채팅으로 이어서 묻는다');
        if (scenario === 'theme-new-chat') {
          assert.notEqual(req.path, priorSessionPath, '새 대화는 새 서버 채팅에서 시작한다');
          const close = flow.wire.find(item => item.path.endsWith('/close'));
          assert.equal(close.path, priorSessionPath.replace(/\/turns$/u, '/close'));
          assert.deepEqual(close.body, { token: 'flow-token-1' });
        }
        assert.equal(flow.wire.filter(item => item.path === '/api/chat/sessions').length, scenario === 'theme-new-chat' ? 2 : 1);
        assert.equal(flow.f.state.effects.length, scenario === 'fresh' ? 0 : 1, '과거 테마 상태를 새 조작으로 실행하지 않는다');
        assertExplanation(message, entry.key);
        assert.equal(flow.navigations.length, 0, '빠른 시작 이동은 첫 요청의 화면 상태 snapshot 뒤에 시작한다');
        flow.flushFrames();
        assert.deepEqual(flow.navigations, entry.quick ? [ACTION_ROUTES[entry.key]] : []);
      });
    }
  });
}

test('선택 관점은 다음 질문에도 유지되고 quickstart override는 저장 관점을 바꾸지 않으며 새 대화는 초기화한다', async t => {
  const flow = flowFixture(t);
  await flow.click(CASES[0]); assert.equal(flow.selected, 'recruiter');
  await flow.click(CASES[7]); assert.equal(flow.selected, 'recruiter');
  await flow.followup(); assert.equal(flow.selected, 'recruiter');
  const oldPath = flow.turns().at(-1).path;
  assert.ok(flow.turns().every(item => item.path === oldPath), '한 대화의 질문은 모두 같은 서버 채팅으로 간다');
  flow.reset(); assert.equal(flow.selected, null);
  assert.deepEqual(flow.f.state.messages, initialMessages(), '새 대화는 인사말만 남긴다');
  await flow.click(CASES[4]);
  assert.notEqual(flow.turns().at(-1).path, oldPath);
  assert.equal(flow.wire.filter(item => item.path.endsWith('/close')).length, 1);
});

test('서버 SSE error는 실패 상태와 서버 안내로 끝나며 온보딩 소개 성공 본문 assertion을 통과하지 못한다', async t => {
  const flow = flowFixture(t);
  flow.failWith({ code: 'upstream_unavailable', message: '추론 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.', retryable: true });
  const message = await flow.click(CASES[0]);
  assert.equal(flow.turns().length, 1);
  assert.equal(message.kind, 'message'); assert.equal(message.generationState, 'failed');
  assert.equal(message.failureNotice, '추론 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
  assert.equal(message.retryAllowed, true);
  assert.deepEqual(flow.f.state.availability, ['offline'], '연결 계열 실패는 상태 GET 없이 오프라인으로 보고한다');
  assert.deepEqual(flow.f.state.diagnostics, [['request', 'upstream_unavailable']]);
  const html = renderedAnswer(message);
  assert.match(html, /role="alert"/u);
  assert.match(html, /추론 서버에 연결하지 못했어요/u);
  assert.match(html, /다시 시도/u);
  assert.throws(() => assertExplanation(message, 'recruiter'), assert.AssertionError);
});
