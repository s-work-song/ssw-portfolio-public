import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  readPortfolioViewState,
  resolvePortfolioViewTarget,
} from '../../../../src/features/webmcp/portfolioView.ts';
import {
  researchPrimaryTabs,
  researchOptimizationTabs,
  researchPrimaryTabFromTab,
} from '../../../../src/features/research/data/research.ts';
import {
  avx512Products,
  avx512SubsetGroups,
} from '../../../../src/features/research/data/avx512Support.ts';
import {
  chatbotArchitectureDiagram,
  chatbotArchitectureStages,
} from '../../../../src/features/research/data/chatbotArchitecture.ts';


test('표현 변경 후에도 연구 탭 식별자와 분류 계약을 유지한다', () => {
  assert.deepEqual(researchPrimaryTabs.map((item) => item.id), ['overview', 'optimization', 'meta', 'open-weight']);
  assert.deepEqual(researchOptimizationTabs.map((item) => item.id), ['optimization', 'cpu', 'memory', 'serialization']);
  for (const item of researchOptimizationTabs) assert.equal(researchPrimaryTabFromTab(item.id), 'optimization');
  assert.equal(researchPrimaryTabFromTab('overview'), 'overview');
  assert.equal(researchPrimaryTabFromTab('meta'), 'meta');
  assert.equal(researchPrimaryTabFromTab('open-weight'), 'open-weight');
});

test('성능 최적화 하위 탭 이동은 각 탭의 첫 앵커로 가고, 그 앵커가 해당 탭을 연다', async () => {
  const expected = {
    'research-cpu': ['research-cpu-simd', 'cpu'],
    'research-memory': ['research-memory-layout', 'memory'],
    'research-serialization': ['research-serialization-packing', 'serialization'],
  };
  const viewer = await readFile(new URL('../../../../src/features/research/ui/ResearchViewer.tsx', import.meta.url), 'utf8');
  for (const [action, [anchor, tab]] of Object.entries(expected)) {
    const target = resolvePortfolioViewTarget(action);
    assert.equal(target.route, `/about-me/research#${anchor}`, action);
    assert.match(viewer, new RegExp(`'${anchor}': '${tab}'`, 'u'));
  }
});

test('소개 페이지의 성능 최적화 카드는 하위 탭으로 바로 간다', async () => {
  const preview = await readFile(new URL('../../../../src/features/research/ui/OptimizationPreview.tsx', import.meta.url), 'utf8');
  for (const route of ['research_cpu', 'research_memory', 'research_serialization', 'research_optimization']) {
    assert.ok(preview.includes(`ACTION_ROUTES.${route}`), route);
  }
  assert.match(preview, /<ResearchLink href=\{item\.href\}/u, '카드는 채팅과 같은 이동 경로로 탭을 바꾼다');
});

test('도구 & SI 접목 탭 이동은 다른 하위 탭처럼 탭의 첫 카드로 간다', async () => {
  const panels = await readFile(new URL('../../../../src/features/research/ui/ResearchPanels.tsx', import.meta.url), 'utf8');
  const tab = panels.slice(panels.indexOf("activeTab === 'meta'"));
  assert.match(tab, /id="research-tools-ai" tabIndex=\{-1\}/u);
  assert.ok(tab.indexOf('id="research-tools-ai"') < tab.indexOf('id="research-ai-verification"'));
});


test('챗봇 구조 실험 카드로 바로 이동하고, 도착한 앵커를 오픈웨이트 모델 실험 탭 위치로 읽는다', async () => {
  const viewer = await readFile(new URL('../../../../src/features/research/ui/ResearchViewer.tsx', import.meta.url), 'utf8');
  const target = resolvePortfolioViewTarget('research-chatbot-architecture');
  assert.equal(target.route, '/about-me/research#research-chatbot-architecture');
  assert.match(viewer, /'research-chatbot-architecture': 'open-weight'/u);
  const view = await readFile(new URL('../../../../src/features/webmcp/portfolioView.ts', import.meta.url), 'utf8');
  assert.match(view, /'research-chatbot-architecture': 'open-weight'/u);
});

test('오픈웨이트 모델 실험 탭과 학습 데이터 카드로 바로 이동하고, 각 앵커가 오픈웨이트 모델 실험 탭을 연다', async () => {
  const viewer = await readFile(new URL('../../../../src/features/research/ui/ResearchViewer.tsx', import.meta.url), 'utf8');
  const view = await readFile(new URL('../../../../src/features/webmcp/portfolioView.ts', import.meta.url), 'utf8');
  const cards = await readFile(new URL('../../../../src/features/research/ui/TrainingDataCards.tsx', import.meta.url), 'utf8');
  for (const [action, anchor] of [
    ['research-open-weight', 'research-chatbot-architecture'],
    ['research-training-data', 'research-training-data'],
    ['research-training-examples', 'research-training-examples'],
  ]) {
    assert.equal(resolvePortfolioViewTarget(action).route, `/about-me/research#${anchor}`, action);
    assert.match(viewer, new RegExp(`'${anchor}': 'open-weight'`, 'u'), anchor);
    assert.match(view, new RegExp(`'${anchor}': 'open-weight'`, 'u'), anchor);
  }
  for (const anchor of ['research-training-data', 'research-training-line', 'research-training-examples']) {
    assert.ok(cards.includes(`id="${anchor}" tabIndex={-1}`), anchor);
  }
  assert.match(view, /'open-weight': 'open-weight',/u);
});

test('챗봇 구조 실험 카드는 오픈웨이트 모델 실험 탭에 있고 다섯 단계와 관찰 범위를 함께 보여 준다', async () => {
  const panels = await readFile(new URL('../../../../src/features/research/ui/ResearchPanels.tsx', import.meta.url), 'utf8');
  const viewer = await readFile(new URL('../../../../src/features/research/ui/ResearchViewer.tsx', import.meta.url), 'utf8');
  assert.match(viewer, /'research-chatbot-architecture': 'open-weight'/u);
  const card = panels.slice(panels.indexOf('id="research-chatbot-architecture"'));
  assert.ok(panels.indexOf("activeTab === 'open-weight'") < panels.indexOf('id="research-chatbot-architecture"'));
  assert.ok(panels.indexOf("activeTab === 'meta'") < panels.indexOf("activeTab === 'open-weight'"));
  // 같은 탭에서 구조 실험 다음에 학습 데이터 카드가 온다.
  assert.ok(card.indexOf('<ChatbotArchitectureDetails />') < card.indexOf('<TrainingDataCards />'));
});

test('챗봇 구조 실험은 GitHub 문서 대신 카드 안에서 흐름도와 단계별 설명을 펼친다', async () => {
  const panels = await readFile(new URL('../../../../src/features/research/ui/ResearchPanels.tsx', import.meta.url), 'utf8');
  const details = await readFile(new URL('../../../../src/features/research/ui/ChatbotArchitectureDetails.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(panels, /CHATBOT_ARCHITECTURE_DOC_URL|chatbot-decision-flow\.md/u);

  // 펼침 버튼이 영역을 가리키고, 처음 펼칠 때만 머메이드를 마운트한다.
  assert.match(details, /^'use client';/u);
  assert.match(details, /aria-expanded=\{expanded\}/u);
  assert.match(details, /aria-controls=\{regionId\}/u);
  assert.match(details, /id=\{regionId\}[^>]*hidden=\{!expanded\}/u);
  assert.match(details, /\{mounted && \([\s\S]*?<MermaidDiagram/u);
  assert.match(details, /compactDiagram=\{chatbotArchitectureDiagram\.compactSource\}/u);

  // 흐름도 두 형태 모두 단계마다 묶음을 그린다.
  for (const { number } of chatbotArchitectureStages) {
    for (const source of [chatbotArchitectureDiagram.source, chatbotArchitectureDiagram.compactSource]) {
      assert.ok(source.includes(`subgraph s${number}[`), `흐름도: ${number}단계`);
    }
  }
  // 방향을 비워 두면 머메이드가 부모(TB)와 반대인 LR로 그리므로 좁은 화면용은 TB를 명시한다.
  assert.match(chatbotArchitectureDiagram.compactSource, /direction TB/u);
  assert.doesNotMatch(chatbotArchitectureDiagram.compactSource, /direction LR/u);
});

test('단계별 상세 흐름도는 넓은 화면·좁은 화면 소스와 설명을 머메이드에 넘긴다', async () => {
  const details = await readFile(new URL('../../../../src/features/research/ui/ChatbotArchitectureDetails.tsx', import.meta.url), 'utf8');
  assert.match(details, /diagram=\{stage\.flow\}/u);
  assert.match(details, /compactDiagram=\{stage\.compactFlow\}/u);
  assert.match(details, /description=\{stage\.flowDescription\}/u);
});


test('학창 시절 이동은 타임라인 탭·두 카드·실제로 보이는 2011 구간을 같은 연도로 읽는다', async (t) => {
  const yearTarget = resolvePortfolioViewTarget('research-2011');
  assert.equal(yearTarget.action, 'research-2011');
  assert.equal(yearTarget.route, '/about-me/research#research-year-2011');
  assert.equal(resolvePortfolioViewTarget('expand-research-year-details', '2011').researchYear, '2011');
  const viewer = await readFile(new URL('../../../../src/features/research/ui/ResearchViewer.tsx', import.meta.url), 'utf8');
  assert.match(viewer, /'research-year-2011': 'overview'/);
  assert.match(viewer, /addEventListener\('hashchange', selectHashTarget\)/);
  const timeline = await readFile(new URL('../../../../src/features/profile/ui/CareerTimeline.tsx', import.meta.url), 'utf8');
  assert.equal(timeline.split('item.year ?? item.period.match(/\\d{4}/u)?.[0]').length - 1, 2);
  assert.match(timeline, /data-research-year=\{periodYear\}/);
  assert.match(timeline, /renderPeriodBadge\(item.period, accentColor, periodAnchorId\)/);

  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  t.after(() => {
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  });
  let tab = 'overview';
  let schoolTop = 100;
  let nextYearTop = 700;
  const elements = {
    'research-timeline': { getBoundingClientRect: () => ({ bottom: 2000 }) },
    'research-year-2011': { getBoundingClientRect: () => ({ top: schoolTop }) },
    'research-year-2022': { getBoundingClientRect: () => ({ top: nextYearTop }) },
  };
  const details = ['첫 카드', '둘째 카드'].map((role) => ({
    classList: { contains: (value) => value === 'is-open' },
    parentElement: { dataset: { researchYear: '2011' }, textContent: `학창 시절 ${role}` },
  }));
  globalThis.window = {
    innerHeight: 800,
    location: { hash: '#research-year-2025' },
    getComputedStyle: () => ({ scrollPaddingTop: '96px' }),
  };
  globalThis.document = {
    documentElement: {},
    getElementById: (id) => elements[id] ?? null,
    querySelector: () => ({ id: `research-panel-${tab}` }),
    querySelectorAll: () => tab === 'overview' ? details : [],
  };
  const state = readPortfolioViewState('/about-me/research');
  assert.equal(state.researchTab, 'timeline');
  assert.equal(state.anchor, 'research-year-2011');
  assert.equal(state.researchYear, '2011');
  assert.deepEqual(state.researchDetails, { expanded: 2, total: 2, expandedYears: ['2011'] });
  schoolTop = -800;
  nextYearTop = 100;
  assert.equal(readPortfolioViewState('/about-me/research').researchYear, '2022');
  tab = 'cpu';
  globalThis.window.location.hash = '#research-year-2011';
  assert.deepEqual(readPortfolioViewState('/about-me/research'), {
    page: 'research', anchor: null, researchTab: 'cpu', researchYear: null, researchDetails: null,
  });
});


test('최적화 탭의 주의점 카드는 벤치마크 목록 뒤에 놓이고 숨겨 둔 기록 깨기는 드러내지 않는다', async () => {
  const panels = await readFile(new URL('../../../../src/features/research/ui/ResearchPanels.tsx', import.meta.url), 'utf8');
  const viewer = await readFile(new URL('../../../../src/features/research/ui/ResearchViewer.tsx', import.meta.url), 'utf8');
  const tab = panels.slice(panels.indexOf("activeTab === 'optimization'"), panels.indexOf("activeTab === 'cpu'"));
  const overview = tab.indexOf('id="research-optimization-overview"');
  const caution = tab.indexOf('id="research-optimization-caution"');
  const catalog = tab.indexOf('<BenchmarkCatalog />');
  // 개요가 "아래에 연결했다"고 한 벤치마크 목록을 바로 다음에 두고, 주의점은 그 뒤에 둔다.
  assert.ok(overview >= 0 && catalog > overview && caution > catalog, '개요, 벤치마크 목록, 주의점 순서');
  const card = tab.slice(caution);
  // 기록 깨기는 숨긴 이스터에그라 개요 카드에 드러내지 않는다.
  assert.doesNotMatch(card, /토발즈|Torvalds|painful|악랄|🥚|기록 깨기/u);
  assert.match(viewer, /'research-optimization-caution': 'optimization'/u);
  // 채팅이 현재 위치를 읽을 때도 이 카드를 성능 최적화 탭으로 본다.
  const portfolioView = await readFile(new URL('../../../../src/features/webmcp/portfolioView.ts', import.meta.url), 'utf8');
  assert.match(portfolioView, /'research-optimization-caution': 'optimization'/u);
});

test('SIMD 카드의 기록 깨기는 접힌 채 두고 소개 페이지와 최적화 개요에는 나오지 않는다', async () => {
  const panels = await readFile(new URL('../../../../src/features/research/ui/ResearchPanels.tsx', import.meta.url), 'utf8');
  const cpu = panels.slice(panels.indexOf('id="research-cpu-simd"'), panels.indexOf('id="research-counting-sort"'));
  const egg = cpu.slice(cpu.indexOf('<details'), cpu.indexOf('</details>'));
  assert.ok(egg.length > 0, 'CPU & SIMD 첫 카드 안에 있다');
  assert.doesNotMatch(egg, /<details[^>]*\bopen\b/u, '처음에는 접혀 있다');
  assert.doesNotMatch(egg, /__TRACK\d__/u, '빈칸이 남지 않는다');
  const runner = await readFile(new URL('../../../../../benchmarks/simd-avx2/bench/SSW.Benchmarks.SimdAvx2.Benchmarks/RangeSumBenchmarks.cs', import.meta.url), 'utf8');
  assert.ok(runner.includes('new MultiplyAddAvx2RangeSumCalculator()') && runner.includes('new PrefetchMultiplyAddAvx2RangeSumCalculator()'), '두 기준 코드를 러너에서 함께 잰다');
  // 기준 코드 링크는 main이 아니라 기준 코드를 넣은 커밋 해시에 고정한다.
  const benchmarkData = await readFile(new URL('../../../../src/features/research/data/benchmarks.ts', import.meta.url), 'utf8');
  assert.match(benchmarkData, /SIMD_RECORD_BASELINE_COMMIT = '[0-9a-f]{40}';/u);
  // 다른 탭의 카드라 해시 링크로는 스크롤되지 않으므로, 탭 전환과 스크롤을 맡는 ResearchLink로 잇는다.
  assert.ok(egg.includes('<ResearchLink href="/about-me/research#research-optimization-caution" arrow={false}'));
  assert.doesNotMatch(egg, /<a href="#research-/u);
  // 트랙 1 기준 코드는 unsafe 키워드와 포인터 없이 작성한다(주석은 빼고 본다).
  const track1 = await readFile(new URL('../../../../../benchmarks/simd-avx2/src/SSW.Benchmarks.SimdAvx2/Implementations/Simd/MultiplyAddAvx2RangeSumCalculator.cs', import.meta.url), 'utf8');
  const track1Code = track1.split(/\r?\n/u).filter((line) => !line.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(track1Code, /\bunsafe\b|\bfixed\s*\(|\b(?:byte|sbyte|short|int|long|void)\*/u);
  // 소개 페이지·미리보기·최적화 개요에는 드러내지 않는다.
  const overview = await readFile(new URL('../../../../src/app/about-me/page.tsx', import.meta.url), 'utf8');
  const preview = await readFile(new URL('../../../../src/features/research/ui/OptimizationPreview.tsx', import.meta.url), 'utf8');
  const caution = panels.slice(panels.indexOf('id="research-optimization-caution"'), panels.indexOf("activeTab === 'cpu'"));
  for (const source of [overview, preview, caution]) assert.doesNotMatch(source, /🥚|기록 깨기|MultiplyAdd/u);
});

test('AVX-512 표의 제품은 있는 열만 가리키고 지원 열이 비면 사정을 적는다', async () => {
  const groupIds = new Set(avx512SubsetGroups.map(({ id }) => id));
  assert.equal(groupIds.size, avx512SubsetGroups.length);
  assert.equal(new Set(avx512Products.map(({ name }) => name)).size, avx512Products.length);
  for (const item of avx512Products) {
    for (const group of item.supported) assert.ok(groupIds.has(group), `${item.name}: ${group}`);
    if (item.supported.length === 0) assert.ok(item.note?.length > 0, item.name);
  }
  const panels = await readFile(new URL('../../../../src/features/research/ui/ResearchPanels.tsx', import.meta.url), 'utf8');
  const caution = panels.slice(panels.indexOf('id="research-optimization-caution"'), panels.indexOf("activeTab === 'cpu'"));
  assert.ok(caution.includes('<Avx512SupportTable />'));
});
