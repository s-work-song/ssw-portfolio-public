import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  readPortfolioViewState,
  resolvePortfolioViewTarget,
} from '../features/webmcp/portfolioView.ts';
import { aboutDestinations } from './about.ts';
import {
  researchPrimaryTabs,
  researchOptimizationTabs,
  researchPrimaryTabFromTab,
  researchTimelineItems,
} from './research.ts';

test('연구 카드는 확인된 경험과 진행 중인 실험 주제를 안내하고 결과 수록을 주장하지 않는다', () => {
  const card = aboutDestinations.find((item) => item.href === '/about-me/research');
  assert.equal(card.desc, '하드웨어 구성과 소프트웨어 최적화, 두 영역을 함께 고려한 SIMD·AVX2 활용 경험을 정리했습니다. 실험중인 내용도 소개합니다.');
  assert.ok(card.desc.endsWith('실험중인 내용도 소개합니다.'));
  assert.doesNotMatch(card.desc, /실험 과정|결과/u);
  assert.doesNotMatch(card.desc, /CPU 오버클럭/);
  const topics = ['하드웨어 구성', '소프트웨어 최적화', 'SIMD·AVX2', '실험중인 내용'];
  const positions = topics.map((topic) => card.desc.indexOf(topic));
  assert.ok(positions.every((position, index) => position >= 0 && (!index || position > positions[index - 1])));
  assert.deepEqual(researchPrimaryTabs.map((item) => item.label), [
    '연구·실험 이력 (Timeline)', '성능 최적화', '개발 도구 및 AI 활용',
  ]);
});

test('표현 변경 후에도 연구 탭 식별자와 분류 계약을 유지한다', () => {
  assert.deepEqual(researchPrimaryTabs.map((item) => item.id), ['overview', 'optimization', 'meta']);
  assert.deepEqual(researchOptimizationTabs.map((item) => item.id), ['optimization', 'cpu', 'memory', 'serialization']);
  for (const item of researchOptimizationTabs) assert.equal(researchPrimaryTabFromTab(item.id), 'optimization');
  assert.equal(researchPrimaryTabFromTab('overview'), 'overview');
  assert.equal(researchPrimaryTabFromTab('meta'), 'meta');
});

test('기존 연구 이력의 시기를 유지하고 2026년 이후 AI 활용 실험을 추가한다', () => {
  assert.deepEqual(researchTimelineItems.map((item) => item.period), [
    '학창 시절', '학창 시절', '2022년', '2022년', '2022년',
    '2023년', '2023년', '2023년', '2023년', '2024년', '2024년', '2024년',
    '2025년', '2025년', '2025년', '2026–현재', '2026–현재', '2026–현재',
  ]);
  assert.equal(researchTimelineItems[0].role, '하드웨어 성능 측정 및 최적화');
  assert.deepEqual(researchTimelineItems.filter((item) => item.year === '2011').map((item) => item.role), [
    '하드웨어 성능 측정 및 최적화', 'SSD RAID 0 및 2-Way SLI 구성',
  ]);
  assert.ok(researchTimelineItems.filter((item) => item.year === '2011').every((item) => item.period === '학창 시절'));
  const text = researchTimelineItems.map((item) => {
    const description = typeof item.desc === 'string'
      ? item.desc
      : item.desc.flatMap(({ summary, details = [] }) => [summary, ...details]).join('\n');
    return `${item.role} ${description}`;
  }).join('\n');
  assert.doesNotMatch(text, /한계 돌파|대폭|깊게 탐구|가볍게|전면 도입|극복/);
});

test('학창 시절 이동은 타임라인 탭·두 카드·실제로 보이는 2011 구간을 같은 연도로 읽는다', async (t) => {
  assert.deepEqual(resolvePortfolioViewTarget('research-2011'), {
    action: 'research-2011', route: '/about-me/research#research-year-2011',
    label: '연구 경험의 학창 시절 위치',
    message: '연구 경험의 학창 시절 위치로 이동을 시작했습니다.',
  });
  assert.equal(resolvePortfolioViewTarget('expand-research-year-details', '2011').researchYear, '2011');
  const viewer = await readFile(new URL('../components/ResearchViewer.tsx', import.meta.url), 'utf8');
  assert.match(viewer, /'research-year-2011': 'overview'/);
  assert.match(viewer, /addEventListener\('hashchange', selectHashTarget\)/);
  const timeline = await readFile(new URL('../components/CareerTimeline.tsx', import.meta.url), 'utf8');
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
  const details = researchTimelineItems.filter((item) => item.year === '2011').map((item) => ({
    classList: { contains: (value) => value === 'is-open' },
    parentElement: { dataset: { researchYear: item.year }, textContent: `${item.period} ${item.role}` },
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

test('장기 세션 기반 에이전트 협업과 게임·리소스 제작 실험을 별도 카드로 표시한다', () => {
  const current = researchTimelineItems.filter((item) => item.period === '2026–현재');
  assert.deepEqual(current.map((item) => item.role), [
    '오픈 웨이트 AI 모델 실행 환경 구성', 'AI 에이전트 오케스트레이션', 'AI 활용 실험',
  ]);
  const orchestration = current[1];
  assert.match(orchestration.desc, /장기간.*세션.*복수의 AI 에이전트.*일상 업무/u);
  assert.match(orchestration.desc, /일상생활.*병행.*계속 실험/u);
  assert.doesNotMatch(orchestration.desc, /저수준|성능 최적화|포트폴리오 문서/u);
  assert.deepEqual(orchestration.tags, ['AI Agent', 'Orchestration']);
  const experiments = current[2];
  assert.ok(Array.isArray(experiments.desc));
  const paragraphs = experiments.desc.map(({ summary }) => summary);
  assert.deepEqual(paragraphs, [
    'AI 관련 업데이트를 꾸준히 살펴보며, 새로운 프론티어 모델을 포함하여 다양한 기능을 직접 사용하고 여러 MCP와 플러그인을 연결해 활용하는 실험을 진행하고 있습니다.',
    '이미지·3D 모델 등 리소스 제작과 바이브 코딩을 통한 2D·3D 게임 제작 실험을 진행하며, 활용 범위를 넓혀 가고 있습니다.',
  ]);
  const description = paragraphs.join('\n');
  const topics = ['AI 관련 업데이트', '새로운 프론티어 모델', '다양한 기능', '여러 MCP와 플러그인', '이미지·3D 모델', '바이브 코딩', '2D·3D 게임'];
  const positions = topics.map((topic) => description.indexOf(topic));
  assert.ok(positions.every((position, index) => position >= 0 && (!index || position > positions[index - 1])));
  assert.deepEqual(experiments.tags, ['Vibe Coding', '2D / 3D Game', 'AI Resources']);
  assert.equal(experiments.color, orchestration.color);
  assert.equal(new Set(current.map((item) => item.role)).size, current.length);
});

test('연구 본문의 제목과 AI 질문을 맞추고 측정 수치는 유지한다', async () => {
  const panels = await readFile(new URL('../components/research/ResearchPanels.tsx', import.meta.url), 'utf8');
  const page = await readFile(new URL('../app/about-me/research/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(panels, /극대화|완전 차단|월등히|극심함|더 강력한|훨씬 이득|유기적인 협업/);
  assert.doesNotMatch(page, /엔지니어링 여정|상세 실험 보고서/);
  for (const heading of [
    '조건 분기와 SIMD 벡터화 성능 비교',
    'AoS·SoA 메모리 배치와 캐시 활용 비교',
    '생성형 AI 기반 개발 및 검증 실험',
  ]) {
    assert.ok(panels.includes(`「${heading}」`), `AI 질문: ${heading}`);
    assert.ok(panels.includes(`\n                  ${heading}`) || panels.includes(`\n                    ${heading}`), `제목: ${heading}`);
  }
  for (const value of ['5,341 μs', '11 μs', '485배', '461 μs', '587 μs', '27%', '68,502', '1/925', '60MB', '5분 이상', '1분 이내']) {
    assert.ok(panels.includes(value), value);
  }
});
