import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { sharedInfrastructureServices } from '../../../../src/features/architecture/data/sharedInfrastructureDiagram.ts';
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

const projectIds = ['portfolio', 'shared-infrastructure', 'e-commerce', 'asset-library'];
const [portfolio, infrastructure, commerce, assets] = deploymentDiagrams;
const edges = (source) => [...source.matchAll(/\b(\w+) -->[^\n]*?\b(\w+)\s*$/gmu)]
  .map(([, from, to]) => [from, to]);

test('4개 프로젝트와 같은 순서의 상세 슬라이드를 제공하고 Colab은 포트폴리오 자원으로 포함한다', () => {
  assert.deepEqual(deploymentProjects.map(({ id }) => id), projectIds);
  assert.deepEqual(deploymentDiagrams.map(({ id }) => id), projectIds);
  assert.deepEqual(deploymentDiagrams.map(({ title }) => title), deploymentProjects.map(({ label }) => label));
  assert.equal(deploymentProjects[0].hosting, 'GitHub Pages / Raspberry Pi');
  assert.match(deploymentProjects[2].hosting, /별도 Cloudflare Workers.*Raspberry Pi/u);
  assert.match(deploymentProjects[3].hosting, /Raspberry Pi.*LAN · Tailscale/u);
  assert.doesNotMatch(deploymentProjects[3].hosting, /Cloudflare/u);
  assert.match(portfolio.source, /Google Colab/u);
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

test('프로젝트 설명은 2~3개 짧은 항목이며 K3s 경계는 공용 인프라 상세에 표시한다', () => {
  for (const diagram of deploymentDiagrams) {
    const lines = diagram.description.split('\n');
    assert.ok(lines.length >= 2 && lines.length <= 3);
    assert.ok(diagram.description.length <= 240);
    assert.ok(lines.every(line => line.trim() && line.length <= 100));
    if (diagram.id !== 'shared-infrastructure') assert.doesNotMatch(diagram.source + diagram.compactSource + diagram.description, /K3s|Pod/u);
  }
  assert.match(infrastructure.source, /K3s.*독립 워크로드/u);
});

test('포트폴리오는 정적 화면·Pi API·Tunnel·Colab을 구분하고 브라우저 직통 추론을 표시하지 않는다', () => {
  for (const source of [portfolio.source, portfolio.compactSource]) {
    assert.deepEqual(edges(source), [
      ['PortfolioPages', 'Browser'], ['Browser', 'GPTSites'], ['Browser', 'PiApi'], ['Browser', 'StaticDemo'],
      ['PiApi', 'ColabTunnel'], ['ColabTunnel', 'Colab'],
    ]);
    assert.match(source, /PortfolioPages -->\|"화면 제공"\| Browser/u);
    assert.match(source, /PiApi\["Raspberry Pi<br\/>/u);
    assert.match(source, /PiApi -->\|"추론 요청"\| ColabTunnel/u);
    assert.doesNotMatch(source, /Browser\s*-->[^\n]*Colab|Node|Cloudflare Worker|vLLM|A100|H100/u);
  }
  assert.match(portfolio.description, /Pi API → Tunnel → Colab/u);
  assert.doesNotMatch(portfolio.description, /Worker/u);
  assert.doesNotMatch(JSON.stringify(portfolio), /추론 게이트웨이|\/api\/chat\/(?:prepare|tool|finalize)/u);
});

test('포트폴리오의 외부 실험 링크는 갤러리의 실제 공개 호스팅과 대응하고 API·추론 경로와 분리한다', () => {
  const experiments = new Map(agentExperiments.map(experiment => [experiment.id, experiment]));
  const [sites, staticDemo] = portfolioLinkedExperiments;
  assert.equal(sites.hosting, 'GPT Sites');
  assert.equal(sites.experiments.length, 6);
  for (const item of sites.experiments) {
    const experiment = experiments.get(item.id);
    assert.ok(experiment?.demoUrl && !experiment.hidden);
    assert.ok(new URL(experiment.demoUrl).hostname.endsWith('.chatgpt.site'));
    assert.ok(portfolio.source.includes(item.label));
  }
  assert.deepEqual(staticDemo.experiments.map(item => item.id), ['modern-warfare-sample', 'oscillo-rhythm-game', 'exploded-atlas', 'iced-latte', 'noeul-circuit', 'frostpass-fantasy-rpg', 'dot-board']);
  assert.equal(experiments.get('modern-warfare-sample').demoUrl, 'https://modern-warfare-sample.sworksong.workers.dev/');
  assert.equal(experiments.get('oscillo-rhythm-game').demoUrl, 'https://pf-samples.sworksong.workers.dev/rhythm-game-oscillo/');
  assert.equal(experiments.get('exploded-atlas').demoUrl, 'https://pf-samples.sworksong.workers.dev/exploded-atlas/');
  assert.equal(experiments.get('iced-latte').demoUrl, 'https://pf-samples.sworksong.workers.dev/iced-latte/');
  assert.equal(experiments.get('noeul-circuit').demoUrl, 'https://pf-samples.sworksong.workers.dev/racing-game-noeul-circuit/');
  assert.equal(experiments.get('frostpass-fantasy-rpg').demoUrl, 'https://pf-samples.sworksong.workers.dev/fantasy-rpg-frostpass/');
  assert.equal(experiments.get('dot-board').demoUrl, 'https://pf-samples.sworksong.workers.dev/dot-board/');
  for (const item of staticDemo.experiments) {
    assert.ok(new URL(experiments.get(item.id).demoUrl).hostname.endsWith('.workers.dev'));
    assert.ok(portfolio.source.includes(item.label));
  }
  assert.match(portfolio.source, /StaticDemo\["Cloudflare 정적 웹.*현대전 샘플.*Workers/u);
  for (const source of [portfolio.source, portfolio.compactSource]) {
    assert.match(source, /Browser -->\|"실험 데모 열기"\| GPTSites/u);
    assert.match(source, /Browser -->\|"실험 데모 열기"\| StaticDemo/u);
    const graph = edges(source);
    for (const node of ['GPTSites', 'StaticDemo']) {
      assert.equal(graph.some(([from]) => from === node), false);
      assert.equal(graph.some(([from, to]) => from !== 'Browser' && to === node), false);
    }
  }
  assert.match(portfolio.description, /브라우저.*정적 웹 링크.*챗봇 API를 거치지/u);
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
    assert.equal(portfolioLinkedExperiments[1].experiments.length, 7);
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

test('공용 인프라의 게이트웨이와 내부 저장소는 별도 서비스의 앞단으로 오인되지 않는다', () => {
  for (const source of [infrastructure.source, infrastructure.compactSource]) {
    assert.deepEqual(edges(source), [
      ...sharedInfrastructureServices.map(service => ['Gateway', service.id]),
      ['Auth', 'Storage'], ['Config', 'Storage'], ['File', 'Storage'], ['Chat', 'Storage'],
      ['Client', 'Tunnel'], ['Tunnel', 'Gateway'],
    ]);
    assert.doesNotMatch(source, /CommerceAPI|Assets|Colab|Worker/u);
    assert.doesNotMatch(source, /(?:Client|Tunnel)\s*-->[^\n]*Storage/u);
  }
  assert.match(infrastructure.description, /이커머스 업무 API와 에셋 라이브러리는.*별도/u);
  assert.doesNotMatch(infrastructure.source, /Services\[|Rust 내부 서비스/u);
});

test('이커머스는 별도 고객·관리자 Workers, 커머스 전용 API, 공용 기능과 외부 AI를 구분한다', () => {
  for (const source of [commerce.source, commerce.compactSource]) {
    assert.match(source, /고객 웹.*관리자 웹/u);
    assert.match(source, /Worker/u);
    assert.match(source, /Spring Boot API/u);
    assert.match(source, /MariaDB/u);
    assert.match(source, /OpenAI 호환 HTTPS/u);
    assert.match(source, /SignalR/u);
    const graph = edges(source);
    const hasEdge = (from, to) => graph.some(edge => edge[0] === from && edge[1] === to);
    const commerceEntry = source === commerce.source ? 'CommerceTunnel' : 'CommerceEntry';
    const commerceApi = source === commerce.source ? 'CommerceAPI' : 'CommerceEntry';
    const infraEntry = source === commerce.source ? 'InfraTunnel' : 'InfraEntry';
    for (const [from, to] of [
      ['Browser', 'Workers'], ['Workers', 'InferenceTunnel'], ['InferenceTunnel', 'LLM'],
      ['Browser', commerceEntry], ['Workers', commerceEntry],
      [commerceApi, 'CommerceDB'], [commerceApi, infraEntry], ['Browser', infraEntry],
    ]) assert.ok(hasEdge(from, to), `${from} -> ${to}`);
    assert.match(source, /Browser -->\|"[^"\n]*이미지 GET[^"\n]*SignalR/u);
    assert.match(source, /(?:CommerceAPI|CommerceEntry) -->\|"[^"\n]*상담 REST/u);
    assert.doesNotMatch(source, /Cloudflare Pages|GCE|CommerceDB\s*-->[^\n]*Infra/u);
    assert.match(source, /Google Colab.*GPU/u);
    assert.equal(hasEdge('Workers', 'LLM'), false);
  }
  assert.match(commerce.description, /웹·AI:.*Workers.*추론용 Tunnel.*Google Colab LLM/u);
  assert.match(commerce.description, /업무:.*Spring Boot API.*MariaDB/u);
  assert.match(commerce.description, /브라우저.*SignalR 실시간 상담에 직접/u);
  assert.doesNotMatch(commerce.description, /동일 모델|모두 같은 LLM|현재 정상 가동/u);
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
    assert.match(source, /파일.*(?:미디어|이미지)/u);
    assert.match(source, /SignalR/u);
    assert.match(source, /파일 저장소/u);
    assert.ok(graph.some(([from, to]) => from === 'Workers' && to === 'InferenceTunnel'));
    assert.ok(graph.some(([from, to]) => from === 'InferenceTunnel' && to === 'LLM'));
    assert.equal(graph.some(([from, to]) => from === 'Browser' && to === 'LLM'), false);
  }
});

test('에셋은 LAN·Tailscale과 자체 인증을 사용하고 MCP·Rust API·SQLite·로컬 파일을 연결한다', () => {
  for (const source of [assets.source, assets.compactSource]) {
    for (const label of ['LAN · Tailscale', 'Rust', 'Node.js', 'MCP', 'SQLite', '로컬 파일', 'Raspberry Pi']) assert.ok(source.includes(label), label);
    assert.doesNotMatch(source, /Cloudflare|Gateway|Infra|SSO/u);
  }
  assert.ok(edges(assets.source).some(([from, to]) => from === 'MCP' && to === 'API'));
  assert.match(assets.description, /웹·MCP는 각각 자체 인증/u);
  assert.match(assets.description, /SQLite.*메타데이터.*로컬 파일.*원본·미리보기/u);
});

test('에셋 상세도의 브라우저와 제작 에이전트는 같은 두 줄 높이로 표시한다', () => {
  const labels = ['Browser', 'Agent'].map(id => assets.source.match(new RegExp(`${id}\\["([^"\\n]+)"\\]`, 'u'))?.[1]);
  assert.deepEqual(labels, ['웹<br/>브라우저', '제작 에이전트 · MCP<br/>클라이언트']);
  assert.ok(labels.every(label => label.split('<br/>').length === 2));
  assert.ok(edges(assets.source).some(([from, to]) => from === 'Browser' && to === 'Web'));
  assert.ok(edges(assets.source).some(([from, to]) => from === 'Agent' && to === 'MCP'));
});


test('이관 이력은 공용 서비스의 Rust 전환과 Pi 이전을 구분한다', () => {
  assert.deepEqual(infrastructureTransition.map(({ id }) => id), ['cloud', 'optimization', 'raspberry-pi']);
  assert.match(infrastructureTransition[0].technologies, /Java · C#.*Google Compute Engine/u);
  assert.match(infrastructureTransition[1].description, /^공용 인프라 서비스를 Rust로/u);
  assert.doesNotMatch(infrastructureTransition[1].description, /이커머스/u);
  assert.match(infrastructureTransition[2].description, /Raspberry Pi.*전체 이전/u);
});

test('선택한 이전 관찰값과 Rust 앱 12개의 합계만 비교한다', () => {
  assert.equal(deploymentMemoryServices.length, 12);
  assert.equal(new Set(deploymentMemoryServices.map(service => service.id)).size, 12);
  const sum = (rows, key) => Number(rows.reduce((total, row) => total + row[key], 0).toFixed(2));
  assert.equal(sum(deploymentMemoryServices, 'before'), 2504.00);
  assert.equal(sum(deploymentMemoryServices, 'after'), 115.86);
  assert.deepEqual(deploymentMemoryTotals.map(total => [total.before, total.after]), [[2504, 115.86]]);
  assert.doesNotMatch(JSON.stringify(deploymentMemoryServices), /broker|beforeA|beforeB|Kafka|Nisshi/u);
  assert.equal(deploymentMemoryComparison.before.memoryMiB, 2504);
  assert.equal(deploymentMemoryComparison.after.memoryMiB, 115.86);
  assert.equal(deploymentMemoryComparison.before.value, '2,504.00 MiB');
  assert.equal(deploymentMemoryComparison.after.value, '115.86 MiB');
  assert.equal(Number((2504 / 115.86).toFixed(1)), deploymentMemoryComparison.ratio);
  assert.equal(Number(((1 - 115.86 / 2504) * 100).toFixed(2)), deploymentMemoryComparison.reductionPercent);
  assert.match(deploymentMemoryComparison.scopeNote, /앱 12개.*데이터베이스·캐시·이커머스 API 제외/u);
  assert.equal(deploymentMemorySource.preparedOn, '2026-10-13');
});

test('서비스별 이전·이후 값은 원본에서 선택한 12개 값을 유지한다', () => {
  assert.deepEqual(deploymentMemoryServices.map(row => [row.label, row.before, row.after]), [
    ['Auth', 390.8, 8.2], ['Gateway', 223.4, 6.48], ['Config', 264, 4.41],
    ['Notification', 371, 10.87], ['Monitoring', 374.2, 10.58], ['Scheduler', 318.5, 18.28],
    ['Logging', 144.1, 8.81], ['Analytics', 97.9, 19.22], ['Tracing', 36.8, 2.49],
    ['File', 128.4, 12.02], ['Media', 96.4, 7.93], ['Chat', 58.5, 6.57],
  ]);
  assert.deepEqual(deploymentMemoryServices.filter(row => row.language === 'Java').map(row => row.label), ['Auth', 'Gateway', 'Config', 'Notification', 'Monitoring', 'Scheduler']);
  for (const service of deploymentMemoryServices) for (const key of ['before', 'after']) assert.ok(Number.isFinite(service[key]) && service[key] > 0);
});

test('메모리 비교는 언어 사이의 가운뎃점을 보존하고 실행 환경을 슬래시 뒤 같은 줄에 표시한다', async () => {
  const { before, after } = deploymentMemoryComparison;
  assert.equal(before.label, '이전 · Java · C# / Google Compute Engine');
  assert.equal(after.label, '이후 · Rust / Raspberry Pi');
  for (const [observation, expected] of [
    [before, ['이전', 'Java · C#', 'Google Compute Engine']],
    [after, ['이후', 'Rust', 'Raspberry Pi']],
  ]) {
    const [phase, ...details] = observation.label.split(' · ');
    assert.deepEqual([phase, ...details.join(' · ').split(' / ')], expected);
  }
  const memory = await readFile(new URL('../../../../src/features/architecture/ui/DeploymentMemoryHistory.tsx', import.meta.url), 'utf8');
  assert.match(memory, /const \[phase, \.\.\.details\] = row.label.split\(' · '\)/u);
  assert.match(memory, /<span>\{details.join\(' · '\)\}<\/span>/u);
  assert.doesNotMatch(memory, /chartEnvironment|<br\s*\/?\s*>/u);
  assert.doesNotMatch(JSON.stringify(deploymentMemoryComparison), /Java \/ C#|Rust \/ Pi/u);
});

test('비용 절감에서 파일 서버용 Pi의 전체 이전 시도·메모리 제약·Rust 해결로 이야기가 이어진다', async () => {
  assert.deepEqual(infrastructureMigrationReasons.map(row => row.id), ['cost', 'pi-plan', 'memory', 'rust']);
  assert.match(infrastructureMigrationReasons[0].title, /Compute Engine.*비용 절감/u);
  assert.match(infrastructureMigrationReasons[0].description, /처음 목표.*Compute Engine.*CPU·메모리 용량.*비용/u);
  assert.match(infrastructureMigrationReasons[1].description, /원래.*트래픽 과금을 피할 목적.*파일 서버만.*구매.*이후.*공용 인프라와 이커머스 백엔드.*모두 올려보려/u);
  assert.match(infrastructureMigrationReasons[2].description, /라즈베리파이.*4GB.*12개.*2,504 MiB.*모두 이전.*상시 점유/u);
  assert.match(infrastructureMigrationReasons[3].description, /Rust.*이후.*Raspberry Pi/u);
  assert.doesNotMatch(JSON.stringify(infrastructureMigrationReasons), /모든.*비용.*0|무료|월.*달러|현재 요금/u);
  const component = await readFile(new URL('../../../../src/features/architecture/ui/InfrastructureMigration.tsx', import.meta.url), 'utf8');
  assert.match(component, /파일 서버용 Pi에 전체 백엔드를 이전/u);
  assert.match(component, /aria-label="비용 절감에서 Pi 이전까지"/u);
});

test('메모리 기록은 정적 요약과 전후 비교 표 하나로 표시하고 삭제 요청을 유지한다', async () => {
  const component = await readFile(new URL('../../../../src/features/architecture/ui/InfrastructureMigration.tsx', import.meta.url), 'utf8');
  assert.equal(component.split('<DeploymentMemoryHistory />').length - 1, 1);
  const memory = await readFile(new URL('../../../../src/features/architecture/ui/DeploymentMemoryHistory.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(memory, /['"]use client['"]|fetch\(|useState/u);
  assert.equal(memory.split('<table ').length - 1, 1);
  assert.match(memory, /서버·서비스별 메모리 기록/u);
  assert.doesNotMatch(memory, /서버 전체 메모리 이력|host-memory-title|deploymentHostMemoryHistory|baseline|이전 A|이전 B|\bbeforeA\b|\bbeforeB\b/u);
  assert.match(memory, /data-memory-service=\{service.id\}/u);
  assert.match(memory, /scope="row"/u);
  assert.match(memory, /data-label="이전 Java · C#"/u);
  assert.match(component, /<h3 id="infrastructure-migration-title">공용 인프라 최적화와 이관<\/h3>/u);
  assert.match(component, /infrastructureMigrationReasons.map/u);
  const data = await readFile(new URL('../../../../src/features/architecture/data/deployment.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(data + component + memory, /deploymentComparisonCaveat|Rust만의 효과|런타임과 하드웨어가 함께 바뀐|실측 자료 정리 후|deploymentHostMemoryObservation/u);
  const css = await readFile(new URL('../../../../src/features/architecture/ui/DeploymentMemoryHistory.module.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(max-width: 640px\)/u);
  assert.match(css, /\.serviceTable tr\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u);
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
  assert.match(memory, /프로세스 메모리 \(MiB\)/u);
  assert.match(memory, /실행 환경/u);
  assert.match(memory, /role="group" aria-label=\{`\$\{row.label\}: \$\{row.value\}`\}/u);
  assert.doesNotMatch(memory + css, /barTrack|chartAxis\s*\{|width: `\$\{\(row.memoryMiB/u);
  assert.match(css, /\.chartRows\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)[^}]*height: 100%/u);
  assert.match(css, /\.chartPlot\s*\{[^}]*height: 240px/u);
  assert.match(css, /\.flowArrow\s*\{[^}]*transform: rotate\(90deg\)/u);
  const markStyle = css.match(/\.barFill\s*\{([^}]+)\}/u)?.[1];
  assert.ok(markStyle);
  assert.doesNotMatch(markStyle, /min-height|scale|gradient|border:/u);
  const { before, after } = deploymentMemoryComparison;
  const axisMaximumMiB = Math.ceil(Math.max(before.memoryMiB, after.memoryMiB) / 1000) * 1000;
  assert.equal(axisMaximumMiB, 3000);
  assert.deepEqual(Array.from({ length: axisMaximumMiB / 1000 + 1 }, (_, index) => index * 1000), [0, 1000, 2000, 3000]);
  assert.ok(axisMaximumMiB > Math.max(before.memoryMiB, after.memoryMiB));
  assert.equal(Number((before.memoryMiB / axisMaximumMiB * 100).toFixed(2)), 83.47);
  assert.equal(Number((after.memoryMiB / axisMaximumMiB * 100).toFixed(2)), 3.86);
  assert.equal((before.memoryMiB / axisMaximumMiB) / (after.memoryMiB / axisMaximumMiB), before.memoryMiB / after.memoryMiB);
});

test('숫자 열의 헤더와 값은 같은 오른쪽 기준이며 날짜·자료 정리 문구는 렌더링하지 않는다', async () => {
  const memory = await readFile(new URL('../../../../src/features/architecture/ui/DeploymentMemoryHistory.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../../../src/features/architecture/ui/DeploymentMemoryHistory.module.css', import.meta.url), 'utf8');
  assert.match(css, /\.serviceTable thead th:not\(:first-child\)\s*\{\s*text-align: right/u);
  assert.match(css, /\.serviceTable td\s*\{[^}]*text-align: right/u);
  assert.doesNotMatch(memory, /deploymentMemorySource|preparedOn|comparison.conditions|자료:|정리본|20\d{2}년/u);
  const visibleData = JSON.stringify({ deploymentProjects, deploymentDiagrams, infrastructureTransition, infrastructureMigrationReasons, deploymentMemoryComparison });
  assert.doesNotMatch(visibleData, /\b20\d{2}-\d{2}-\d{2}\b|20\d{2}년\s*\d{1,2}월|정리본/u);
});

test('구성 상세는 독립 탭으로 옮기고 소개에는 짧은 안내를 한 번만 남긴다', async () => {
  const component = await readFile(new URL('../../../../src/features/architecture/ui/DeploymentOverview.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(component, /['"]use client['"]|useEffect|useState/u);
  assert.match(component, /id="deployment-overview"/u);
  assert.match(component, /<DeploymentDiagramCarousel diagrams=\{deploymentDiagrams\} \/>/u);
  assert.match(component, /이커머스 업무 API와 공용 인프라 API는 별도 Tunnel 진입점/u);
  const page = await readFile(new URL('../../../../src/app/about-me/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /DeploymentOverview|DevelopmentEnvironmentOverview/u);
  assert.equal(page.split('<ArchitecturePreview />').length - 1, 1);
  const order = ['id="featured-projects"', '<ArchitecturePreview />', '<AiWorkflowPreview />'].map((anchor) => page.indexOf(anchor));
  assert.ok(order.every((position, index) => position >= 0 && (!index || position > order[index - 1])));
  const architecture = await readFile(new URL('../../../../src/app/about-me/architecture/page.tsx', import.meta.url), 'utf8');
  for (const tag of ['<DeploymentOverview />', '<DevelopmentEnvironmentOverview />']) assert.equal(architecture.split(tag).length - 1, 1);
  const css = await readFile(new URL('../../../../src/features/architecture/ui/DeploymentOverview.module.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(max-width: 760px\)\s*\{\s*\.projects\s*\{\s*grid-template-columns:\s*1fr/u);
});

test('공개 데이터에 내부 주소·키·파일 경로나 미검증 현재 온라인 주장을 싣지 않는다', () => {
  const content = JSON.stringify({ deploymentProjects, deploymentDiagrams, infrastructureTransition, infrastructureMigrationReasons, deploymentMemoryComparison, deploymentMemoryServices, deploymentMemorySource });
  assert.doesNotMatch(content, /https?:\/\/|localhost|127\.0\.0\.1|192\.168\.|10\.\d+\.|\.local\b|\btoken\b|api[_-]?key|[A-Z]:[\\/]|docs\/ops\/history/iu);
  assert.doesNotMatch(content, /현재 온라인|항상 온라인|현재 정상 가동|현재 연결됨/u);
});
