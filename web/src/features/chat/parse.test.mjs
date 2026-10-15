// 챗봇 응답 파서(`parse.ts`)의 계약을 브라우저 없이 검증한다.
// Node가 타입을 지우고 TypeScript 원본을 그대로 실행하므로 별도 빌드가 없다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as chatParse from './parse.ts';
import { portfolioViewControlInput } from '../portfolio-tools/view.ts';
import { readPortfolioViewState, resolvePortfolioViewTarget } from '../webmcp/portfolioView.ts';
import { isPortfolioTargetReady } from '../portfolio-tools/viewTargetVisibility.ts';
import { workflowStageFromHash } from '../../app/about-me/ai-workflow/workflowStageNavigation.ts';
import { pageContextFromPathname } from './constants.ts';

test('SI 단계·실제 사례와 인프라 최적화의 도구 목적지·해시는 유효하다', () => {
  const cases = [
    ['si-levels', 'ai-workflow-intro', 'chat'],
    ['si-level-chat', 'workflow-header-chat', 'chat'],
    ['si-level-read-only', 'workflow-header-read-only', 'read-only'],
    ['si-level-implementation', 'workflow-header-implementation', 'implementation'],
    ['si-level-tools', 'workflow-header-tools', 'tools'],
    ['si-level-orchestration', 'workflow-header-orchestration', 'orchestration'],
    ['si-tools-ffmpeg', 'example-tools', 'tools'],
    ['si-session-messaging', 'story-orchestration', 'orchestration'],
  ];
  for (const [action, anchor, stage] of cases) {
    assert.ok(PORTFOLIO_VIEW_ACTIONS.includes(action));
    assert.deepEqual(portfolioViewControlInput.parse({ action }), { action });
    assert.throws(() => portfolioViewControlInput.parse({ action, year: '2026' }));
    assert.equal(resolvePortfolioViewTarget(action).route, `/about-me/ai-workflow#${anchor}`);
    assert.equal(workflowStageFromHash(`#${anchor}`), stage);
    assert.ok(parseToolExecution({ type: 'control_portfolio_view', toolName: 'control_portfolio_view',
      action, toolCallId: `call-${action}` }));
  }
  assert.equal(resolvePortfolioViewTarget('infrastructure-optimization').route,
    '/about-me/architecture#infrastructure-migration');
  for (const hash of ['#story-orchestration-sessions', '#story-orchestration-pre-notice', '#story-orchestration-coordination']) {
    assert.equal(workflowStageFromHash(hash), 'orchestration');
  }
  assert.equal(workflowStageFromHash('#workflow-tool-group-cli'), 'tools');
  assert.equal(pageContextFromPathname('/ssw-portfolio-public/about-me/ai-workflow/'), 'ai_workflow');
});

test('SI 화면 조회는 URL의 비활성 슬라이드 대신 실제 활성 패널을 보고한다', t => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  t.after(() => { globalThis.window = previousWindow; globalThis.document = previousDocument; });
  const active = { id: 'workflow-tools', contains: target => target?.id === 'example-tools' };
  const elements = { 'workflow-header-orchestration': { id: 'workflow-header-orchestration' },
    'example-tools': { id: 'example-tools' }, 'ai-workflow-intro': { id: 'ai-workflow-intro' } };
  globalThis.document = { querySelector: () => active, getElementById: id => elements[id] ?? null };
  globalThis.window = { location: { hash: '#workflow-header-orchestration' } };
  const read = () => readPortfolioViewState('/about-me/ai-workflow/');
  assert.equal(read().page, 'ai-workflow');
  assert.equal(read().anchor, 'workflow-tools');
  globalThis.window.location.hash = '#example-tools';
  assert.equal(read().anchor, 'example-tools');
  globalThis.window.location.hash = '#ai-workflow-intro';
  assert.equal(read().anchor, 'ai-workflow-intro');
  assert.equal(parsePortfolioViewState(read()).page, 'ai-workflow');
});

test('숨겨진 슬라이드와 이동 중인 본문은 도착 확인에서 제외한다', t => {
  const previousWindow = globalThis.window;
  t.after(() => { globalThis.window = previousWindow; });
  globalThis.window = { getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) };
  const ready = { closest: () => null, getClientRects: () => [{}] };
  assert.equal(isPortfolioTargetReady(ready), true);
  assert.equal(isPortfolioTargetReady({ ...ready, closest: selector => selector.includes('[inert]') ? {} : null }), false);
  assert.equal(isPortfolioTargetReady({ ...ready, getClientRects: () => [] }), false);
  assert.equal(isPortfolioTargetReady({ ...ready, closest: selector => selector === '.swiper-wrapper'
    ? { getAnimations: () => [{ playState: 'running' }] } : null }), false);
});

import {
  ChatApiError,
  nextSseBlock,
  parseAction,
  parseChatResponse,
  parsePortfolioViewState,
  parseSegment,
  parseSseBlock,
  parseSuggestedQuestions,
  parseToolExecution,
  parseToolExecutions,
  retryAfterMsFromHeader,
} from './parse.ts';
import { ACTION_LABELS, ACTION_ROUTES, GUIDED_TOUR_CHAT_GUIDE, REASONING_QUICK_TOGGLE_ENABLED, SETTINGS_WEBMCP_GUIDE } from './constants.ts';
import { AGENT_EXPERIMENT_CATEGORY_ANCHORS } from '../../data/agentExperimentNavigation.ts';
import {
  GUIDED_TOUR_SESSION_KEY,
  GUIDED_TOUR_STEPS,
  GUIDED_TOUR_VISIT_KEY,
  currentGuidedTourStep,
  guidedTourInteractionForStep,
} from './guidedTour.ts';

test('둘러보기는 자기소개서·연구 연도·SI 표기와 활용 단계를 포함한 34단계이며 저장 버전을 갱신한다', () => {
  assert.deepEqual(GUIDED_TOUR_STEPS.map((step) => step.id), [
    'overview', 'past-work', 'si-terminology', 'projects', 'agent-experiments',
    'experiments-svg', 'experiments-2d-games', 'experiments-3d-games',
    'experiments-blender', 'experiments-videos', 'experiments-comfyui', 'resume',
    'cover-letter', 'cover-letter-story', 'cover-letter-career-turning-point',
    'research-timeline', 'research-year-2011', 'research-year-2022', 'research-year-2023',
    'research-year-2024', 'research-year-2025', 'research-year-2026', 'research-optimization', 'research-cpu',
    'research-memory', 'research-serialization', 'research-tools',
    'si-levels', 'si-level-chat', 'si-level-read-only', 'si-level-implementation',
    'si-level-tools', 'si-level-orchestration', 'log',
  ]);
  const step = currentGuidedTourStep({ status: 'active', stepIndex: 4, interaction: 'ready' });
  assert.equal(step.title, 'AI 에이전트 성능·활용 실험');
  assert.equal(ACTION_ROUTES[step.actionId], '/about-me#agent-experiments-intro');
  assert.equal(guidedTourInteractionForStep(step), 'ready');
  assert.deepEqual(parseAction({ id: step.actionId, label: ACTION_LABELS[step.actionId] }), {
    id: 'agent_experiments', label: 'AI 에이전트 성능·활용 실험 보기',
  });
  const categorySteps = GUIDED_TOUR_STEPS.slice(5, 11);
  assert.deepEqual(categorySteps.map((item) => ACTION_ROUTES[item.actionId]),
    Object.values(AGENT_EXPERIMENT_CATEGORY_ANCHORS).map((anchor) => `/about-me#${anchor}`));
  for (const item of categorySteps) {
    assert.equal(guidedTourInteractionForStep(item), 'ready');
    assert.ok(parseAction({ id: item.actionId, label: ACTION_LABELS[item.actionId] }));
  }
  assert.equal(GUIDED_TOUR_SESSION_KEY, 'portfolio-guided-tour:v7:session');
  assert.equal(GUIDED_TOUR_VISIT_KEY, 'portfolio-guided-tour:v7:visit');
});

test('SI 둘러보기는 소개와 01~05의 헤더로 이동하고 질문 없이 기록까지 이어진다', () => {
  const notice = GUIDED_TOUR_STEPS[2];
  assert.equal(ACTION_ROUTES[notice.actionId], '/about-me#si-terminology-notice');
  assert.equal(guidedTourInteractionForStep(notice), 'ready');
  assert.equal(notice.targetId, 'si-terminology-notice');
  const steps = GUIDED_TOUR_STEPS.filter((step) => step.id.startsWith('si-level'));
  assert.deepEqual(steps.map((step) => ACTION_ROUTES[step.actionId]), [
    '/about-me/ai-workflow#ai-workflow-intro',
    '/about-me/ai-workflow#workflow-header-chat',
    '/about-me/ai-workflow#workflow-header-read-only',
    '/about-me/ai-workflow#workflow-header-implementation',
    '/about-me/ai-workflow#workflow-header-tools',
    '/about-me/ai-workflow#workflow-header-orchestration',
  ]);
  for (const step of steps) {
    assert.equal(guidedTourInteractionForStep(step), 'ready');
    assert.ok(parseAction({ id: step.actionId, label: ACTION_LABELS[step.actionId] }));
  }
  assert.equal(ACTION_ROUTES[GUIDED_TOUR_STEPS.at(-1).actionId], '/about-me/log#log-overview');
});

test('자기소개서의 두 본문과 연구 여섯 시기는 각각 질문 없이 해당 섹션으로 이동한다', () => {
  const steps = GUIDED_TOUR_STEPS.filter((step) => step.id.startsWith('cover-letter-') || step.id.startsWith('research-year-'));
  assert.deepEqual(steps.map((step) => ACTION_ROUTES[step.actionId]), [
    '/about-me/cover-letter#cover-letter-story',
    '/about-me/cover-letter#cover-letter-career-turning-point',
    ...['2011', '2022', '2023', '2024', '2025', '2026'].map((year) => `/about-me/research#research-year-${year}`),
  ]);
  for (const step of steps) {
    assert.equal(guidedTourInteractionForStep(step), 'ready');
    assert.ok(parseAction({ id: step.actionId, label: ACTION_LABELS[step.actionId] }));
  }
});

test('연구 페이지 메인과 연구 여정 탭은 서로 다른 스크롤 목적지를 가진다', () => {
  assert.equal(ACTION_ROUTES.research, '/about-me/research');
  assert.equal(ACTION_ROUTES.research_timeline, '/about-me/research#research-timeline-overview');
});

test('설정 안내는 채팅을 붙이거나 떼는 쉬운 표현을 양쪽 모두 제공한다', () => {
  assert.match(SETTINGS_WEBMCP_GUIDE, /“채팅을 옆으로 붙여줘”/u);
  assert.match(SETTINGS_WEBMCP_GUIDE, /“채팅을 옆에서 떼줘”/u);
  assert.doesNotMatch(SETTINGS_WEBMCP_GUIDE, /도킹/u);
});

test('구형 서버의 도구 실패 설명은 오류 객체에서만 보존한다', () => {
  const error = new ChatApiError('도구 실행 실패', {
    code: 'tool_call_failed', explanation: '변경은 적용되지 않았습니다.',
  });
  assert.equal(error.code, 'tool_call_failed');
  assert.equal(error.explanation, '변경은 적용되지 않았습니다.');
});
import { onboardingPresentation } from './onboardingPolicy.ts';
import { toolResultText } from './toolResultPresentation.ts';
import { verifiedToolReply } from './verifiedToolReply.ts';
import {
  appendUiSettingChange,
  createUiSettingChange,
  parseUiSettingChanges,
} from './uiSettingChangeJournal.ts';
import {
  PORTFOLIO_VIEW_ACTIONS,
  PORTFOLIO_UI_TOOLS,
  PORTFOLIO_UI_TOOL_NAMES,
  ToolDefinition,
  ToolRegistry,
  emptyInputDefinition,
  normalizePortfolioToolName,
} from '../portfolio-tools/schema.ts';
import {
  accentCycleOrder,
  runPortfolioAccentCycle,
} from '../portfolio-tools/accentCycle.ts';

test('WebMCP UI 목록은 내장 모델 도구 11개와 같은 이름만 등록한다', () => {
  assert.deepEqual([...PORTFOLIO_UI_TOOL_NAMES].sort(), [
    'get_portfolio_ui_settings', 'set_portfolio_theme', 'set_portfolio_accent',
    'cycle_portfolio_accent', 'set_portfolio_chat_layout',
    'set_portfolio_chat_font', 'set_portfolio_chat_font_size',
    'set_portfolio_stream_animation', 'control_portfolio_view',
    'get_portfolio_view_state', 'open_portfolio_settings',
  ].sort());
  assert.deepEqual(PORTFOLIO_UI_TOOLS.cycle_portfolio_accent.parse({}), {});
  assert.throws(() => PORTFOLIO_UI_TOOLS.cycle_portfolio_accent.parse({ accent: 'rose' }));
});

test('포인트 색상 순회는 시작 색으로 돌아오고 중단되면 원복한다', async () => {
  const accents = accentCycleOrder('rose');
  assert.deepEqual(accents, ['violet', 'blue', 'indigo', 'emerald', 'amber', 'rose']);
  const completed = [];
  await runPortfolioAccentCycle({
    initialAccent: 'rose', accents, stepMs: 1,
    setAccent: (accent) => completed.push(accent),
    signal: new AbortController().signal,
  });
  assert.deepEqual(completed, accents);

  const controller = new AbortController();
  const interrupted = [];
  await assert.rejects(runPortfolioAccentCycle({
    initialAccent: 'rose', accents, stepMs: 1,
    setAccent: (accent) => {
      interrupted.push(accent);
      if (interrupted.length === 1) controller.abort();
    },
    signal: controller.signal,
  }), (error) => error?.name === 'AbortError');
  assert.deepEqual(interrupted, ['violet', 'rose']);
});

/** 형식은 통과하되 본문만 바꿔 쓰는 최소 응답 골격이다. */
function chatResponse(overrides = {}) {
  return {
    mode: 'model',
    status: 'online',
    generated: true,
    answer: '안녕하세요.',
    segments: [],
    audience: 'default',
    tone: 'official',
    pageContext: 'default',
    actions: [],
    suggestedQuestions: [],
    toolExecutions: [],
    cached: false,
    ...overrides,
  };
}

test('추천 생략은 명시적 true만 보존하고 누락·false·잘못된 값은 기존 응답과 같게 읽는다', () => {
  const suppressed = parseChatResponse(chatResponse({ recommendationsSuppressed: true }));
  assert.equal(suppressed.recommendationsSuppressed, true);
  assert.equal(suppressed.answer, '안녕하세요.');
  const legacy = parseChatResponse(chatResponse());
  for (const value of [undefined, false, 'true', 1, null]) {
    assert.deepEqual(parseChatResponse(chatResponse({ recommendationsSuppressed: value })), legacy);
  }
});

test('실제 JSON·SSE done API와 완료 말풍선 매핑은 추천 생략 메타데이터와 본문을 보존한다', async () => {
  const require = createRequire(import.meta.url);
  const ts = require('typescript');
  const source = readFileSync(new URL('./api.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const provider = readFileSync(new URL('./ChatProvider.tsx', import.meta.url), 'utf8');
  const messageStart = provider.indexOf('const completedMessage: ChatMessage = ') + 'const completedMessage: ChatMessage = '.length;
  const messageEnd = provider.indexOf('\n        };', messageStart) + '\n        }'.length;
  const completedMessage = new Function('response', 'streamingMessageId', 'nextId', 'toolResults',
    `return ${provider.slice(messageStart, messageEnd)};`);
  const request = { message: '현재 시간이 어떻게 돼?', history: [], audience: 'default', tone: 'official', pageContext: 'default' };
  for (const suppressed of [true, undefined]) {
    const payload = chatResponse({ answer: '서울은 오후 세 시입니다.',
      ...(suppressed ? { recommendationsSuppressed: suppressed } : {}) });
    for (const streaming of [false, true]) {
      const apiModule = { exports: {} };
      const fetchFixture = async () => streaming
        ? new Response(`event: delta\ndata: ${JSON.stringify({ text: payload.answer })}\n\nevent: done\ndata: ${JSON.stringify(payload)}\n\n`,
          { headers: { 'content-type': 'text/event-stream' } })
        : Response.json(payload);
      new Function('require', 'module', 'exports', 'fetch', 'process', compiled)(
        name => name === './parse' ? chatParse : require(name), apiModule, apiModule.exports,
        fetchFixture, { env: { NEXT_PUBLIC_RAG_API_BASE_URL: 'https://fixture.invalid' } },
      );
      const deltas = [];
      const signal = new AbortController().signal;
      const response = streaming
        ? await apiModule.exports.requestChatStream(request, signal, { onDelta: text => deltas.push(text) })
        : await apiModule.exports.requestChat(request, signal);
      assert.equal(response.recommendationsSuppressed, suppressed);
      assert.equal(response.answer, payload.answer);
      if (streaming) assert.deepEqual(deltas, [payload.answer]);
      const chip = { callId: 'theme-1', tool: 'set_portfolio_theme', label: '다크', status: 'applied' };
      const message = completedMessage(response, 'assistant-1', () => 'assistant-2', new Map([['theme-1', chip]]));
      assert.equal(message.recommendationsSuppressed, suppressed);
      assert.equal(message.content, payload.answer);
      assert.deepEqual(message.toolResults, [chip]);
    }
  }
});

test('확인된 설정 도구 변경만 기록하고 최신 20개를 보존한다', () => {
  const change = createUiSettingChange({
    type: 'set_portfolio_chat_font_size', toolName: 'set_portfolio_chat_font_size',
    toolCallId: 'size-1', size: 'large',
  }, 'medium', 'large');
  assert.deepEqual(change, {
    toolCallId: 'size-1', groupId: 'size-1', toolName: 'set_portfolio_chat_font_size',
    before: 'medium', after: 'large',
  });
  assert.equal(createUiSettingChange({
    type: 'set_portfolio_chat_font_size', toolName: 'set_portfolio_chat_font_size',
    toolCallId: 'size-2', size: 'large',
  }, 'large', 'large'), null);
  assert.equal(createUiSettingChange({
    type: 'cycle_portfolio_accent', toolName: 'cycle_portfolio_accent',
    toolCallId: 'cycle-1', accents: ['indigo'], stepMs: 100,
  }, 'rose', 'indigo'), null);
  const entries = Array.from({ length: 25 }, (_, index) => ({
    ...change, toolCallId: `size-${index}`, groupId: `size-${index}`,
  }));
  assert.equal(parseUiSettingChanges([...entries, { ...change, after: 'invalid' }]).length, 20);
  assert.equal(parseUiSettingChanges([...entries, { ...change, after: 'invalid' }])[0].toolCallId, 'size-5');
  assert.equal(appendUiSettingChange(entries, { ...change, toolCallId: 'size-25' }).length, 20);
  assert.deepEqual(parseUiSettingChanges([{ ...change, extra: 'untrusted' }]), []);
  assert.deepEqual(parseUiSettingChanges([{ ...change, toolName: '__proto__' }]), []);
});

test('한 요청에서 확인된 여러 설정을 같은 그룹으로 저장하고 과거 기록도 읽는다', () => {
  const theme = createUiSettingChange({
    type: 'set_portfolio_theme', toolName: 'set_portfolio_theme',
    toolCallId: 'theme-1', theme: 'dark',
  }, 'system', 'dark', 'theme-1');
  const size = createUiSettingChange({
    type: 'set_portfolio_chat_font_size', toolName: 'set_portfolio_chat_font_size',
    toolCallId: 'size-2', size: 'xlarge',
  }, 'medium', 'xlarge', 'theme-1');
  assert.equal(theme?.groupId, 'theme-1');
  assert.equal(size?.groupId, 'theme-1');
  assert.deepEqual(parseUiSettingChanges([theme, size]), [theme, size]);
  assert.deepEqual(parseUiSettingChanges([{
    toolCallId: 'old-size', toolName: 'set_portfolio_chat_font_size',
    before: 'medium', after: 'large',
  }]), [{
    toolCallId: 'old-size', groupId: 'old-size', toolName: 'set_portfolio_chat_font_size',
    before: 'medium', after: 'large',
  }]);
  assert.deepEqual(parseUiSettingChanges([{ ...theme, groupId: 'bad group' }]), []);
});

test('도구 결과 배지는 이동·변경·상세 제어 모두 도구 호출로 표시한다', () => {
  for (const status of ['arrived', 'applied']) {
    for (const label of ['2023년 연구 상세 펼치기', '연구 경험의 2025년 위치', '다크 모드']) {
      assert.equal(toolResultText({ status, label }), `도구 호출 · ${label}`);
    }
  }
  assert.equal(toolResultText({ status: 'started', label: '연구 상세' }), '도구 호출 중…');
  assert.equal(toolResultText({ status: 'failed', label: '연구 상세' }), '도구 호출 실패 · 연구 상세');
  assert.equal(toolResultText({ status: 'failed', label: '연구 상세', detail: '확인 시간 초과' }), '도구 호출 실패 · 연구 상세: 확인 시간 초과');
});

test('채팅 입력창의 사고 모드 버튼을 숨긴다', () => {
  assert.equal(REASONING_QUICK_TOGGLE_ENABLED, false);
});

test('안내 카드는 대화 생성 중에도 남고 선택만 비활성화한다', () => {
  for (const isLoading of [false, true]) {
    assert.deepEqual(onboardingPresentation({ availability: 'online', guidedTourStatus: 'idle', isLoading }),
      { visible: true, disabled: isLoading, tourIntroVisible: false });
  }
  for (const [availability, guidedTourStatus] of [['offline', 'idle'], ['checking', 'idle'], ['online', 'active'], ['online', 'completed']]) {
    assert.equal(onboardingPresentation({ availability, guidedTourStatus, isLoading: false }).visible, false);
  }
});

test('둘러보기 진행 안내는 활성 투어에서만 표시하고 이동과 질문 및 종료 방법을 설명한다', () => {
  for (const isLoading of [false, true]) {
    const presentation = onboardingPresentation({ availability: 'online', guidedTourStatus: 'active', isLoading });
    assert.equal(presentation.tourIntroVisible, true);
    assert.equal(presentation.visible, false);
  }
  for (const [availability, guidedTourStatus] of [
    ['online', 'idle'], ['online', 'completed'], ['offline', 'active'], ['checking', 'active'],
  ]) {
    assert.equal(onboardingPresentation({ availability, guidedTourStatus, isLoading: false }).tourIntroVisible, false);
  }
  for (const text of ['화면 아래', '다음 장소', '채팅으로 질문', '종료']) {
    assert.ok(GUIDED_TOUR_CHAT_GUIDE.includes(text), text);
  }
});

/** 도구 실행 payload의 공통 부분이다. */
function execution(type, toolName, rest = {}) {
  return { type, toolName, toolCallId: 'call-1', ...rest };
}

test('SSE: 주석(keep-alive) 줄만 있는 블록은 디스패치하지 않는다', () => {
  assert.equal(parseSseBlock(': keep-alive'), null);
  assert.equal(parseSseBlock(':\n: ping'), null);
});

test('SSE: event 필드가 없는 블록은 무시한다', () => {
  assert.equal(parseSseBlock('data: {"text":"안녕"}'), null);
});

test('SSE: data 없이 event만 있는 블록도 무시한다', () => {
  assert.equal(parseSseBlock('event: delta'), null);
});

test('SSE: event와 data가 모두 있으면 값 앞 공백 하나만 제거한다', () => {
  assert.deepEqual(parseSseBlock('event: delta\ndata:  두 칸'), {
    event: 'delta',
    data: ' 두 칸',
  });
});

test('SSE: 여러 data 줄은 줄바꿈으로 이어 붙인다', () => {
  assert.deepEqual(parseSseBlock('event: done\ndata: {"a":1,\ndata: "b":2}'), {
    event: 'done',
    data: '{"a":1,\n"b":2}',
  });
});

test('SSE: CRLF 구분자와 BOM이 섞여도 같은 결과를 낸다', () => {
  assert.deepEqual(parseSseBlock('\uFEFFevent: meta\r\ndata: {}'), {
    event: 'meta',
    data: '{}',
  });
});

test('SSE: 청크 경계에서 잘린 블록은 다음 청크와 이어 붙는다', () => {
  // 첫 청크에는 블록 구분자(빈 줄)가 없어 아직 떼어낼 수 없다.
  assert.equal(nextSseBlock('event: delta\ndata: {"text":"안'), null);

  const buffer = 'event: delta\ndata: {"text":"안녕"}\n\nevent: done\n';
  const first = nextSseBlock(buffer);
  assert.deepEqual(parseSseBlock(first.block), {
    event: 'delta',
    data: '{"text":"안녕"}',
  });
  // 남은 조각은 아직 완결되지 않았으므로 버퍼에 그대로 남는다.
  assert.equal(first.rest, 'event: done\n');
  assert.equal(nextSseBlock(first.rest), null);
});

test('응답: 본문과 문단이 모두 비면 empty_answer로 실패한다', () => {
  assert.throws(
    () => parseChatResponse(chatResponse({ answer: '   ', segments: [] })),
    (error) => error instanceof ChatApiError && error.code === 'empty_answer',
  );
});

const statusResponse = (extra = {}) => chatResponse({
  mode: 'tool_status', status: 'online', generated: false, answer: '', segments: [],
  actions: [], suggestedQuestions: [], toolExecutions: [], cached: false, ...extra,
});
const verificationContext = { toolVerification: { results: [{
  toolCallId: 'theme-1', toolName: 'set_portfolio_theme', status: 'applied', elapsedMs: 500,
}] } };

test('응답: 명시적인 브라우저 확인 결과가 있을 때만 빈 tool_status를 허용한다', () => {
  assert.equal(parseChatResponse(statusResponse(), verificationContext).mode, 'tool_status');
  assert.throws(() => parseChatResponse(statusResponse()), ChatApiError);
  assert.throws(() => parseChatResponse(statusResponse(), { toolVerification: { results: [] } }), ChatApiError);
  assert.throws(() => parseChatResponse(chatResponse({ answer: '', segments: [] }), verificationContext),
    (error) => error.code === 'empty_answer');
  const naturalAnswer = '다크 모드가 눈부심을 줄일 수 있는 이유를 설명할게요.';
  assert.equal(parseChatResponse(chatResponse({ answer: naturalAnswer }), verificationContext).answer, naturalAnswer);
});

test('응답: tool_status는 본문·액션·추가 도구 또는 생성/캐시 상태를 위장하지 못한다', () => {
  for (const invalid of [
    { generated: true }, { status: 'upstream_offline' }, { cached: true },
    { answer: '반영을 확인했습니다.' }, { answer: ' ' },
    { segments: [{ markdown: '완료', actions: [] }] },
    { actions: [{ id: 'resume', label: ACTION_LABELS.resume }] },
    { suggestedQuestions: ['다음 질문'] }, { suggestedQuestions: undefined },
    { toolExecutions: [{ type: 'set_portfolio_theme', toolCallId: 'x', toolName: 'set_portfolio_theme', theme: 'dark' }] },
    { toolExecutions: undefined },
  ]) assert.throws(() => parseChatResponse(statusResponse(invalid), verificationContext), ChatApiError);
});

test('응답: JSON과 SSE done 모두 현재 요청의 확인 문맥을 파서에 넘긴다', () => {
  const api = readFileSync(new URL('./api.ts', import.meta.url), 'utf8');
  assert.equal(api.match(/parseChatResponse\(payload, \{ toolVerification: request\.toolVerification \}\)/g)?.length, 2);
});

test('응답: 본문이 비어도 문단이 남아 있으면 통과한다', () => {
  const parsed = parseChatResponse(
    chatResponse({
      answer: '',
      segments: [{ markdown: '문단', actions: [] }],
    }),
  );
  assert.equal(parsed.segments.length, 1);
});

test('응답: mode와 generated 조합이 어긋나면 거부한다', () => {
  assert.throws(
    () => parseChatResponse(chatResponse({ mode: 'retrieval_fallback' })),
    ChatApiError,
  );
});

test('응답: 허용 목록 밖 tone·pageContext는 거부한다', () => {
  assert.equal(parseChatResponse(chatResponse({ pageContext: 'architecture' })).pageContext, 'architecture');
  assert.throws(() => parseChatResponse(chatResponse({ tone: 'pirate' })), ChatApiError);
  assert.throws(
    () => parseChatResponse(chatResponse({ pageContext: 'admin' })),
    ChatApiError,
  );
});

test('액션: 라벨이 프런트 정의와 다르면 버린다', () => {
  assert.deepEqual(parseAction({ id: 'resume', label: ACTION_LABELS.resume }), {
    id: 'resume',
    label: ACTION_LABELS.resume,
  });
  assert.equal(parseAction({ id: 'resume', label: '아무 문구' }), null);
  assert.equal(parseAction({ id: 'unknown', label: '경력·기술 보기' }), null);
});

test('문단: 액션은 두 개까지만 남는다', () => {
  const segment = parseSegment({
    markdown: '본문',
    actions: [
      { id: 'resume', label: ACTION_LABELS.resume },
      { id: 'research', label: ACTION_LABELS.research },
      { id: 'log', label: ACTION_LABELS.log },
    ],
  });
  assert.equal(segment.actions.length, 2);
});

test('추천 질문: 길이·중복을 거르고 최대 네 개만 남긴다', () => {
  const questions = parseSuggestedQuestions([
    '짧음',
    '충분히 긴 질문입니다',
    '충분히 긴 질문입니다',
    '두 번째 질문입니다',
    '세 번째 질문입니다',
    '네 번째 질문입니다',
    '다섯 번째 질문입니다',
    123,
  ]);
  assert.equal(questions.length, 4);
  assert.equal(questions[0], '충분히 긴 질문입니다');
});

test('retry-after: 없거나 이상하면 기본 10초, 아주 크면 5분에서 자른다', () => {
  assert.equal(retryAfterMsFromHeader(null), 10_000);
  assert.equal(retryAfterMsFromHeader('  '), 10_000);
  assert.equal(retryAfterMsFromHeader('nope'), 10_000);
  assert.equal(retryAfterMsFromHeader('0'), 10_000);
  assert.equal(retryAfterMsFromHeader('-3'), 10_000);
  assert.equal(retryAfterMsFromHeader('7'), 7_000);
  assert.equal(retryAfterMsFromHeader('99999'), 300_000);
});

test('도구: 등록 키와 이름은 모두 snake_case이고 과거 별칭은 입력에서만 정규화한다', () => {
  assert.deepEqual(Object.keys(PORTFOLIO_UI_TOOLS), [...PORTFOLIO_UI_TOOL_NAMES]);
  for (const name of PORTFOLIO_UI_TOOL_NAMES) {
    assert.match(name, /^[a-z][a-z0-9_]*$/u);
    assert.equal(PORTFOLIO_UI_TOOLS[name].name, name);
    assert.equal(normalizePortfolioToolName(name.replaceAll('_', '-')), name);
  }
  assert.equal(normalizePortfolioToolName('unknown-tool'), 'unknown-tool');
  assert.equal(normalizePortfolioToolName(null), null);
});

test('도구 registry: 특수 키·중복·하이픈 이름을 등록 전에 거부한다', () => {
  const input = emptyInputDefinition('테스트');
  assert.throws(
    () => new ToolRegistry([
      new ToolDefinition('__proto__', input),
    ]),
    /snake_case/u,
  );
  assert.throws(
    () => new ToolRegistry([
      new ToolDefinition('same_tool', input),
      new ToolDefinition('same_tool', input),
    ]),
    /중복/u,
  );
});

test('도구: 이전 서버의 하이픈 이름도 새 이름으로 반환하고 인자와 원본은 보존한다', () => {
  const legacy = execution('control_portfolio_view', 'control-portfolio-view', {
    action: 'cover-letter',
  });
  assert.deepEqual(parseToolExecution(legacy), {
    ...legacy, toolName: 'control_portfolio_view',
  });
  assert.equal(legacy.toolName, 'control-portfolio-view');
  assert.equal(parseToolExecution(execution('set_portfolio_theme', 'set-portfolio-theme', { theme: 'dark' })).toolName, 'set_portfolio_theme');
  assert.equal(parseToolExecution(execution('set_portfolio_theme', 'set_portfolio-theme', { theme: 'dark' })), null);
});

test('도구: 화면 모드 변경을 파싱하고 목록 밖 값은 거부한다', () => {
  assert.deepEqual(
    parseToolExecution(
      execution('set_portfolio_theme', 'set_portfolio_theme', { theme: 'dark' }),
    ),
    {
      type: 'set_portfolio_theme',
      toolCallId: 'call-1',
      toolName: 'set_portfolio_theme',
      theme: 'dark',
    },
  );
  assert.equal(parseToolExecution(
    execution('set_portfolio_theme', 'set_portfolio_theme', { theme: 'system' }),
  ).theme, 'system');
});

test('도구: 포인트 색상은 허용 목록 안에서만 통과한다', () => {
  assert.equal(
    parseToolExecution(
      execution('set_portfolio_accent', 'set_portfolio_accent', {
        accent: 'violet',
      }),
    ).accent,
    'violet',
  );
  assert.equal(
    parseToolExecution(
      execution('set_portfolio_accent', 'set_portfolio_accent', {
        accent: 'neon',
      }),
    ),
    null,
  );
});

test('도구: 색상 순회는 다섯 색이 모두 한 번씩, 간격이 범위 안일 때만 통과한다', () => {
  const accents = ['blue', 'indigo', 'emerald', 'amber', 'rose', 'violet'];
  assert.equal(
    parseToolExecution(
      execution('cycle_portfolio_accent', 'cycle_portfolio_accent', {
        accents,
        stepMs: 300,
      }),
    ).stepMs,
    300,
  );
  assert.equal(
    parseToolExecution(
      execution('cycle_portfolio_accent', 'cycle_portfolio_accent', {
        accents: ['indigo', 'indigo', 'amber', 'rose', 'violet'],
        stepMs: 300,
      }),
    ),
    null,
  );
  assert.equal(
    parseToolExecution(
      execution('cycle_portfolio_accent', 'cycle_portfolio_accent', {
        accents,
        stepMs: 50,
      }),
    ),
    null,
  );
});

test('도구: 화면 제어는 연도 인자 규칙까지 확인한다', () => {
  assert.deepEqual(PORTFOLIO_UI_TOOLS.control_portfolio_view.parse({ action: 'research-2011' }), {
    action: 'research-2011',
  });
  assert.equal(parseToolExecution(execution('control_portfolio_view', 'control_portfolio_view', {
    action: 'research-2011',
  })).action, 'research-2011');
  for (const action of ['expand-research-year-details', 'collapse-research-year-details']) {
    assert.equal(parseToolExecution(execution('control_portfolio_view', 'control_portfolio_view', {
      action, year: '2011',
    })).year, '2011');
  }
  assert.throws(() => PORTFOLIO_UI_TOOLS.control_portfolio_view.parse({
    action: 'research-2011', year: '2011',
  }));
  assert.equal(
    parseToolExecution(
      execution('control_portfolio_view', 'control_portfolio_view', {
        action: 'resume',
      }),
    ).action,
    'resume',
  );
  // 연도별 상세 제어에는 연도가 반드시 있어야 한다.
  assert.equal(
    parseToolExecution(
      execution('control_portfolio_view', 'control_portfolio_view', {
        action: 'expand-research-year-details',
      }),
    ),
    null,
  );
  assert.equal(
    parseToolExecution(
      execution('control_portfolio_view', 'control_portfolio_view', {
        action: 'expand-research-year-details',
        year: '2024',
      }),
    ).year,
    '2024',
  );
  // 연도를 요구하지 않는 동작에 연도를 붙이면 거부한다.
  assert.equal(
    parseToolExecution(
      execution('control_portfolio_view', 'control_portfolio_view', {
        action: 'resume',
        year: '2024',
      }),
    ),
    null,
  );
  // 목록에 없는 연도와 동작도 거부한다.
  assert.equal(
    parseToolExecution(
      execution('control_portfolio_view', 'control_portfolio_view', {
        action: 'expand-research-year-details',
        year: '1999',
      }),
    ),
    null,
  );
  assert.equal(
    parseToolExecution(
      execution('control_portfolio_view', 'control_portfolio_view', {
        action: 'delete-everything',
      }),
    ),
    null,
  );
});

test('도구: 소개 페이지 안의 이동 목적지도 허용 목록에 들어 있다', () => {
  // 서버 목록(비공개 backend/src/shared/view-targets.js)과 수동으로 맞추는
  // 값이라, 개수가 달라지면 한쪽만 고친 것이다.
  assert.equal(PORTFOLIO_VIEW_ACTIONS.length, 41);
  assert.equal(
    parseToolExecution(
      execution('control_portfolio_view', 'control_portfolio_view', {
        action: 'past-work-archive',
      }),
    ).action,
    'past-work-archive',
  );
  assert.equal(
    parseToolExecution(
      execution('control_portfolio_view', 'control_portfolio_view', {
        action: 'project-ecommerce-demo',
      }),
    ).action,
    'project-ecommerce-demo',
  );
  // 새 목적지도 연도 인자를 받지 않는다.
  assert.equal(
    parseToolExecution(
      execution('control_portfolio_view', 'control_portfolio_view', {
        action: 'ai-collaboration-projects',
        year: '2024',
      }),
    ),
    null,
  );
});

test('응답: uiToolOutcome은 아는 값만 남기고 나머지는 무시한다', () => {
  assert.equal(
    parseChatResponse(chatResponse({ uiToolOutcome: 'not_called' }))
      .uiToolOutcome,
    'not_called',
  );
  assert.equal(
    parseChatResponse(chatResponse({ uiToolOutcome: 'sometimes' }))
      .uiToolOutcome,
    undefined,
  );
  // 필드를 보내지 않는 옛 서버 응답도 그대로 통과한다.
  assert.equal(parseChatResponse(chatResponse()).uiToolOutcome, undefined);
  assert.equal(parseChatResponse(chatResponse({ uiToolOutcome: 'incomplete', uiOnly: true })).uiToolOutcome, 'incomplete');
  assert.equal(parseChatResponse(chatResponse({ uiOnly: true })).uiOnly, true);
  assert.equal(parseChatResponse(chatResponse({ uiOnly: 'yes' })).uiOnly, undefined);
});

test('응답: 도구 후속 계획은 설명 종류와 선택적 자료 범위를 검증해 보존한다', () => {
  const uiLookup = {
    explanationRequested: true,
    knowledgeRequested: false,
  };
  assert.deepEqual(parseChatResponse(chatResponse({
    uiOnly: true,
    toolFollowup: uiLookup,
  })).toolFollowup, uiLookup);

  const knowledge = {
    explanationRequested: true,
    knowledgeRequested: true,
    answerPlan: { subject: '프로젝트 최적화', aspects: ['reason', 'examples'] },
    contextTopic: '최근 프로젝트',
  };
  assert.deepEqual(parseChatResponse(chatResponse({
    uiOnly: false,
    toolFollowup: knowledge,
  })).toolFollowup, knowledge);

  assert.deepEqual(parseChatResponse(chatResponse({
    uiOnly: false,
    toolFollowup: {
      ...knowledge,
      answerPlan: { ...knowledge.answerPlan, subject: '  프로젝트 최적화  ' },
      contextTopic: '  최근 프로젝트  ',
    },
  })).toolFollowup, knowledge);

  const simpleChange = {
    explanationRequested: false,
    knowledgeRequested: false,
  };
  assert.deepEqual(parseChatResponse(chatResponse({
    uiOnly: true,
    toolFollowup: simpleChange,
  })).toolFollowup, simpleChange);
});

test('응답: 잘못된 선택 후속 메타데이터는 응답 전체를 실패시키지 않고 무시한다', () => {
  const malformed = [
    { explanationRequested: false, knowledgeRequested: true },
    { explanationRequested: true, knowledgeRequested: false, contextTopic: '허용 안 됨' },
    { explanationRequested: true, knowledgeRequested: true, answerPlan: {
      subject: '', aspects: ['reason'],
    } },
    { explanationRequested: true, knowledgeRequested: true, answerPlan: {
      subject: '   ', aspects: ['reason'],
    } },
    { explanationRequested: true, knowledgeRequested: true, contextTopic: '   ' },
    { explanationRequested: true, knowledgeRequested: true, answerPlan: {
      subject: '주제', aspects: ['unknown'],
    } },
    { explanationRequested: true, knowledgeRequested: true, answerPlan: {
      subject: '주제', aspects: ['reason', 'overview', 'examples', 'details'],
    } },
  ];
  for (const toolFollowup of malformed) {
    const parsed = parseChatResponse(chatResponse({ toolFollowup }));
    assert.equal(parsed.answer, chatResponse().answer);
    assert.equal(parsed.toolFollowup, undefined);
  }
  assert.equal(parseChatResponse(chatResponse()).toolFollowup, undefined);
});

test('브라우저 관측만으로 순수 화면 요청의 성공과 실패를 구분한다', () => {
  assert.equal(verifiedToolReply([{ status: 'applied', label: '다크 모드' }]),
    '다크 모드: 화면에서 반영을 확인했습니다.');
  assert.equal(verifiedToolReply([{ status: 'failed', label: '다크 모드' }]),
    '다크 모드: 화면에서 반영을 확인하지 못했습니다.');
  assert.equal(verifiedToolReply([
    { status: 'arrived', label: '이력서 페이지' },
    { status: 'failed', label: '글자 크기' },
  ]), '반영 확인: 이력서 페이지. 확인 실패: 글자 크기.');
});

test('도구: 채팅 글꼴과 글자 크기는 허용 목록 안에서만 통과한다', () => {
  assert.equal(
    parseToolExecution(
      execution('set_portfolio_chat_font', 'set_portfolio_chat_font', {
        font: 'noto-sans-kr',
      }),
    ).font,
    'noto-sans-kr',
  );
  assert.equal(
    parseToolExecution(
      execution('set_portfolio_chat_font', 'set_portfolio_chat_font', {
        font: 'comic-sans',
      }),
    ),
    null,
  );
  assert.equal(
    parseToolExecution(
      execution(
        'set_portfolio_chat_font_size',
        'set_portfolio_chat_font_size',
        { size: 'xlarge' },
      ),
    ).size,
    'xlarge',
  );
  assert.equal(
    parseToolExecution(
      execution(
        'set_portfolio_chat_font_size',
        'set_portfolio_chat_font_size',
        { size: 'huge' },
      ),
    ),
    null,
  );
});

test('도구: 스트리밍 연출은 허용 목록 안에서만 통과한다', () => {
  assert.equal(
    parseToolExecution(
      execution(
        'set_portfolio_stream_animation',
        'set_portfolio_stream_animation',
        { animation: 'scramble' },
      ),
    ).animation,
    'scramble',
  );
  assert.equal(
    parseToolExecution(
      execution(
        'set_portfolio_stream_animation',
        'set_portfolio_stream_animation',
        { animation: 'explode' },
      ),
    ),
    null,
  );
});

test('검색 도구는 등록하지 않고 과거 검색 결과 지시는 거절한다', () => {
  assert.equal(PORTFOLIO_UI_TOOL_NAMES.includes('get_portfolio_log_outline'), false);
  assert.equal(PORTFOLIO_UI_TOOL_NAMES.includes('open_portfolio_log'), false);
  for (const toolName of ['search_portfolio_logs', 'search-portfolio-logs']) {
    assert.equal(parseToolExecution(execution('show_portfolio_log_results', toolName, { query: 'AI', matchedSlugs: ['first-log'] })), null);
  }
});


test('도구: toolName이 어긋나거나 toolCallId가 없으면 거부한다', () => {
  assert.equal(
    parseToolExecution(
      execution('set_portfolio_theme', 'set_portfolio_accent', {
        theme: 'dark',
      }),
    ),
    null,
  );
  assert.equal(
    parseToolExecution({
      type: 'set_portfolio_theme',
      toolName: 'set_portfolio_theme',
      theme: 'dark',
    }),
    null,
  );
  assert.equal(
    parseToolExecution({
      type: 'set_portfolio_theme',
      toolName: 'set_portfolio_theme',
      toolCallId: 'x'.repeat(129),
      theme: 'dark',
    }),
    null,
  );
  assert.equal(parseToolExecution({ type: 'unknown_tool' }), null);
});

test('도구 목록: 실패한 항목만 버리고 최대 여덟 개까지 적용한다', () => {
  const valid = () =>
    execution('set_portfolio_theme', 'set_portfolio_theme', { theme: 'dark' });
  const values = [
    ...Array.from({ length: 10 }, () => valid()),
    { type: 'set_portfolio_theme', toolName: 'set_portfolio_theme' },
  ];
  assert.equal(parseToolExecutions(values).length, 8);
  assert.deepEqual(parseToolExecutions('배열이 아님'), []);
});

test('화면 상태: 허용 목록 밖 값이 섞이면 통째로 버린다', () => {
  const base = {
    page: 'research',
    anchor: 'research-timeline',
    researchTab: 'timeline',
    researchYear: '2025',
    researchDetails: { expanded: 1, total: 3, expandedYears: ['2025'] },
  };
  assert.deepEqual(parsePortfolioViewState(base), base);
  const schoolYears = {
    ...base, anchor: 'research-year-2011', researchYear: '2011',
    researchDetails: { expanded: 2, total: 18, expandedYears: ['2011'] },
  };
  assert.deepEqual(parsePortfolioViewState(schoolYears), schoolYears);
  assert.equal(parsePortfolioViewState({ ...base, page: 'admin' }), null);
  assert.equal(parsePortfolioViewState({ ...base, researchTab: 'gpu' }), null);
  assert.equal(
    parsePortfolioViewState({
      ...base,
      researchDetails: { expanded: 1, total: 3, expandedYears: ['1999'] },
    }),
    null,
  );
  // 펼친 수가 전체 수보다 많을 수는 없다.
  assert.equal(
    parsePortfolioViewState({
      ...base,
      researchDetails: { expanded: 5, total: 3, expandedYears: [] },
    }),
    null,
  );
});
