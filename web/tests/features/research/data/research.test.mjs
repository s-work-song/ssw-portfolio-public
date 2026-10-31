import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  readPortfolioViewState,
  resolvePortfolioViewTarget,
} from '../../../../src/features/webmcp/portfolioView.ts';
import { aboutDestinations } from '../../../../src/features/overview/data/about.ts';
import {
  researchPrimaryTabs,
  researchOptimizationTabs,
  researchPrimaryTabFromTab,
  researchTimelineItems,
} from '../../../../src/features/research/data/research.ts';
import {
  avx512Products,
  avx512SubsetGroups,
} from '../../../../src/features/research/data/avx512Support.ts';
import {
  chatbotArchitectureDiagram,
  chatbotArchitectureStages,
} from '../../../../src/features/research/data/chatbotArchitecture.ts';

test('연구 카드는 확인된 경험과 진행 중인 실험 주제를 안내하고 결과 수록을 주장하지 않는다', () => {
  const card = aboutDestinations.find((item) => item.href === '/about-me/research');
  assert.equal(card.desc, '하드웨어 구성과 소프트웨어 최적화, 두 영역을 함께 고려한 SIMD·AVX2 활용 경험을 정리했습니다. 실험 중인 내용도 소개합니다.');
  assert.ok(card.desc.endsWith('실험 중인 내용도 소개합니다.'));
  assert.doesNotMatch(card.desc, /실험 과정|결과/u);
  assert.doesNotMatch(card.desc, /CPU 오버클럭/);
  const topics = ['하드웨어 구성', '소프트웨어 최적화', 'SIMD·AVX2', '실험 중인 내용'];
  const positions = topics.map((topic) => card.desc.indexOf(topic));
  assert.ok(positions.every((position, index) => position >= 0 && (!index || position > positions[index - 1])));
  assert.deepEqual(researchPrimaryTabs.map((item) => item.label), [
    '연구·실험 이력 (Timeline)', '성능 최적화', '개발 도구 및 SI 활용', '오픈웨이트 모델 실험',
  ]);
});

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
    'research-cpu': ['research-cpu-simd', 'cpu', 'CPU & SIMD'],
    'research-memory': ['research-memory-layout', 'memory', '메모리 & 파일 I/O'],
    'research-serialization': ['research-serialization-packing', 'serialization', '직렬화 & 전송'],
  };
  const viewer = await readFile(new URL('../../../../src/features/research/ui/ResearchViewer.tsx', import.meta.url), 'utf8');
  for (const [action, [anchor, tab, label]] of Object.entries(expected)) {
    const target = resolvePortfolioViewTarget(action);
    assert.equal(target.route, `/about-me/research#${anchor}`, action);
    assert.equal(target.label, `성능 최적화의 ${label} 탭`, action);
    assert.equal(researchOptimizationTabs.find((item) => item.id === tab).label, label);
    assert.match(viewer, new RegExp(`'${anchor}': '${tab}'`, 'u'));
  }
});

test('소개 페이지의 성능 최적화 카드는 하위 탭으로 바로 가고 수치는 연구 페이지 표기와 같다', async () => {
  const preview = await readFile(new URL('../../../../src/features/research/ui/OptimizationPreview.tsx', import.meta.url), 'utf8');
  const panels = await readFile(new URL('../../../../src/features/research/ui/ResearchPanels.tsx', import.meta.url), 'utf8');
  for (const route of ['research_cpu', 'research_memory', 'research_serialization', 'research_optimization']) {
    assert.ok(preview.includes(`ACTION_ROUTES.${route}`), route);
  }
  assert.match(preview, /<ResearchLink href=\{item\.href\}/u, '카드는 채팅과 같은 이동 경로로 탭을 바꾼다');
  // 소개 카드에만 있는 수치가 생기지 않도록 연구 페이지 원문에 같은 표기가 있는지 본다.
  for (const figure of ['5,341 μs', '37 μs', '약 143배', '915 ms', '65 ms', '약 14배', '68,502 B', '74 B', '1/925', 'Protobuf + Nibble Pack + ZSTD']) {
    assert.ok(preview.includes(figure), figure);
    assert.ok(panels.includes(figure), `연구 페이지에 ${figure}`);
  }
});

test('도구 & SI 접목 탭 이동은 다른 하위 탭처럼 탭의 첫 카드로 간다', async () => {
  const panels = await readFile(new URL('../../../../src/features/research/ui/ResearchPanels.tsx', import.meta.url), 'utf8');
  const tab = panels.slice(panels.indexOf("activeTab === 'meta'"));
  assert.match(tab, /^[^]*?<div id="research-tools-ai" tabIndex=\{-1\}[^]*?Roslyn 컴파일러 기반 메타 프로그래밍/u);
  assert.ok(tab.indexOf('id="research-tools-ai"') < tab.indexOf('SI 에이전트 기반 개발 및 검증 실험'));
});

test('SI 에이전트 개발·검증 실험 카드는 경량 모델 설명 없이 에이전트 활용을 소개한다', async () => {
  const panels = await readFile(new URL('../../../../src/features/research/ui/ResearchPanels.tsx', import.meta.url), 'utf8');
  const card = panels.slice(panels.indexOf('id="research-ai-verification"'), panels.indexOf("activeTab === 'open-weight'"));
  assert.ok(card.length > 0);
  assert.match(card, /SI 에이전트 기반 개발 및 검증 실험/u);
  assert.match(card, /SI 에이전트를 개발·검증 과정에 활용하는 방법을 실험했습니다./u);
  assert.match(card, /「SI 에이전트 기반 개발 및 검증 실험」에서 에이전트에 맡긴 역할/u);
  assert.doesNotMatch(card, /경량|Gemma|Llama|LLM 기반 개발/u);
  for (const item of ['단위 테스트 생성 및 검증', '에이전트 역할 분담']) assert.ok(card.includes(item), item);
});

test('챗봇 구조 실험 카드로 바로 이동하고, 도착한 앵커를 오픈웨이트 모델 실험 탭 위치로 읽는다', async () => {
  const viewer = await readFile(new URL('../../../../src/features/research/ui/ResearchViewer.tsx', import.meta.url), 'utf8');
  const target = resolvePortfolioViewTarget('research-chatbot-architecture');
  assert.equal(target.route, '/about-me/research#research-chatbot-architecture');
  assert.equal(target.label, '오픈웨이트 모델 실험 탭의 챗봇 구조 실험 카드');
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
  const stages = ['통합 시스템 지침', '지침 전환', '분류 강제', '세션 분리 + 분류 강제', '메인과 서브에이전트 (현재)'];
  const positions = stages.map((stage) => card.indexOf(`<li><strong>${stage}</strong>`));
  assert.ok(positions.every((position, index) => position >= 0 && (!index || position > positions[index - 1])));
  assert.match(card, /4비트로 양자화한 버전이며, 위 내용은 이 모델에서 관찰한 결과입니다/u);
});

test('챗봇 구조 실험은 GitHub 문서 대신 카드 안에서 흐름도와 단계별 설명을 펼친다', async () => {
  const panels = await readFile(new URL('../../../../src/features/research/ui/ResearchPanels.tsx', import.meta.url), 'utf8');
  const details = await readFile(new URL('../../../../src/features/research/ui/ChatbotArchitectureDetails.tsx', import.meta.url), 'utf8');
  const doc = await readFile(new URL('../../../../docs/chatbot-decision-flow.md', import.meta.url), 'utf8');
  const card = panels.slice(panels.indexOf('id="research-chatbot-architecture"'));
  assert.doesNotMatch(panels, /CHATBOT_ARCHITECTURE_DOC_URL|chatbot-decision-flow\.md/u);
  assert.ok(card.indexOf('4비트로 양자화한 버전') < card.indexOf('<ChatbotArchitectureDetails />'));

  // 펼침 버튼이 영역을 가리키고, 처음 펼칠 때만 머메이드를 마운트한다.
  assert.match(details, /^'use client';/u);
  assert.match(details, /aria-expanded=\{expanded\}/u);
  assert.match(details, /aria-controls=\{regionId\}/u);
  assert.match(details, /id=\{regionId\}[^>]*hidden=\{!expanded\}/u);
  assert.match(details, /\{mounted && \([\s\S]*?<MermaidDiagram/u);
  assert.match(details, /compactDiagram=\{chatbotArchitectureDiagram\.compactSource\}/u);
  assert.match(details, /'흐름도와 단계별 설명 접기' : '흐름도와 단계별 설명 보기'/u);

  // 단계 제목은 원문 문서의 6절 소제목과 같고, 흐름도 두 형태 모두 다섯 단계를 그린다.
  assert.deepEqual(chatbotArchitectureStages.map(({ number, title }) => `${number}단계 · ${title}`), [
    '1단계 · 통합 시스템 지침', '2단계 · 지침 전환', '3단계 · 분류 강제', '4단계 · 세션 분리 + 분류 강제', '5단계 · 메인과 서브에이전트',
  ]);
  for (const { number, title } of chatbotArchitectureStages) {
    assert.ok(doc.includes(`### ${number}단계 · ${title}`), `문서 소제목: ${number}단계`);
    for (const source of [chatbotArchitectureDiagram.source, chatbotArchitectureDiagram.compactSource]) {
      assert.ok(source.includes(`subgraph s${number}["${number}단계 · ${title}`), `흐름도: ${number}단계`);
    }
  }
  assert.deepEqual(chatbotArchitectureStages.filter((stage) => stage.current).map((stage) => stage.number), [5]);
  // 방향을 비워 두면 머메이드가 부모(TB)와 반대인 LR로 그리므로 좁은 화면용은 TB를 명시한다.
  assert.equal(chatbotArchitectureDiagram.source.split('direction LR').length - 1, 5);
  assert.equal(chatbotArchitectureDiagram.compactSource.split('direction TB').length - 1, 5);
  assert.doesNotMatch(chatbotArchitectureDiagram.compactSource, /direction LR/u);

  // 요약 목록보다 자세한 원문 내용을 하십시오체로 옮기고, 1~4단계는 문제를 함께 적는다.
  assert.deepEqual(chatbotArchitectureStages.map((stage) => stage.outcome.label), ['문제', '문제', '문제', '문제', '결과']);
  const text = chatbotArchitectureStages.flatMap((stage) => [...stage.details, stage.outcome.text]);
  for (const sentence of text) assert.match(sentence, /니다\.$/u, sentence);
  const joined = text.join('\n');
  for (const phrase of ['분류용 모델을 따로 두지 않고', '자기 문맥 캐시', '처음에 한 번만 넣고 끝까지 바꾸지 않습니다', '시스템 지침을 통째로 다시 넣었습니다']) {
    assert.ok(joined.includes(phrase), phrase);
  }
  // 미세조정은 소개 페이지의 오픈웨이트 실험 카드에서만 다루고 구조 실험에는 넣지 않는다.
  assert.doesNotMatch(joined, /LoRA|미세조정/u);
  for (const sentence of text) assert.ok(!card.includes(sentence), `요약과 중복: ${sentence}`);
});

test('단계별 상세 흐름도는 세션 시작 지침부터 최종 답변까지 그리고 재주입과 교정 재시도를 구분한다', async () => {
  const details = await readFile(new URL('../../../../src/features/research/ui/ChatbotArchitectureDetails.tsx', import.meta.url), 'utf8');
  assert.match(details, /diagram=\{stage\.flow\}/u);
  assert.match(details, /compactDiagram=\{stage\.compactFlow\}/u);
  assert.match(details, /description=\{stage\.flowDescription\}/u);

  for (const stage of chatbotArchitectureStages) {
    for (const source of [stage.flow, stage.compactFlow].filter(Boolean)) {
      // 세션 시작 때 넣는 지침을 따로 두고, 화살표는 가로·세로로만 꺾는다.
      assert.match(source, /\(\["[^"]*세션 시작[^"]*"\]\):::start/u, `${stage.number}단계 세션 시작`);
      assert.match(source, /curve: step/u);
      assert.match(source, /최종 답변/u);
    }
    assert.match(stage.flowDescription, /니다\.$/u);
  }
  const [stage1, stage2, stage3, stage4, stage5] = chatbotArchitectureStages;
  // 도구를 쓰면 2·3단계는 도구 지침과 응답 지침을 차례로 통째로 다시 넣는다.
  for (const stage of [stage2, stage3]) {
    assert.match(stage.flow, /"도구 지침<br\/>통째로 다시 넣기"\]:::reinject/u);
    assert.match(stage.flow, /"응답 지침<br\/>통째로 다시 넣기"\]:::reinject/u);
  }
  for (const stage of [stage1, stage4, stage5]) assert.doesNotMatch(stage.flow, /:::reinject/u);
  // 3단계는 첫 출력이 분류 형식이 아니면 디코딩을 멈추고 다시 시도한다.
  assert.match(stage3.flow, /디코딩 중단/u);
  assert.match(stage3.flow, /-\.->\|"재시도"\| O/u);
  // 4단계는 두 겹 분류에 각각 교정 순환이 있고, 도구 결과는 채팅 세션의 최종 답변으로 돌아간다.
  assert.match(stage4.flow, /경량 분류/u);
  assert.match(stage4.flow, /상세 분류/u);
  assert.equal(stage4.flow.split('-.->|"재시도"|').length - 1, 2);
  assert.match(stage4.flow, /V -->\|"실행 결과"\| A/u);
  // 5단계는 작업 세션의 보고가 메인 세션으로 돌아와 최종 답변이 된다.
  assert.match(stage5.flow, /R -->\|"작업 보고"\| A/u);
  // 세션이 둘인 4·5단계는 화면 폭과 관계없이 세션마다 묶어 그린다.
  for (const stage of [stage4, stage5]) {
    for (const source of [stage.flow, stage.compactFlow]) {
      assert.equal(source.split('subgraph ').length - 1, 2, `${stage.number}단계 세션 묶음`);
    }
  }
  // 휴대폰 폭에서 너무 줄어드는 4·5단계만 좁은 화면용을 둔다.
  assert.deepEqual(chatbotArchitectureStages.filter((stage) => stage.compactFlow).map((stage) => stage.number), [4, 5]);
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
    '오픈웨이트 모델 실행 환경 구성', 'SI 에이전트 오케스트레이션', 'SI 활용 실험',
  ]);
  const orchestration = current[1];
  assert.match(orchestration.desc, /장기간.*세션.*복수의 SI 에이전트.*일상 업무/u);
  assert.match(orchestration.desc, /일상생활.*병행.*계속 실험/u);
  assert.doesNotMatch(orchestration.desc, /저수준|성능 최적화|포트폴리오 문서/u);
  assert.deepEqual(orchestration.tags, ['SI Agent', 'Orchestration']);
  const experiments = current[2];
  assert.ok(Array.isArray(experiments.desc));
  const paragraphs = experiments.desc.map(({ summary }) => summary);
  assert.deepEqual(paragraphs, [
    'SI 관련 업데이트를 꾸준히 살펴보며, 새로운 프론티어 모델을 포함하여 다양한 기능을 직접 사용하고 여러 MCP와 플러그인을 연결해 활용하는 실험을 진행하고 있습니다.',
    '이미지·3D 모델 등 리소스 제작과 바이브 코딩을 통한 2D·3D 게임 제작 실험을 진행하며, 활용 범위를 넓혀 가고 있습니다.',
  ]);
  const description = paragraphs.join('\n');
  const topics = ['SI 관련 업데이트', '새로운 프론티어 모델', '다양한 기능', '여러 MCP와 플러그인', '이미지·3D 모델', '바이브 코딩', '2D·3D 게임'];
  const positions = topics.map((topic) => description.indexOf(topic));
  assert.ok(positions.every((position, index) => position >= 0 && (!index || position > positions[index - 1])));
  assert.deepEqual(experiments.tags, ['Vibe Coding', '2D / 3D Game', 'SI Resources']);
  assert.equal(experiments.color, orchestration.color);
  assert.equal(new Set(current.map((item) => item.role)).size, current.length);
});

test('연구 본문의 제목과 AI 질문을 맞추고 측정 수치는 유지한다', async () => {
  const panels = await readFile(new URL('../../../../src/features/research/ui/ResearchPanels.tsx', import.meta.url), 'utf8');
  const page = await readFile(new URL('../../../../src/app/about-me/research/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(panels, /극대화|완전 차단|월등히|극심함|더 강력한|훨씬 이득|유기적인 협업/);
  assert.doesNotMatch(page, /엔지니어링 여정|상세 실험 보고서/);
  for (const heading of [
    '조건 분기와 SIMD 벡터화 성능 비교',
    'AoS·SoA 메모리 배치와 캐시 활용 비교',
    'SI 에이전트 기반 개발 및 검증 실험',
    '오픈웨이트 모델 챗봇 구조 실험',
  ]) {
    assert.ok(panels.includes(`「${heading}」`), `AI 질문: ${heading}`);
    assert.ok(panels.includes(`\n                  ${heading}`) || panels.includes(`\n                    ${heading}`), `제목: ${heading}`);
  }
  for (const value of ['5,341 μs', '11 μs', '485배', '68,502', '1/925', '60MB', '5분 이상', '1분 이내']) {
    assert.ok(panels.includes(value), value);
  }
  // 계수 정렬 카드는 공개 재구성 코드를 공개 러너로 다시 잰 수치만 쓰고, 측정 데이터를 함께 밝힌다.
  // 원인을 잘못 짚었던 옛 4/8-Way 비교와 예전 정렬 수치는 남기지 않는다.
  const countingSort = panels.slice(panels.indexOf('id="research-counting-sort"'), panels.indexOf('TAB 3: MEMORY'));
  for (const value of [
    '4-Way: 354 μs', '8-Way: 345 μs', '16-Way (주소 16개, 스필 발생): 424 μs', '16-Way (주소 1개 + 오프셋): 350 μs', '약 20% 느려졌습니다',
    'Array.Sort (표준 라이브러리): 39,733 μs', '4-Way 계수 정렬 (단일 스레드): 463 μs (~86배 개선)', '321 μs (~124배 개선)',
    '고정 시드(20260727)', '1,048,576바이트', '프로세스 3회 평균', '복사 포함',
  ]) {
    assert.ok(countingSort.includes(value), value);
  }
  assert.doesNotMatch(countingSort, /587 μs|27% 빨랐|461 μs|11,963 μs|130 μs|ArrayPool|unsafe/u);
  // WAW 카드의 코드 조각은 공개 4-Way 구현의 코드 줄을 그대로 옮긴 것이어야 한다.
  const fourWay = await readFile(new URL('../../../../../benchmarks/counting-sort/src/SSW.Benchmarks.CountingSort/FourWayCountingSortByteArraySorter.cs', import.meta.url), 'utf8');
  const fourWayLines = new Set(fourWay.split(/\r?\n/u).map((line) => line.trim()));
  const snippet = countingSort.slice(countingSort.indexOf('{`Span<int> buffer'), countingSort.indexOf('`}'));
  for (const line of snippet.slice(2).split('\n').map((value) => value.trim()).filter((value) => value.length > 0)) {
    assert.ok(fourWayLines.has(line), `코드 조각 줄이 공개 구현에 있다: ${line}`);
  }
  // 공개 코드로 다시 재면 조건 분기 수치가 달라지는 이유를 측정 조건과 함께 밝힌다.
  assert.ok(panels.includes('무작위 1 MiB 배열에서 100 이상 200 이하'), '측정 조건');
  assert.ok(panels.includes('공개 재구성 코드의 벤치마크도 같은 조건'), '공개 코드 조건');
  // 재측정 수치와 일자는 오차 범위 안이라 따로 적지 않는다.
  assert.doesNotMatch(panels, /5,264 μs|2026년 10월/u);
  // 페이지에 적은 조건이 공개 벤치마크 러너의 실제 입력과 같아야 한다.
  const runner = await readFile(new URL('../../../../../benchmarks/simd-avx2/bench/SSW.Benchmarks.SimdAvx2.Benchmarks/RangeSumBenchmarks.cs', import.meta.url), 'utf8');
  assert.ok(runner.includes('new(100, 200)'), '러너 범위');
  assert.ok(runner.includes('DeterministicByteData.Create(1_048_576)'), '러너 입력 크기');
});

test('최적화 탭의 주의점 카드는 벤치마크 목록 뒤에서 명령어 지원 위험을 차분하게 안내하고 숨겨 둔 기록 깨기는 드러내지 않는다', async () => {
  const panels = await readFile(new URL('../../../../src/features/research/ui/ResearchPanels.tsx', import.meta.url), 'utf8');
  const viewer = await readFile(new URL('../../../../src/features/research/ui/ResearchViewer.tsx', import.meta.url), 'utf8');
  const tab = panels.slice(panels.indexOf("activeTab === 'optimization'"), panels.indexOf("activeTab === 'cpu'"));
  const overview = tab.indexOf('id="research-optimization-overview"');
  const caution = tab.indexOf('id="research-optimization-caution"');
  const catalog = tab.indexOf('<BenchmarkCatalog />');
  // 개요가 "아래에 연결했다"고 한 벤치마크 목록을 바로 다음에 두고, 주의점은 그 뒤에 둔다.
  assert.ok(overview >= 0 && catalog > overview && caution > catalog, '개요, 벤치마크 목록, 주의점 순서');
  const card = tab.slice(caution);
  for (const phrase of [
    '에이전트로 성능을 끌어올릴 때 주의할 점', 'PlatformNotSupportedException', 'illegal instruction',
    'CPU 세대가 다른 일부 노드', '대체 경로(fallback)', '조용히 느린 경로', 'AVX-512의 파편화', 'AVX10', 'AVX2까지만',
  ]) {
    assert.ok(card.includes(phrase), phrase);
  }
  // 강한 표현과 인용은 기록 깨기 쪽에만 두고, 개요는 차분하게 둔다.
  assert.doesNotMatch(card, /토발즈|Torvalds|painful|악랄|🥚|기록 깨기/u);
  assert.match(viewer, /'research-optimization-caution': 'optimization'/u);
  // 채팅이 현재 위치를 읽을 때도 이 카드를 성능 최적화 탭으로 본다.
  const portfolioView = await readFile(new URL('../../../../src/features/webmcp/portfolioView.ts', import.meta.url), 'utf8');
  assert.match(portfolioView, /'research-optimization-caution': 'optimization'/u);
});

test('SIMD 카드의 기록 깨기는 접힌 채 두 트랙·규칙·연락처를 담고 소개 페이지와 최적화 개요에는 나오지 않는다', async () => {
  const panels = await readFile(new URL('../../../../src/features/research/ui/ResearchPanels.tsx', import.meta.url), 'utf8');
  const cpu = panels.slice(panels.indexOf('id="research-cpu-simd"'), panels.indexOf('id="research-counting-sort"'));
  const egg = cpu.slice(cpu.indexOf('<details'), cpu.indexOf('</details>'));
  assert.ok(egg.length > 0, 'CPU & SIMD 첫 카드 안에 있다');
  assert.doesNotMatch(egg, /<details[^>]*\bopen\b/u, '처음에는 접혀 있다');
  for (const rule of [
    'MultiplyAddAvx2RangeSumCalculator', 'PrefetchMultiplyAddAvx2RangeSumCalculator', 'DeterministicByteData.Create(1_048_576)',
    '100 이상 200 이하', '벡터 폭의 배수가 아니거나 시작 주소가 정렬되지 않아도', 'AVX-512 제외', 'x86-64-v3', 'AVX-VNNI', '단일 스레드', '10% 이상 빠르면',
    '절대적인 기준이 아닙니다', '에이전트와 함께 한계까지', '에이전트를 써도 좋습니다', '프리페치 거리(2048바이트)', '5% 이내',
    'mailto:sworksong@gmail.com', '문턱에 못 미치더라도', '이 실험의 차별점은',
    // 기준 수치는 공개 러너(i5-9600K)로 잰 값이고, 측정 환경을 함께 밝힌다.
    '기준 측정 결과', '트랙 1 기준 (Avx2MultiplyAdd): 19.92 μs', '트랙 2 기준 (Avx2PrefetchMultiplyAdd): 15.53 μs', '(Avx2Unrolled): 36.94 μs',
    'Intel Core i5-9600K', '.NET 8.0.23', 'BenchmarkDotNet 0.15.8', '같은 실행 안에서',
  ]) {
    assert.ok(egg.includes(rule), rule);
  }
  assert.doesNotMatch(egg, /__TRACK\d__/u, '빈칸이 남지 않는다');
  // 참가 이야기 전에 기록 깨기가 무엇인지부터 설명한다.
  const explained = egg.indexOf('기록으로 걸어 두었습니다');
  assert.ok(explained >= 0 && explained < egg.indexOf('누구나 참가할 수 있습니다'));
  assert.ok(egg.indexOf('누구나 참가할 수 있습니다') < egg.indexOf('참가하실 때도'));
  const runner = await readFile(new URL('../../../../../benchmarks/simd-avx2/bench/SSW.Benchmarks.SimdAvx2.Benchmarks/RangeSumBenchmarks.cs', import.meta.url), 'utf8');
  assert.ok(runner.includes('new MultiplyAddAvx2RangeSumCalculator()') && runner.includes('new PrefetchMultiplyAddAvx2RangeSumCalculator()'), '두 기준 코드를 러너에서 함께 잰다');
  // 기준 코드 링크는 main이 아니라 기준 코드를 넣은 커밋 해시에 고정한다.
  const benchmarkData = await readFile(new URL('../../../../src/features/research/data/benchmarks.ts', import.meta.url), 'utf8');
  assert.match(benchmarkData, /SIMD_RECORD_BASELINE_COMMIT = '[0-9a-f]{40}';/u);
  // 토발즈 인용과 출처는 기록 깨기에만 두고, 자세한 주의점은 최적화 개요 카드로 보낸다.
  assert.ok(egg.includes('I hope AVX512 dies a painful death'));
  assert.ok(egg.includes('https://www.phoronix.com/news/Linus-Torvalds-On-AVX-512'));
  // 다른 탭의 카드라 해시 링크로는 스크롤되지 않으므로, 탭 전환과 스크롤을 맡는 ResearchLink로 잇는다.
  assert.ok(egg.includes('<ResearchLink href="/about-me/research#research-optimization-caution" arrow={false}'));
  assert.doesNotMatch(egg, /<a href="#research-/u);
  // 위 비교 카드의 수치를 그대로 인용한다.
  assert.ok(cpu.indexOf('>34.5 μs<') < cpu.indexOf('<details'));
  assert.ok(egg.includes('C++ 구현(34.5 μs)과 C# SIMD 구현(37 μs)'));
  // 제목은 특정 언어에 묶지 않고, 이름은 "도전"이 아니라 "기록 깨기"로 쓴다.
  assert.doesNotMatch(egg.slice(egg.indexOf('<summary'), egg.indexOf('</summary>')), /C\+\+|어셈블리|C#/u);
  assert.doesNotMatch(egg, /도전/u);
  // 처우를 약속하는 문구 대신 의지 표명만 둔다.
  // 지금 구직 중이라는 뜻으로 읽히지 않게 가정을 먼저 깐다.
  assert.ok(egg.includes('만약 제가 구직 중이라면 처우보다 배움을 우선해 합류를 진지하게 검토하겠습니다'));
  assert.doesNotMatch(egg, /처우에 맞춰|근로기준법|수습/u);
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

test('AVX-512 파편화 표는 확인한 지원 현황을 담고, 나중 제품이 앞 제품의 조합을 다 포함하지 않는 사례를 보여 준다', async () => {
  const supports = (name, group) => avx512Products.find((item) => item.name === name).supported.includes(group);
  // 묶은 열은 하위 집합 이름을 모두 남긴다.
  assert.deepEqual(avx512SubsetGroups.flatMap((group) => group.members).length, 21);
  // 본문에서 예로 든 두 사례: Cooper Lake의 BF16은 Ice Lake에 없고, Tiger Lake의 VP2INTERSECT는 Sapphire Rapids에 없다.
  assert.ok(supports('Cooper Lake', 'bf16') && !supports('Ice Lake·Rocket Lake', 'bf16'));
  assert.ok(supports('Tiger Lake', 'vp2intersect') && !supports('Sapphire Rapids 이후', 'vp2intersect'));
  // Xeon Phi 전용 명령은 이후 제품에 다시 나오지 않는다.
  for (const item of avx512Products.filter((product) => !product.name.startsWith('Knights'))) {
    assert.ok(!item.supported.includes('er-pf') && !item.supported.includes('phi-dl'), item.name);
  }
  // AMD는 Zen 5에서 VP2INTERSECT가 더해지고, FP16은 아직 없다.
  assert.ok(!supports('AMD Zen 4', 'vp2intersect') && supports('AMD Zen 5', 'vp2intersect'));
  assert.ok(!supports('AMD Zen 5', 'fp16'));
  // 막혀 있거나 없는 제품은 빈 점 대신 사정을 적는다.
  for (const name of ['12세대 ~ Core Ultra', 'Sierra Forest']) {
    const item = avx512Products.find((product) => product.name === name);
    assert.equal(item.supported.length, 0, name);
    assert.ok(item.note.length > 0, name);
  }
  const panels = await readFile(new URL('../../../../src/features/research/ui/ResearchPanels.tsx', import.meta.url), 'utf8');
  const caution = panels.slice(panels.indexOf('id="research-optimization-caution"'), panels.indexOf("activeTab === 'cpu'"));
  assert.ok(caution.includes('<Avx512SupportTable />'));
  assert.ok(caution.includes('Cooper Lake의 BF16') && caution.includes('Tiger Lake의 VP2INTERSECT'));
  const table = await readFile(new URL('../../../../src/features/research/ui/Avx512SupportTable.tsx', import.meta.url), 'utf8');
  // 겹치는 모양은 원작자의 최신 그림으로 링크만 건다(저장소에 라이선스가 없어 그림을 옮겨 오지 않는다).
  assert.ok(table.includes('https://github.com/InstLatx64/InstLatX64_Misc/blob/main/SIMD_Euler/20260629_x64_AVX512_Euler_v341a_HR.png'));
  assert.ok(table.includes('InstLatX64'));
});
