// 챗봇 응답 파서(`parse.ts`)의 계약을 브라우저 없이 검증한다.
// Node가 타입을 지우고 TypeScript 원본을 그대로 실행하므로 별도 빌드가 없다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as chatParse from './parse.ts';
import { portfolioViewControlInput } from '../portfolio-tools/view.ts';
import { readPortfolioViewState, resolvePortfolioViewTarget } from '../webmcp/portfolioView.ts';
import { runPortfolioResearchDetailsControl, readCurrentResearchYear, readResearchDetailsSnapshot } from '../portfolio-tools/researchDetailsControl.ts';
import { executePortfolioUiTool, portfolioUiCommandFromChatExecution } from '../portfolio-tools/portfolioUiToolExecutor.ts';
import { parseModelHistory } from './modelHistory.ts';
import { isPortfolioTargetAligned, isPortfolioTargetReady } from '../portfolio-tools/viewTargetVisibility.ts';
import { workflowStageFromHash } from '../../app/about-me/ai-workflow/workflowStageNavigation.ts';
import { pageContextFromPathname } from './constants.ts';
import { experimentDomFixture } from '../portfolio-tools/experimentNavigationFixtures.mjs';

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

test('화면 제어 목적지 라벨은 백엔드 정본의 기존 상세·프로젝트 문구와 일치한다', () => {
  const labels = {
    'expand-research-details': '연구 여정 전체 상세 펼치기',
    'collapse-research-details': '연구 여정 전체 상세 접기',
  };
  for (const [action, label] of Object.entries(labels)) {
    assert.equal(resolvePortfolioViewTarget(action).label, label);
  }
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

test('연구 연도 앵커는 앞선 상세 카드의 높이 전환이 끝나기 전 도착 준비로 보지 않는다', t => {
  const previousWindow = globalThis.window;
  t.after(() => { globalThis.window = previousWindow; });
  globalThis.window = { getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) };
  let animations = [{ transitionProperty: 'grid-template-rows', playState: 'running' }];
  const timeline = { getAnimations: options => {
    assert.deepEqual(options, { subtree: true });
    return animations;
  } };
  const target = { getClientRects: () => [{}], closest: selector => selector === '#research-timeline' ? timeline : null };
  assert.equal(isPortfolioTargetReady(target), false);
  animations = [{ transitionProperty: 'grid-template-rows', playState: 'finished' }];
  assert.equal(isPortfolioTargetReady(target), true);
  animations = [{ transitionProperty: 'opacity', playState: 'running' }];
  assert.equal(isPortfolioTargetReady(target), true, '레이아웃과 무관한 시각 효과까지 기다리지 않는다');
});

test('화면 이동은 목표 상단 위치에 정렬된 뒤에만 도착으로 판정한다', () => {
  const target = (top, bottom) => ({ getBoundingClientRect: () => ({ top, bottom }) });
  assert.equal(isPortfolioTargetAligned(target(84.3, 120), 84, 900, 2_000, 720), true);
  assert.equal(isPortfolioTargetAligned(target(107.8, 240), 108, 900, 2_000, 720), true);
  assert.equal(isPortfolioTargetAligned(target(-518, -489), 84, 1_482, 2_000, 720), false);
  assert.equal(isPortfolioTargetAligned(target(710, 842), 108, 900, 2_000, 720), false);
  assert.equal(isPortfolioTargetAligned(target(650, 760), 108, 2_000, 2_000, 720), true);
  assert.equal(isPortfolioTargetAligned(target(721, 760), 108, 2_000, 2_000, 720), false);

  const provider = readFileSync(new URL('./ChatProvider.tsx', import.meta.url), 'utf8');
  const scrollStart = provider.indexOf('const animateDocumentScroll = useCallback(');
  const scrollEnd = provider.indexOf('\n  /** 패널 연출.', scrollStart);
  const scrollImplementation = provider.slice(scrollStart, scrollEnd);
  assert.doesNotMatch(scrollImplementation, /scroller\.scrollTop\s*=/u);
  assert.equal((scrollImplementation.match(/behavior: "instant"/gu) ?? []).length, 3);
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

test('둘러보기는 WebGL·자기소개서·연구 연도·SI 표기와 활용 단계를 포함한 35단계이며 저장 버전을 갱신한다', () => {
  assert.deepEqual(GUIDED_TOUR_STEPS.map((step) => step.id), [
    'overview', 'past-work', 'si-terminology', 'projects', 'agent-experiments',
    'experiments-svg', 'experiments-webgl', 'experiments-2d-games', 'experiments-3d-games',
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
  const categorySteps = GUIDED_TOUR_STEPS.slice(5, 5 + Object.keys(AGENT_EXPERIMENT_CATEGORY_ANCHORS).length);
  assert.deepEqual(categorySteps.map((item) => ACTION_ROUTES[item.actionId]),
    Object.values(AGENT_EXPERIMENT_CATEGORY_ANCHORS).map((anchor) => `/about-me#${anchor}`));
  for (const item of categorySteps) {
    assert.equal(guidedTourInteractionForStep(item), 'ready');
    assert.ok(parseAction({ id: item.actionId, label: ACTION_LABELS[item.actionId] }));
  }
  assert.equal(GUIDED_TOUR_SESSION_KEY, 'portfolio-guided-tour:v8:session');
  assert.equal(GUIDED_TOUR_VISIT_KEY, 'portfolio-guided-tour:v8:visit');
});

test('WebGL 이동 액션과 WebMCP 화면 조회는 같은 분류 앵커·작품 ID를 보존한다', t => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  t.after(() => { globalThis.window = previousWindow; globalThis.document = previousDocument; });
  assert.equal(ACTION_ROUTES.agent_experiments_webgl, '/about-me#agent-experiments-webgl');
  assert.deepEqual(parseAction({ id: 'agent_experiments_webgl', label: 'WebGL 실험 보기' }), {
    id: 'agent_experiments_webgl', label: 'WebGL 실험 보기',
  });
  for (const anchor of ['agent-experiments-webgl', 'exploded-atlas', 'iced-latte']) {
    const fixture = experimentDomFixture(undefined, anchor === 'iced-latte' ? 'iced-latte' : 'exploded-atlas');
    globalThis.document = fixture.document;
    globalThis.window = { location: { hash: `#${anchor}` } };
    const state = readPortfolioViewState('/about-me/');
    assert.equal(state.page, 'overview');
    assert.equal(state.anchor, anchor);
    assert.equal(parsePortfolioViewState(state).anchor, anchor);
  }
  assert.equal(PORTFOLIO_VIEW_ACTIONS.length, 71);
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

test('WebMCP UI 목록은 내장 모델 도구 12개와 같은 이름만 등록한다', () => {
  assert.deepEqual([...PORTFOLIO_UI_TOOL_NAMES].sort(), [
    'get_portfolio_ui_settings', 'set_portfolio_theme', 'set_portfolio_accent',
    'cycle_portfolio_accent', 'set_portfolio_chat_layout',
    'set_portfolio_chat_font', 'set_portfolio_chat_font_size',
    'set_portfolio_stream_animation', 'control_portfolio_view',
    'control_portfolio_research_details',
    'get_portfolio_view_state', 'open_portfolio_settings',
  ].sort());
  assert.deepEqual(PORTFOLIO_UI_TOOLS.cycle_portfolio_accent.parse({}), {});
  assert.throws(() => PORTFOLIO_UI_TOOLS.cycle_portfolio_accent.parse({ accent: 'rose' }));
});

test('WebMCP 설명은 학습되지 않은 외부 에이전트에도 독립적인 enum 의미와 이동/상세 경계를 제공한다', () => {
  const source = readFileSync(new URL('../webmcp/PortfolioWebMcpTools.tsx', import.meta.url), 'utf8');
  assert.match(source, /UI_TOOL_PRESENTATION/u);
  assert.match(source, /인자는 action 하나뿐이며 year나 target은 받지 않습니다/u);
  assert.match(source, /action: expand\(펼침\) 또는 collapse\(접기\)/u);
  assert.match(source, /all\(전체\), 2011\(학창 시절\), 2022, 2023, 2024, 2025, 2026/u);
  assert.match(source, /action과 target을 모두 지정해야/u);
  for (const label of ['system(운영체제 설정 따르기)', 'dock(오른쪽 고정 패널)',
    'noto-sans-kr(Noto Sans KR)', 'xlarge(매우 크게)', 'highlight-trail']) assert.ok(source.includes(label));
  assert.doesNotMatch(source, /from ['"][^'"]*(?:lora|prompt|training)[^'"]*['"]/iu);
});

test('해시 없는 연구 이동도 설정 DOM 대신 실제 연구 본문 준비를 확인한다', () => {
  const source = readFileSync(new URL('./ChatProvider.tsx', import.meta.url), 'utf8');
  assert.match(source, /pathWithoutHash\(route\) === "\/about-me\/research"/u);
  assert.match(source, /document\.getElementById\("research-experiments"\)\?\.closest\("main"\)/u);
  const viewer = readFileSync(new URL('../../components/ResearchViewer.tsx', import.meta.url), 'utf8');
  assert.match(viewer, /id="research-experiments"/u);
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
  const completedMessage = new Function('response', 'streamingMessageId', 'nextId', 'toolResults', 'taskSnapshot', 'reportSnapshot',
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
      const message = completedMessage(response, 'assistant-1', () => 'assistant-2', new Map([['theme-1', chip]]), () => undefined, () => ({}));
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
  assert.equal(api.match(/parseChatResponse\(payload, request\)/g)?.length, 2);
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

test('retry-after: 기본 10초, 명시한 0·초·HTTP-date·긴 대기값을 축소 없이 보존한다', () => {
  assert.equal(retryAfterMsFromHeader(null), 10_000);
  assert.equal(retryAfterMsFromHeader('  '), 10_000);
  assert.equal(retryAfterMsFromHeader('nope'), 10_000);
  assert.equal(retryAfterMsFromHeader('0'), 0);
  assert.equal(retryAfterMsFromHeader('-3'), 10_000);
  assert.equal(retryAfterMsFromHeader('7'), 7_000);
  assert.equal(retryAfterMsFromHeader('99999'), 99_999_000);
  assert.equal(retryAfterMsFromHeader('0.0011'), 2);
  const now = Date.parse('2026-10-24T00:00:00Z');
  assert.equal(retryAfterMsFromHeader('Sat, 24 Oct 2026 00:02:00 GMT', now), 120_000);
  assert.equal(retryAfterMsFromHeader('Fri, 23 Oct 2026 23:59:00 GMT', now), 0);
  assert.ok(Number.isNaN(retryAfterMsFromHeader(null, now, NaN)));
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

test('도구: 이동은 action만 받고 상세 제어는 별도 action,target 계약을 따른다', () => {
  assert.deepEqual(PORTFOLIO_UI_TOOLS.control_portfolio_view.parse({ action: 'research-2011' }), {
    action: 'research-2011',
  });
  assert.equal(parseToolExecution(execution('control_portfolio_view', 'control_portfolio_view', {
    action: 'research-2011',
  })).action, 'research-2011');
  for (const action of ['expand-research-year-details', 'collapse-research-year-details']) {
    assert.equal(parseToolExecution(execution('control_portfolio_view', 'control_portfolio_view', {
      action, year: '2011',
    })), null);
    assert.throws(() => PORTFOLIO_UI_TOOLS.control_portfolio_view.parse({ action, year: '2011' }));
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
    ),
    null,
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

test('소개에서 제외한 게임 모음 목적지는 도구 입력과 추천 이동에서 허용하지 않는다', () => {
  assert.ok(!PORTFOLIO_VIEW_ACTIONS.includes('project-game-collection-platform'));
  assert.throws(() => portfolioViewControlInput.parse({ action: 'project-game-collection-platform' }));
  assert.equal(parseToolExecution(execution('control_portfolio_view', 'control_portfolio_view', {
    action: 'project-game-collection-platform',
  })), null);
  assert.equal(resolvePortfolioViewTarget('project-game-collection-platform'), undefined);
  assert.equal(ACTION_ROUTES.project_game_collection, undefined);
  assert.equal(ACTION_LABELS.project_game_collection, undefined);
});

test('도구: 소개 페이지 안의 이동 목적지도 허용 목록에 들어 있다', () => {
  // 서버 목록(비공개 backend/src/shared/view-targets.js)과 수동으로 맞추는
  // 값이라, 개수가 달라지면 한쪽만 고친 것이다.
  assert.equal(PORTFOLIO_VIEW_ACTIONS.length, 71);
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

test('도구: 새 이동 스키마에는 year나 예전 상세 액션이 없고 모든 상세 조합은 전용 도구로 파싱한다', () => {
  const navigation = PORTFOLIO_UI_TOOLS.control_portfolio_view;
  assert.deepEqual(Object.keys(navigation.inputSchema.properties), ['action']);
  assert.deepEqual(navigation.inputSchema.required, ['action']);
  assert.equal(navigation.inputSchema.additionalProperties, false);
  for (const action of ['expand-research-details', 'collapse-research-details',
    'expand-research-year-details', 'collapse-research-year-details']) {
    assert.throws(() => navigation.parse({ action }));
    assert.equal(parseToolExecution(execution('control_portfolio_view', 'control_portfolio_view', { action })), null);
  }
  for (const action of PORTFOLIO_VIEW_ACTIONS) {
    assert.throws(() => navigation.parse({ action, year: undefined }));
    assert.equal(parseToolExecution(execution('control_portfolio_view', 'control_portfolio_view', { action, year: undefined })), null);
  }
  const details = PORTFOLIO_UI_TOOLS.control_portfolio_research_details;
  assert.deepEqual(details.inputSchema.required, ['action', 'target']);
  assert.equal(details.inputSchema.additionalProperties, false);
  for (const action of ['expand', 'collapse']) {
    for (const target of ['all', '2011', '2022', '2023', '2024', '2025', '2026']) {
      const input = { action, target };
      assert.deepEqual(details.parse(input), input);
      const parsed = parseToolExecution(execution('control_portfolio_research_details', 'control_portfolio_research_details', input));
      assert.equal(parsed.action, action);
      assert.equal(parsed.target, target);
      assert.deepEqual(portfolioUiCommandFromChatExecution(parsed), {
        name: 'control_portfolio_research_details', input,
      });
    }
  }
  for (const input of [{ action: 'expand' }, { target: 'all' }, { action: 'toggle', target: 'all' },
    { action: 'expand', target: '1999' }, { action: 'expand', target: 'all', year: '2026' }]) {
    assert.throws(() => details.parse(input));
    assert.equal(parseToolExecution(execution('control_portfolio_research_details', 'control_portfolio_research_details', input)), null);
  }
});

test('상세 제어: 전체와 연도는 토글하지 않고 실제 대상 카드 전체를 확인한 뒤 applied를 반환한다', async () => {
  for (const action of ['expand', 'collapse']) {
    for (const target of ['all', '2011', '2022', '2023', '2024', '2025', '2026']) {
      let now = 0;
      const order = [];
      let arrive;
      const result = await runPortfolioResearchDetailsControl({ action, target },
        route => { order.push(['navigate', route]); arrive(route.split('#')[1]); }, new AbortController().signal, {
          read: () => ({ pathname: '/portfolio/about-me/research/', targetReady: now >= 100,
            targetAligned: true,
            expanded: now >= 200 ? [action === 'expand', action === 'expand'] : [true, false] }),
          subscribe: listener => { arrive = listener; return () => {}; },
          publish: (...args) => order.push(['publish', ...args]), now: () => now,
          wait: async ms => { now += ms; }, basePath: '/portfolio', minimumDelayMs: 500, timeoutMs: 800,
        });
      assert.equal(result.status, 'applied');
      assert.equal(result.action, action);
      assert.equal(result.target, target);
      assert.equal(Object.hasOwn(result, 'year'), false);
      assert.equal(now, 500);
      assert.deepEqual(order[0], ['publish', action, target === 'all' ? undefined : target]);
      assert.equal(order[1][0], 'navigate');
      assert.match(order[1][1], target === 'all' ? /#research-timeline-overview$/u : new RegExp(`#research-year-${target}$`, 'u'));
    }
  }
});

test('상세 제어: 수락·경로 변경·일부 카드 반영만으로 성공하지 않고 숨김/미마운트/시간 초과도 실패한다', async () => {
  for (const snapshot of [
    { pathname: '/about-me/research', targetReady: true, targetAligned: true, expanded: [true, false] },
    { pathname: '/about-me/research', targetReady: false, targetAligned: true, expanded: [true, true] },
    { pathname: '/about-me/research', targetReady: true, targetAligned: true, expanded: [] },
    { pathname: '/about-me/resume', targetReady: true, targetAligned: true, expanded: [true, true] },
  ]) {
    let now = 0;
    const result = await runPortfolioResearchDetailsControl({ action: 'expand', target: '2026' },
      () => {}, new AbortController().signal, {
        read: () => snapshot, publish: () => {}, now: () => now,
        subscribe: listener => { listener('research-year-2026'); return () => {}; },
        wait: async ms => { now += ms; }, basePath: '', minimumDelayMs: 100, timeoutMs: 200,
      });
    assert.equal(result.status, 'failed');
    assert.equal(result.ok, false);
  }
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(runPortfolioResearchDetailsControl({ action: 'collapse', target: 'all' },
    () => assert.fail('취소한 명령은 이동하지 않는다'), controller.signal), { name: 'AbortError' });
});

test('전체 상세 제어는 변경 전 현재 연도를 한 번 캡처하고 전체 카드 반영·그 연도 재도착을 함께 기다린다', async t => {
  for (const action of ['expand', 'collapse']) {
    await t.test(action, async () => {
      let now = 0;
      let currentYear = '2025';
      let captures = 0;
      let arrive;
      let disposed = false;
      const expected = action === 'expand';
      const result = await runPortfolioResearchDetailsControl({ action, target: 'all' }, route => {
        assert.equal(route, '/about-me/research#research-year-2025');
        arrive('research-timeline-overview');
      }, new AbortController().signal, {
        readCurrentYear: () => { captures += 1; return currentYear; },
        read: (target, position) => {
          assert.equal(target, 'all', '카드 범위는 현재 연도가 아니라 전체여야 한다');
          assert.equal(position, '2025', '위치 관측은 변경 전 연도를 유지해야 한다');
          return { pathname: '/about-me/research/', targetReady: true,
            targetAligned: now >= 950,
            expanded: [expected, expected, now >= 850 ? expected : !expected] };
        },
        subscribe: listener => { arrive = listener; return () => { disposed = true; }; },
        publish: (mode, year) => {
          assert.equal(typeof arrive, 'function');
          assert.equal(mode, action);
          assert.equal(year, undefined, '연도 위치를 유지해도 전체 카드에 게시해야 한다');
          currentYear = '2011';
        },
        now: () => now,
        wait: async ms => { now += ms; if (now === 650) arrive('research-year-2025'); },
        basePath: '', minimumDelayMs: 500, timeoutMs: 8_000,
      });
      assert.equal(result.status, 'applied');
      assert.equal(result.target, 'all');
      assert.equal(result.route, '/about-me/research#research-year-2025');
      assert.equal(captures, 1);
      assert.equal(now, 950);
      assert.equal(disposed, true);
    });
  }
});

test('실제 타이머: 같은 연도에서 상세 커밋 전 조기도착하지 않고 높이 전환 후 한 번만 정렬한다', async t => {
  for (const action of ['expand', 'collapse']) {
    await t.test(action, async t => {
      const timers = new Set();
      const later = (callback, ms) => {
        const timer = setTimeout(() => { timers.delete(timer); callback(); }, ms);
        timers.add(timer);
      };
      t.after(() => { for (const timer of timers) clearTimeout(timer); });
      const startedAt = performance.now();
      const wanted = action === 'expand';
      let committed = false;
      let transitioning = false;
      let top = 180;
      let arrivalAt = null;
      let transitionEndedAt = null;
      let arrivals = 0;
      let navigations = 0;
      let arrive;
      let disposed = false;
      const controller = new AbortController();
      const result = await runPortfolioResearchDetailsControl({ action, target: 'all' }, (route, options) => {
        navigations += 1;
        assert.equal(route, '/about-me/research#research-year-2025');
        const scroll = () => {
          if (options?.signal?.aborted) return;
          if (options?.isTargetReady && !options.isTargetReady()) { later(scroll, 10); return; }
          // 공통 스크롤과 같이, 이미 정렬된 옛 레이아웃에서는 즉시 끝날 수 있다.
          top = 180;
          arrivals += 1;
          arrivalAt = performance.now();
          arrive('research-year-2025');
        };
        scroll();
      }, controller.signal, {
        readCurrentYear: () => '2025',
        read: () => ({ pathname: '/about-me/research', targetReady: !transitioning,
          targetAligned: Math.abs(top - 180) <= 2,
          expanded: [committed ? wanted : !wanted, committed ? wanted : !wanted] }),
        subscribe: listener => { arrive = listener; return () => { disposed = true; }; },
        publish: () => {
          // 브라우저 이벤트 이후 React 커밋과 CSS grid 높이 변경이 늦게 진행되는 레이스다.
          later(() => {
            committed = true;
            transitioning = true;
            top = -200;
            later(() => {
              top = -896.95;
              transitioning = false;
              transitionEndedAt = performance.now();
            }, action === 'collapse' ? 340 : 380);
          }, 60);
        },
        now: () => performance.now(),
        wait: (ms, signal) => new Promise((resolve, reject) => later(() => {
          if (signal.aborted) reject(new DOMException('The operation was aborted.', 'AbortError'));
          else resolve();
        }, ms)),
        basePath: '', minimumDelayMs: 500, timeoutMs: 1_200,
      });
      assert.equal(result.status, 'applied');
      assert.ok(arrivalAt >= transitionEndedAt && transitionEndedAt > startedAt);
      assert.equal(navigations, 1);
      assert.equal(arrivals, 1);
      assert.equal(top, 180);
      assert.equal(disposed, true);
    });
  }
});

test('도구 큐가 이동을 기다리다 취소되면 뒤에 대기하던 설정은 실행하지 않는다', async () => {
  const controller = new AbortController();
  let releaseNavigation;
  const calls = [];
  const navigation = new Promise(resolve => { releaseNavigation = resolve; });
  const queuedSetting = navigation.then(() => executePortfolioUiTool({
    name: 'set_portfolio_chat_font_size', input: { size: 'large' }, signal: controller.signal,
  }, { setChatFontSize: size => calls.push(size) }));
  controller.abort();
  releaseNavigation();
  await assert.rejects(queuedSetting, { name: 'AbortError' });
  assert.deepEqual(calls, []);
});

test('상세 위치 보존은 수동 스크롤의 실제 연도를 읽고 낡은 해시·비활성·숨김·미마운트를 제외한다', t => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  t.after(() => { globalThis.window = originalWindow; globalThis.document = originalDocument; });
  const defaults = { top: -120, nextTop: 1_200, panel: 'research-panel-overview',
    hidden: false, hasRects: true, mounted: true, timelineMounted: true, insideTimeline: true };
  const state = { ...defaults };
  const root = { scrollHeight: 5_000 };
  const target = (id, top) => ({ id,
    closest: selector => state.hidden && selector.includes('[inert]') ? {} : null,
    getClientRects: () => state.hasRects ? [{}] : [],
    getBoundingClientRect: () => ({ top: top(), bottom: top() + 100 }),
  });
  const year = target('research-year-2025', () => state.top);
  const nextYear = target('research-year-2026', () => state.nextTop);
  const overview = target('research-timeline-overview', () => 108);
  const timeline = { contains: element => state.insideTimeline && [year, nextYear].includes(element),
    getBoundingClientRect: () => ({ top: -1_500, bottom: 4_000 }) };
  const details = [true, true, false].map(expanded => ({
    classList: { contains: () => expanded }, getAttribute: () => String(!expanded),
  }));
  globalThis.window = {
    location: { pathname: '/about-me/research/', hash: '#research-year-2024' },
    innerHeight: 720, scrollY: 1_000,
    getComputedStyle: element => ({ display: 'block', visibility: 'visible',
      scrollPaddingTop: element === root ? '84px' : '0', scrollMarginTop: '24px' }),
  };
  globalThis.document = {
    documentElement: root,
    getElementById: id => ({ 'research-year-2025': state.mounted ? year : null,
      'research-year-2026': nextYear, 'research-timeline-overview': overview,
      'research-timeline': state.timelineMounted ? timeline : null })[id] ?? null,
    querySelector: () => state.panel ? { id: state.panel } : null,
    querySelectorAll: selector => selector.includes('data-research-year="2025"') ? details.slice(0, 2) : details,
  };
  // 중간까지 읽었더라도 보이는 연도를 보존하고, 최종 도착은 해당 연도 상단에 다시 맞춘다.
  assert.equal(readCurrentResearchYear(), '2025');
  assert.deepEqual(readResearchDetailsSnapshot('all', '2025'), {
    pathname: '/about-me/research/', targetReady: true, targetAligned: false,
    expanded: [true, true, false],
  });
  assert.equal(readResearchDetailsSnapshot('all').targetAligned, true);
  state.top = 108;
  assert.equal(readResearchDetailsSnapshot('all', '2025').targetAligned, true);
  assert.deepEqual(readResearchDetailsSnapshot('2025').expanded, [true, true]);
  for (const hash of ['#research-year-1999', '#research-year-%E0%A4%A']) {
    window.location.hash = hash;
    assert.equal(readCurrentResearchYear(), '2025', '잘못된 해시보다 실제 보이는 연도를 우선한다');
  }
  state.top = -1_000;
  state.nextTop = 108;
  window.location.hash = '#research-year-2025';
  assert.equal(readCurrentResearchYear(), '2026', '수동 스크롤 뒤 낡은 연도를 복구하지 않는다');
  for (const change of [
    { panel: 'research-panel-optimization' }, { panel: null }, { hidden: true },
    { hasRects: false }, { mounted: false }, { timelineMounted: false },
    { insideTimeline: false }, { top: 900 },
  ]) {
    Object.assign(state, defaults, change);
    assert.equal(readCurrentResearchYear(), null, JSON.stringify(change));
  }
  Object.assign(state, defaults);
  for (const pathname of ['/about-me/resume/', '/about-me/research-other/', '/other/about-me/research/']) {
    window.location.pathname = pathname;
    assert.equal(readCurrentResearchYear(), null, pathname);
  }
});

test('현재 연도가 없으면 전체 상세는 개요로 이동하고 연도 지정은 현재 연도 캡처보다 우선한다', async () => {
  for (const action of ['expand', 'collapse']) {
    for (const target of ['all', '2026']) {
      let now = 0;
      let arrive;
      const anchor = target === 'all' ? 'research-timeline-overview' : 'research-year-2026';
      const result = await runPortfolioResearchDetailsControl({ action, target }, route => {
        assert.equal(route, `/about-me/research#${anchor}`);
        arrive(anchor);
      }, new AbortController().signal, {
        readCurrentYear: basePath => {
          assert.equal(target, 'all', '지정 연도는 현재 위치를 읽지 않고 우선 적용한다');
          assert.equal(basePath, '/portfolio');
          return null;
        },
        read: (scope, position) => {
          assert.equal(scope, target);
          assert.equal(position, target);
          return { pathname: '/portfolio/about-me/research/', targetReady: true,
            targetAligned: true, expanded: [action === 'expand', action === 'expand'] };
        },
        subscribe: listener => { arrive = listener; return () => {}; },
        publish: (mode, year) => assert.deepEqual([mode, year], [action, target === 'all' ? undefined : target]),
        now: () => now, wait: async ms => { now += ms; },
        basePath: '/portfolio', minimumDelayMs: 500, timeoutMs: 800,
      });
      assert.equal(result.status, 'applied');
      assert.equal(now, 500);
    }
  }
});

test('공통 실행기: 직접 WebMCP와 채팅이 같은 상세 실행을 쓰고 이동→전체 펼침→연도 접기를 순서대로 확인한다', async t => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalEvent = globalThis.CustomEvent;
  t.after(() => { globalThis.window = originalWindow; globalThis.document = originalDocument; globalThis.CustomEvent = originalEvent; });
  const states = { '2025': false, '2026': false };
  const detail = year => ({ classList: { contains: () => states[year] }, getAttribute: () => String(!states[year]) });
  const target = { closest: () => null, getClientRects: () => [{}],
    getBoundingClientRect: () => ({ top: 0, bottom: 100 }) };
  let visibleYear = '2025';
  const anchors = Object.fromEntries(Object.keys(states).map(year => [year, { ...target,
    getBoundingClientRect: () => {
      const top = year === visibleYear ? 0 : year < visibleYear ? -1_000 : 1_200;
      return { top, bottom: top + 100 };
    },
  }]));
  const timeline = { contains: element => Object.values(anchors).includes(element),
    getBoundingClientRect: () => ({ top: -1_000, bottom: 3_000 }) };
  const listeners = new Set();
  const order = [];
  globalThis.CustomEvent = class { constructor(name, options) { this.type = name; this.detail = options.detail; } };
  globalThis.window = {
    location: { pathname: '/about-me/resume', hash: '' },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    innerHeight: 720, scrollY: 0,
    addEventListener: (_name, listener) => listeners.add(listener),
    removeEventListener: (_name, listener) => listeners.delete(listener),
    sessionStorage: { setItem: () => {} },
    dispatchEvent: event => {
      order.push(`dispatch:${event.detail.mode}:${event.detail.year ?? 'all'}`);
      const affected = event.detail.year ? [event.detail.year] : Object.keys(states);
      for (const year of affected) states[year] = event.detail.mode === 'expand';
    },
  };
  globalThis.document = {
    getElementById: id => id === 'research-timeline' ? timeline
      : id.startsWith('research-year-') ? anchors[id.replace('research-year-', '')] ?? null : target,
    querySelector: () => ({ id: 'research-panel-overview' }),
    documentElement: { scrollHeight: 720 },
    querySelectorAll: selector => selector.includes('data-research-year="2026"') ? [detail('2026')]
      : [detail('2025'), detail('2026')] };
  const runtime = { navigateRoute: route => {
    order.push(`navigate:${route}`);
    window.location.pathname = route.split('#')[0];
    window.location.hash = `#${route.split('#')[1]}`;
    visibleYear = route.match(/#research-year-(\d+)$/u)?.[1] ?? visibleYear;
    for (const listener of listeners) listener({ detail: { anchor: route.split('#')[1] } });
  } };
  const nav = await executePortfolioUiTool({ name: 'control_portfolio_view', input: { action: 'research-2025' } }, runtime);
  assert.equal(nav.action, 'research-2025');
  const direct = await executePortfolioUiTool({ name: 'control_portfolio_research_details', input: { action: 'expand', target: 'all' } }, runtime);
  assert.equal(direct.status, 'applied');
  assert.deepEqual(states, { '2025': true, '2026': true });
  const command = portfolioUiCommandFromChatExecution(execution('control_portfolio_research_details', 'control_portfolio_research_details', { action: 'collapse', target: '2026' }));
  const chat = await executePortfolioUiTool(command, runtime);
  assert.equal(chat.status, 'applied');
  assert.deepEqual(states, { '2025': true, '2026': false });
  assert.deepEqual(order.map(item => item.split(':').slice(0, 2).join(':')), [
    'navigate:/about-me/research#research-year-2025', 'dispatch:expand',
    'navigate:/about-me/research#research-year-2025', 'dispatch:collapse',
    'navigate:/about-me/research#research-year-2026',
  ]);
  assert.deepEqual(readResearchDetailsSnapshot('2026').expanded, [false]);
  assert.equal(listeners.size, 0);
});

test('상세 제어는 이미 목표 상태여도 토글하지 않고 중간 취소 후 성공을 반환하지 않는다', async () => {
  for (const action of ['expand', 'collapse']) {
    for (const target of ['all', '2011', '2026']) {
      let now = 0;
      let published;
      const result = await runPortfolioResearchDetailsControl({ action, target }, () => {},
        new AbortController().signal, {
          read: () => ({ pathname: '/about-me/research', targetReady: true,
            targetAligned: true,
            expanded: [action === 'expand', action === 'expand'] }),
          subscribe: listener => { listener(target === 'all' ? 'research-timeline-overview' : `research-year-${target}`); return () => {}; },
          publish: (...args) => { published = args; }, now: () => now,
          wait: async ms => { now += ms; }, basePath: '', minimumDelayMs: 500, timeoutMs: 800,
        });
      assert.equal(result.status, 'applied');
      assert.deepEqual(published, [action, target === 'all' ? undefined : target]);
      assert.equal(now, 500);
    }
  }
  const controller = new AbortController();
  await assert.rejects(runPortfolioResearchDetailsControl({ action: 'expand', target: 'all' },
    () => {}, controller.signal, {
      read: () => ({ pathname: '/about-me/research', targetReady: true, expanded: [false, true] }),
      subscribe: () => () => {},
      publish: () => {}, now: () => 0, wait: async () => { controller.abort(); },
      basePath: '', minimumDelayMs: 500, timeoutMs: 800,
    }), { name: 'AbortError' });
});

test('상세 카드가 500ms에 반영돼도 도착 신호와 실제 정렬 전의 다른 연도를 최종 관측으로 보내지 않는다', async () => {
  for (const target of ['all', '2011', '2025']) {
    let now = 0;
    let arrive;
    let disposed = false;
    const anchor = target === 'all' ? 'research-timeline-overview' : `research-year-${target}`;
    const result = await runPortfolioResearchDetailsControl({ action: 'collapse', target }, route => {
      assert.equal(typeof arrive, 'function', '이동 발행 전에 도착 관측이 시작돼야 한다');
      assert.equal(route.split('#')[1], anchor);
      arrive('research-year-2024');
    }, new AbortController().signal, {
      read: () => ({ pathname: '/about-me/research', targetReady: true,
        targetAligned: now >= 950, expanded: [false, false] }),
      subscribe: listener => { arrive = listener; return () => { disposed = true; }; },
      publish: () => assert.equal(typeof arrive, 'function'), now: () => now,
      wait: async ms => {
        now += ms;
        if (now === 650) arrive(anchor);
      }, basePath: '', minimumDelayMs: 500, timeoutMs: 8_000,
    });
    const viewState = { anchor: now < 950 ? 'research-year-2024' : anchor,
      researchYear: now < 950 ? '2024' : target === 'all' ? '2011' : target };
    assert.equal(result.status, 'applied');
    assert.equal(now, 950);
    assert.equal(viewState.anchor, anchor);
    assert.notEqual(viewState.researchYear, '2024');
    assert.equal(disposed, true);
  }
});

test('상세 도착 신호가 없으면 카드·정렬이 맞아도 기존 상한에서 실패하고 취소·예외도 구독을 정리한다', async () => {
  for (const mode of ['timeout', 'abort', 'navigate-error']) {
    let now = 0;
    let disposed = false;
    const controller = new AbortController();
    const completion = runPortfolioResearchDetailsControl({ action: 'expand', target: '2025' }, () => {
      if (mode === 'navigate-error') throw new Error('navigation failed');
    }, controller.signal, {
      read: () => ({ pathname: '/about-me/research', targetReady: true,
        targetAligned: true, expanded: [true, true] }),
      subscribe: listener => { listener('research-year-2024'); return () => { disposed = true; }; },
      publish: () => {}, now: () => now,
      wait: async ms => { now += ms; if (mode === 'abort') controller.abort(); },
      basePath: '', minimumDelayMs: 500, timeoutMs: 8_000,
    });
    if (mode === 'timeout') {
      assert.equal((await completion).status, 'failed');
      assert.equal(now, 8_000);
    } else {
      await assert.rejects(completion, mode === 'abort' ? { name: 'AbortError' } : /navigation failed/u);
    }
    assert.equal(disposed, true);
  }
});

test('native 이력은 구형 상세·제거된 게임 action 원문을 보존하지만 새 실행으로 해석하지 않는다', () => {
  for (const args of ['{"action":"expand-research-year-details","year":"2024"}',
    '{"action":"project-game-collection-platform"}']) {
    const call = { id: 'legacy-details', type: 'function', function: {
      name: 'control_portfolio_view', arguments: args } };
    const history = [{ role: 'assistant', content: '', tool_calls: [call] },
      { role: 'tool', tool_call_id: call.id, content: '{"accepted":true}' }];
    assert.deepEqual(parseModelHistory(history), history);
    assert.equal(parseToolExecution(execution('control_portfolio_view', 'control_portfolio_view', JSON.parse(args))), null);
  }
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
