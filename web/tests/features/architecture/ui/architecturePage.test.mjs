import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { aboutTabPathFromPath } from '../../../../src/features/chat/navigation.ts';
import { architectureTabFromHash, architectureTabHash } from '../../../../src/features/architecture/navigation/architectureTabNavigation.ts';
import { readPortfolioViewState, resolvePortfolioViewTarget, runPortfolioViewAction } from '../../../../src/features/webmcp/portfolioView.ts';
import { ACTION_LABELS, ACTION_ROUTES } from '../../../../src/features/chat/constants.ts';
import { parseTurnEvent } from '../../../../src/features/chat/transport/sse.ts';
import { portfolioViewControlInput } from '../../../../src/features/portfolio-tools/view.ts';

/** 서버 SSE가 이 이동을 브라우저 도구 호출로 넘길 때 그대로 통과하는지 확인한다. */
const toolRequestArguments = args => parseTurnEvent({ event: 'tool_request', data: JSON.stringify({ turnId: 'architecture-test',
  calls: [{ callId: 'architecture-test', name: 'control_portfolio_view', arguments: args }] }) }).calls[0].arguments;

test('개발·배포 환경의 네 목적지는 도구 입력 검증·화면 실행기·탭 해시를 공유한다', () => {
  const cases = [
    ['architecture', 'architecture', 'development-environment', 'development'],
    ['development-environment', 'development_environment', 'development-environment', 'development'],
    ['deployment-overview', 'deployment_overview', 'deployment-overview', 'deployment'],
    ['migration-memory-history', 'migration_memory_history', 'migration-memory-history', 'migration'],
  ];
  for (const [action, buttonId, anchor, tab] of cases) {
    const target = resolvePortfolioViewTarget(action);
    assert.equal(target.route, `/about-me/architecture#${anchor}`);
    assert.equal(ACTION_ROUTES[buttonId], target.route);
    assert.equal(architectureTabFromHash(`#${anchor}`), tab);
    const visited = [];
    assert.deepEqual(runPortfolioViewAction(action, route => visited.push(route)), target);
    assert.deepEqual(visited, [target.route]);
    assert.ok(ACTION_LABELS[buttonId]);
    assert.deepEqual(portfolioViewControlInput.parse(toolRequestArguments({ action })), { action });
    assert.throws(() => portfolioViewControlInput.parse(toolRequestArguments({ action, year: '2026' })),
      '모르는 인자가 붙은 이동은 실행기 검증에서 거절한다');
  }
});

test('개발·배포 화면 조회는 낡은 해시 대신 실제 마운트된 탭과 하위 앵커를 보고한다', t => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  });
  const memory = { id: 'migration-memory-history' };
  const deployment = { id: 'deployment-overview', contains: element => element === deployment };
  const migration = { id: 'infrastructure-migration', contains: element => element === migration || element === memory };
  const development = { id: 'development-environment', contains: element => element === development };
  let elements = { 'development-environment': development };
  globalThis.window = { location: { hash: '#migration-memory-history' } };
  globalThis.document = { getElementById: id => elements[id] ?? null };
  const read = () => readPortfolioViewState('/about-me/architecture/');
  assert.deepEqual(read(), { page: 'architecture', anchor: 'development-environment',
    researchTab: null, researchYear: null, researchDetails: null });
  elements = { 'infrastructure-migration': migration, 'migration-memory-history': memory };
  assert.equal(read().anchor, 'migration-memory-history');
  assert.deepEqual(JSON.parse(JSON.stringify(read())), read(), 'clientState로 보내는 화면 상태는 JSON 직렬화로 바뀌지 않는다');
  globalThis.window.location.hash = '#development-environment';
  assert.equal(read().anchor, 'infrastructure-migration');
  elements = { 'deployment-overview': deployment };
  assert.equal(read().anchor, 'deployment-overview');
  elements = {};
  assert.equal(read().anchor, null);
  assert.equal(readPortfolioViewState('/about-me/architecture-extra').page, 'unknown');
});

test('개발·배포 환경 페이지는 정적 본문을 좌우 탭의 슬롯으로 제공한다', async () => {
  const page = await readFile(new URL('../../../../src/app/about-me/architecture/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /['"]use client['"]|fetch\(|searchParams/u);
  assert.doesNotMatch(page, /quickNav|href="#|↓/u);
  for (const tag of ['<DeploymentOverview />', '<DevelopmentEnvironmentOverview />', '<InfrastructureMigration />']) assert.equal(page.split(tag).length - 1, 1);
  assert.match(page, /<ArchitectureTabs[\s\S]*development=\{<DevelopmentEnvironmentOverview \/>\}[\s\S]*deployment=\{<DeploymentOverview \/>\}/u);
  assert.ok(page.indexOf('<DevelopmentEnvironmentOverview />') < page.indexOf('<DeploymentOverview />'));
  assert.match(page, /migration=\{<InfrastructureMigration \/>\}/u);
  assert.ok(page.indexOf('<DeploymentOverview />') < page.indexOf('<InfrastructureMigration />'));
});

test('세 환경 탭은 접근성·키보드 처리를 제공하고 비활성 본문을 마운트하지 않는다', async () => {
  const tabs = await readFile(new URL('../../../../src/features/architecture/ui/ArchitectureTabs.tsx', import.meta.url), 'utf8');
  assert.match(tabs, /@radix-ui\/react-tabs/u);
  assert.match(tabs, /useSyncExternalStore\(subscribeToLocation, currentHash, serverHash\)/u);
  assert.match(tabs, /activeHash === architectureTabHash\(activeTab\)/u);
  assert.match(tabs, /document.getElementById\(activeHash.slice\(1\)\)/u);
  assert.equal((tabs.match(/<Tabs.Trigger /gu) ?? []).length, 3);
  assert.equal((tabs.match(/<Tabs.Content /gu) ?? []).length, 3);
  assert.match(tabs, /<Tabs.Trigger value="migration"/u);
  assert.doesNotMatch(tabs, /forceMount|fetch\(/u);
  assert.match(tabs, /history.pushState/u);
  assert.match(tabs, /addEventListener\('popstate'/u);
  const css = await readFile(new URL('../../../../src/features/architecture/ui/ArchitectureTabs.module.css', import.meta.url), 'utf8');
  assert.match(css, /:focus-visible/u);
});

test('기존 개발·배포·메모리 상세 링크는 알맞은 탭을 선택한다', () => {
  for (const hash of ['', '#development-environment', '#development-topology-title']) assert.equal(architectureTabFromHash(hash), 'development');
  for (const hash of ['#deployment-overview', '#deployment-overview-title']) assert.equal(architectureTabFromHash(hash), 'deployment');
  for (const hash of ['#infrastructure-migration', '#infrastructure-migration-title', '#migration-memory-history', '#migration-memory-title', '#memory-chart-title', '#service-memory-title']) assert.equal(architectureTabFromHash(hash), 'migration');
  assert.equal(architectureTabFromHash('#deployment-other-page'), 'deployment');
  assert.equal(architectureTabFromHash('#deploymentExtra'), 'development');
  assert.equal(architectureTabHash('development'), '#development-environment');
  assert.equal(architectureTabHash('deployment'), '#deployment-overview');
  assert.equal(architectureTabHash('migration'), '#infrastructure-migration');
  assert.equal(architectureTabFromHash('#infrastructure-migrationExtra'), 'development');
});

test('이관 배경·전환 단계·메모리 비교는 새 탭에 한 번만 표시하고 배포 구성에는 남기지 않는다', async () => {
  const migration = await readFile(new URL('../../../../src/features/architecture/ui/InfrastructureMigration.tsx', import.meta.url), 'utf8');
  const deployment = await readFile(new URL('../../../../src/features/architecture/ui/DeploymentOverview.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(migration, /['"]use client['"]|fetch\(|MermaidDiagram|DeploymentDiagramCarousel/u);
  assert.match(migration, /id="infrastructure-migration"/u);
  assert.match(migration, /aria-labelledby="infrastructure-migration-title"/u);
  for (const text of ['infrastructureMigrationReasons.map', 'infrastructureTransition.map', '<DeploymentMemoryHistory />']) {
    assert.equal(migration.split(text).length - 1, 1);
    assert.equal(deployment.includes(text), false);
  }
});

test('소개에는 렌더링 엔진 없이 짧은 진입 카드만 남기고 상세 탭으로 연결한다', async () => {
  const overview = await readFile(new URL('../../../../src/app/about-me/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(overview, /DeploymentOverview|DevelopmentEnvironmentOverview/u);
  assert.equal(overview.split('<ArchitecturePreview />').length - 1, 1);
  const preview = await readFile(new URL('../../../../src/features/architecture/ui/ArchitecturePreview.tsx', import.meta.url), 'utf8');
  assert.match(preview, /href="\/about-me\/architecture\/"/u);
  assert.doesNotMatch(preview, /Mermaid|deploymentDiagrams|deploymentMemoryComparison/u);
});

test('개발·배포 환경은 소개 탭 목록 밖에서 설정 옆 버튼으로 제공한다', async () => {
  const layout = await readFile(new URL('../../../../src/app/about-me/layout.tsx', import.meta.url), 'utf8');
  const tabs = layout.match(/const ABOUT_TABS = \[([\s\S]*?)\] as const/u)?.[1];
  assert.ok(tabs);
  assert.doesNotMatch(tabs, /architecture/u);
  assert.match(layout, /const ARCHITECTURE_PATH = "\/about-me\/architecture"/u);
  assert.match(layout, /className="about-header-actions"[\s\S]*href=\{ARCHITECTURE_PATH\}[\s\S]*href="\/settings"/u);
  assert.match(layout, /aria-current=\{architectureActive \? 'page' : undefined\}/u);
  assert.match(layout, /data-about-tab-path=\{ARCHITECTURE_PATH\}/u);
  assert.equal(aboutTabPathFromPath('/about-me/architecture/'), '/about-me/architecture');
  assert.equal(aboutTabPathFromPath('/about-me/architecture-extra'), null);
  assert.equal(aboutTabPathFromPath('/about-me/architecture/details/'), '/about-me/architecture');
});
