import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { agentExperiments } from '../../../../src/features/experiments/data/agentExperiments.ts';
import { portfolioDiagramLayouts } from '../../../../src/features/architecture/data/portfolioDiagram.ts';
import {
  deploymentDiagrams,
  deploymentMemoryComparison,
  deploymentMemoryServices,
  deploymentMemoryTotals,
  deploymentMemorySource,
  deploymentProjects,
  infrastructureTransition,
  infrastructureMigrationReasons,
  portfolioLinkedExperiments,
} from '../../../../src/features/architecture/data/deployment.ts';

const portfolio = deploymentDiagrams.find(({ id }) => id === 'portfolio');
const commerce = deploymentDiagrams.find(({ id }) => id === 'e-commerce');
const edges = (source) => [...source.matchAll(/\b(\w+) -->[^\n]*?\b(\w+)\s*$/gmu)]
  .map(([, from, to]) => [from, to]);

test('프로젝트 카드와 상세 슬라이드는 같은 순서·이름을 쓴다', () => {
  assert.deepEqual(deploymentDiagrams.map(({ id }) => id), deploymentProjects.map(({ id }) => id));
  assert.deepEqual(deploymentDiagrams.map(({ title }) => title), deploymentProjects.map(({ label }) => label));
});

test('배포 구성은 전체 연결 그림 없이 네 프로젝트 단위로만 제공한다', async () => {
  const data = await readFile(new URL('../../../../src/features/architecture/data/deployment.ts', import.meta.url), 'utf8');
  const component = await readFile(new URL('../../../../src/features/architecture/ui/DeploymentOverview.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(data, /deploymentOverview(?:Diagram|Source|CompactSource)|전체 프로젝트 연결 구조/u);
  assert.doesNotMatch(component, /deploymentOverviewDiagram|<MermaidDiagram|전체 구조도/u);
  assert.match(component, /deploymentProjects.map/u);
  assert.match(component, /<DeploymentDiagramCarousel diagrams=\{deploymentDiagrams\} \/>/u);
});

test('프로젝트 구성은 세로 흐름이며 이커머스는 분리된 시안용 연결을 사용하지 않는다', () => {
  for (const diagram of deploymentDiagrams) {
    assert.match(diagram.source, /^flowchart TB\n/u);
    assert.match(diagram.compactSource, /^flowchart TB\n/u);
    assert.ok(diagram.description.trim());
  }
  assert.doesNotMatch(commerce.source + commerce.compactSource, /~~~|BusinessClient|SharedClient/u);
});


test('포트폴리오의 외부 실험 링크는 갤러리의 실제 공개 작품을 가리키고 API·추론 경로와 분리한다', () => {
  const experiments = new Map(agentExperiments.map(experiment => [experiment.id, experiment]));
  for (const item of portfolioLinkedExperiments.flatMap(group => group.experiments)) {
    const experiment = experiments.get(item.id);
    assert.ok(experiment?.demoUrl && !experiment.hidden, item.id);
    assert.ok(portfolio.source.includes(item.label), item.label);
  }
  for (const source of [portfolio.source, portfolio.compactSource]) {
    const graph = edges(source);
    for (const node of ['GPTSites', 'StaticDemo']) {
      assert.equal(graph.some(([from]) => from === node), false);
      assert.equal(graph.some(([from, to]) => from !== 'Browser' && to === node), false);
    }
  }
});

test('포트폴리오 API 기둥은 직선이고 두 외부 데모는 데스크톱·모바일 모두 같은 오른쪽으로 분기한다', async () => {
  for (const layout of Object.values(portfolioDiagramLayouts)) {
    const byId = new Map(layout.nodes.map(node => [node.id, node]));
    const center = id => byId.get(id).x + byId.get(id).width / 2;
    const mainIds = ['PortfolioPages', 'Browser', 'PiApi', 'ColabTunnel', 'Colab'];
    assert.ok(mainIds.every(id => center(id) === center('Browser')));
    assert.ok(['GPTSites', 'StaticDemo'].every(id => byId.get(id).x > byId.get('Browser').x + byId.get('Browser').width));
    for (const { label } of portfolioLinkedExperiments[1].experiments) {
      assert.ok(byId.get('StaticDemo').lines.includes(label));
    }
    assert.ok(byId.get('StaticDemo').height >= byId.get('StaticDemo').lines.length * 24 + 40);
    assert.ok(byId.get('StaticDemo').y + byId.get('StaticDemo').height + 20 <= layout.height);
    assert.deepEqual(layout.links.map(({ from, to }) => [from, to]).sort(), edges(portfolio.source).sort());
    for (const node of layout.nodes) {
      assert.ok(node.x >= 0 && node.y >= 0 && node.x + node.width <= layout.width && node.y + node.height <= layout.height);
    }
    for (const link of layout.links) {
      for (let i = 1; i < link.points.length; i++) {
        const [x, y] = link.points[i];
        const [px, py] = link.points[i - 1];
        assert.ok(x === px || y === py, `${link.from}-${link.to}`);
      }
    }
  }
  const component = await readFile(new URL('../../../../src/features/architecture/ui/DeploymentDiagramCarousel.tsx', import.meta.url), 'utf8');
  assert.match(component, /diagram\.id === 'portfolio'[\s\S]*?<PortfolioDeploymentDiagram/u);
});


test('이커머스의 프런트·백엔드·추론·공용 파일과 채팅은 하나의 연결된 프로젝트이며 클라이언트는 중복하지 않는다', () => {
  for (const source of [commerce.source, commerce.compactSource]) {
    const ids = [...source.matchAll(/^\s+(\w+)\[/gmu)].map(([, id]) => id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids.filter(id => id === 'Browser').length, 1);
    assert.equal(ids.filter(id => id === 'Workers').length, 1);
    const graph = edges(source);
    const reached = new Set(['Browser']);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [from, to] of graph) {
        if (!reached.has(from) && !reached.has(to)) continue;
        for (const id of [from, to]) if (!reached.has(id)) { reached.add(id); changed = true; }
      }
    }
    assert.deepEqual(reached, new Set(ids));
    assert.ok(graph.some(([from, to]) => from === 'Workers' && to === 'InferenceTunnel'));
    assert.ok(graph.some(([from, to]) => from === 'InferenceTunnel' && to === 'LLM'));
    assert.equal(graph.some(([from, to]) => from === 'Browser' && to === 'LLM'), false);
  }
});


test('메모리 비교의 합계·배율은 서비스별 값에서 계산한 값과 같다', () => {
  assert.equal(new Set(deploymentMemoryServices.map(service => service.id)).size, deploymentMemoryServices.length);
  for (const service of deploymentMemoryServices) for (const key of ['before', 'after']) assert.ok(Number.isFinite(service[key]) && service[key] > 0);
  const sum = (rows, key) => Number(rows.reduce((total, row) => total + row[key], 0).toFixed(2));
  const before = sum(deploymentMemoryServices, 'before');
  const after = sum(deploymentMemoryServices, 'after');
  assert.deepEqual(deploymentMemoryTotals.map(total => [total.before, total.after]), [[before, after]]);
  assert.equal(deploymentMemoryComparison.before.memoryMiB, before);
  assert.equal(deploymentMemoryComparison.after.memoryMiB, after);
  assert.equal(Number((before / after).toFixed(1)), deploymentMemoryComparison.ratio);
  assert.equal(Number(((1 - after / before) * 100).toFixed(2)), deploymentMemoryComparison.reductionPercent);
});


test('메모리 비교 라벨은 단계·언어·실행 환경으로 나눠 표시한다', async () => {
  const memory = await readFile(new URL('../../../../src/features/architecture/ui/DeploymentMemoryHistory.tsx', import.meta.url), 'utf8');
  assert.match(memory, /const \[phase, \.\.\.details\] = row.label.split\(' · '\)/u);
  assert.match(memory, /<span>\{details.join\(' · '\)\}<\/span>/u);
  assert.doesNotMatch(memory, /chartEnvironment|<br\s*\/?\s*>/u);
});


test('메모리 기록은 정적 요약과 전후 비교 표 하나로 표시하고 삭제 요청을 유지한다', async () => {
  const component = await readFile(new URL('../../../../src/features/architecture/ui/InfrastructureMigration.tsx', import.meta.url), 'utf8');
  assert.equal(component.split('<DeploymentMemoryHistory />').length - 1, 1);
  const memory = await readFile(new URL('../../../../src/features/architecture/ui/DeploymentMemoryHistory.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(memory, /['"]use client['"]|fetch\(|useState/u);
  assert.equal(memory.split('<table ').length - 1, 1);
  assert.doesNotMatch(memory, /서버 전체 메모리 이력|host-memory-title|deploymentHostMemoryHistory|baseline|이전 A|이전 B|\bbeforeA\b|\bbeforeB\b/u);
  assert.match(memory, /data-memory-service=\{service.id\}/u);
  assert.match(memory, /scope="row"/u);
  assert.match(component, /infrastructureMigrationReasons.map/u);
  const data = await readFile(new URL('../../../../src/features/architecture/data/deployment.ts', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../../../src/features/architecture/ui/DeploymentMemoryHistory.module.css', import.meta.url), 'utf8');
  assert.doesNotMatch(data + css, /deploymentHostMemoryHistory|hostTable|baselineA|baselineB/u);
  assert.match(css, /content: attr\(data-label\)/u);
  assert.doesNotMatch(css, /overflow-x: (?:auto|scroll)|min-width: \d{3,}px/u);
});

test('메모리 요약은 눈금과 상단 여유가 있는 세로 막대에서 같은 0 기준·실제 수치 비율을 사용한다', async () => {
  const memory = await readFile(new URL('../../../../src/features/architecture/ui/DeploymentMemoryHistory.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../../../src/features/architecture/ui/DeploymentMemoryHistory.module.css', import.meta.url), 'utf8');
  assert.match(memory, /className=\{styles.flowArrow\} aria-hidden="true"/u);
  assert.match(memory, /Math.max\(\.\.\.chartRows.map\(row => row.memoryMiB\)\)/u);
  assert.match(memory, /Math.ceil\(maximumMiB \/ tickStepMiB\) \* tickStepMiB/u);
  assert.match(memory, /const tickStepMiB = 1000/u);
  assert.match(memory, /data-memory-chart="columns" data-memory-axis-max=\{axisMaximumMiB\}/u);
  assert.match(memory, /data-memory-tick=\{tick\}/u);
  assert.match(memory, /height: `\$\{\(row.memoryMiB \/ axisMaximumMiB\) \* 100\}%`/u);
  assert.match(memory, /data-memory-bar=\{row.id\} data-memory-mib=\{row.memoryMiB\}/u);
  assert.match(memory, /aria-labelledby="memory-chart-title" aria-describedby="migration-memory-scope"/u);
  assert.match(memory, /role="group" aria-label=\{`\$\{row.label\}: \$\{row.value\}`\}/u);
  assert.doesNotMatch(memory + css, /barTrack|chartAxis\s*\{|width: `\$\{\(row.memoryMiB/u);
  const markStyle = css.match(/\.barFill\s*\{([^}]+)\}/u)?.[1];
  assert.ok(markStyle);
  assert.doesNotMatch(markStyle, /min-height|scale|gradient|border:/u);
});

test('메모리 기록 화면은 자료 날짜·정리 문구를 렌더링하지 않는다', async () => {
  const memory = await readFile(new URL('../../../../src/features/architecture/ui/DeploymentMemoryHistory.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(memory, /deploymentMemorySource|preparedOn|comparison.conditions|자료:|정리본|20\d{2}년/u);
});

test('구성 상세는 독립 탭으로 옮기고 소개에는 짧은 안내를 한 번만 남긴다', async () => {
  const component = await readFile(new URL('../../../../src/features/architecture/ui/DeploymentOverview.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(component, /['"]use client['"]|useEffect|useState/u);
  assert.match(component, /id="deployment-overview"/u);
  assert.match(component, /<DeploymentDiagramCarousel diagrams=\{deploymentDiagrams\} \/>/u);
  const page = await readFile(new URL('../../../../src/app/about-me/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /DeploymentOverview|DevelopmentEnvironmentOverview/u);
  assert.equal(page.split('<ArchitecturePreview />').length - 1, 1);
  const order = ['id="featured-projects"', '<ArchitecturePreview />', '<AiWorkflowPreview />'].map((anchor) => page.indexOf(anchor));
  assert.ok(order.every((position, index) => position >= 0 && (!index || position > order[index - 1])));
  const architecture = await readFile(new URL('../../../../src/app/about-me/architecture/page.tsx', import.meta.url), 'utf8');
  for (const tag of ['<DeploymentOverview />', '<DevelopmentEnvironmentOverview />']) assert.equal(architecture.split(tag).length - 1, 1);
});

test('공개 데이터에 내부 주소·키·파일 경로나 미검증 현재 온라인 주장을 싣지 않는다', () => {
  const content = JSON.stringify({ deploymentProjects, deploymentDiagrams, infrastructureTransition, infrastructureMigrationReasons, deploymentMemoryComparison, deploymentMemoryServices, deploymentMemorySource });
  assert.doesNotMatch(content, /https?:\/\/|localhost|127\.0\.0\.1|192\.168\.|10\.\d+\.|\.local\b|\btoken\b|api[_-]?key|[A-Z]:[\\/]|docs\/ops\/history/iu);
  assert.doesNotMatch(content, /현재 온라인|항상 온라인|현재 정상 가동|현재 연결됨/u);
});
