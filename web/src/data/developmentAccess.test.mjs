import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { developmentAccessDescription, developmentAccessRoutes, developmentAccessTargets, groupDevelopmentAccessChannels, groupDevelopmentAccessRoutes } from './developmentAccess.ts';
import { developmentMachines } from './developmentTopology.ts';

const byId = Object.fromEntries(developmentAccessRoutes.map(route => [route.id, route]));

test('GCE는 PC 두 대, Pi SSH는 집 PC, Claude 원격은 스마트폰, 공통 도구는 세 기기를 표시한다', () => {
  assert.equal(developmentAccessRoutes.length, 8);
  assert.deepEqual(byId['gce-console'].clients, ['Home', 'Laptop']);
  assert.deepEqual(byId['pi-ssh'].clients, ['Home']);
  assert.deepEqual(byId['claude-remote'].clients, ['Android']);
  for (const id of ['pi-services', 'codex-service', 'dots-service', 'grok-app', 'colab-tunnel']) {
    assert.deepEqual(byId[id].clients, ['Home', 'Laptop', 'Android']);
  }
  for (const route of developmentAccessRoutes) {
    assert.equal(new Set(route.clients).size, route.clients.length);
    assert.ok(developmentAccessTargets[route.target]);
    for (const id of route.clients) assert.ok(developmentMachines[id]);
  }
});

test('Cloudflare와 Codex는 대상 앞 접속 수단이며 Claude는 스마트폰 Remote Control 경로다', () => {
  assert.equal(byId['gce-console'].method, 'Google Cloud 콘솔');
  assert.equal(byId['pi-ssh'].method, '내부망 · LAN · SSH');
  assert.equal(byId['grok-app'].method, '앱 접속');
  for (const id of ['codex-service', 'dots-service']) {
    assert.equal(byId[id].method, '작업 도구');
    assert.equal(byId[id].via, 'Codex');
  }
  for (const id of ['pi-services', 'colab-tunnel']) {
    assert.equal(byId[id].via, 'Cloudflare Tunnel');
    assert.equal(byId[id].channelNote, '환경별 별도 터널');
  }
  assert.equal(byId['claude-remote'].via, 'Claude Remote Control');
  assert.equal(byId['claude-remote'].target, 'ClaudeCode');
  assert.equal(byId['claude-remote'].targetRole, '집 PC · 노트북에서 실행');
  assert.match(byId['claude-remote'].description, /스마트폰에서 집 PC·노트북의 Claude Code/u);
  assert.match(byId['pi-services'].description, /에셋 라이브러리는 LAN·Tailscale 전용으로 제외/u);
  assert.match(byId['colab-tunnel'].description, /LLM 추론 서버/u);
  assert.match(byId['gce-console'].description, /Tailscale에는 가입하지 않았습니다/u);
  assert.equal(byId['gce-console'].historical, true);
  assert.equal(developmentAccessRoutes.filter(route => !route.historical).length, 7);
  assert.match(developmentAccessDescription, /실제 터널은 각각 별개/u);
  assert.match(developmentAccessDescription, /네트워크 프록시를 뜻하지 않습니다/u);
  assert.match(developmentAccessDescription, /모든 접속이 Tailscale을 거친다는 뜻은 아닙니다/u);
});

test('같은 세 기기는 다섯 대상을 공유하고 집 PC SSH와 스마트폰 Claude는 별도 묶음이다', () => {
  const active = developmentAccessRoutes.filter(route => !route.historical);
  const groups = groupDevelopmentAccessRoutes(active);
  assert.equal(groups.length, 3);
  assert.deepEqual(groups[0].clients, ['Home']);
  assert.deepEqual(groups[0].routes.map(route => route.id), ['pi-ssh']);
  assert.deepEqual(groups[1].clients, ['Home', 'Laptop', 'Android']);
  assert.deepEqual(groups[1].routes.map(route => route.id), ['pi-services', 'codex-service', 'dots-service', 'grok-app', 'colab-tunnel']);
  assert.deepEqual(groups[2].clients, ['Android']);
  assert.deepEqual(groups[2].routes.map(route => route.id), ['claude-remote']);
  assert.deepEqual(groups.flatMap(group => group.routes), active);
});

test('공통 세 기기의 Cloudflare와 Codex 칩은 각각 하나이며 칩 뒤에 두 대상이 갈라진다', () => {
  const shared = groupDevelopmentAccessRoutes(developmentAccessRoutes.filter(route => !route.historical))[1];
  const channels = groupDevelopmentAccessChannels(shared.routes);
  assert.deepEqual(channels.map(channel => channel.label), ['Cloudflare Tunnel', 'Codex', '앱 접속']);
  assert.deepEqual(channels.map(channel => channel.routes.map(route => route.target)), [
    ['Pi', 'Colab'], ['CodexCloud', 'OpenAIDots'], ['Grok'],
  ]);
  assert.equal(channels[0].note, '환경별 별도 터널');
  assert.equal(channels.flatMap(channel => channel.routes).length, shared.routes.length);
  assert.deepEqual(new Set(channels.flatMap(channel => channel.routes)), new Set(shared.routes));
});

test('접속 수단이 같아도 기기나 과거 여부가 다르면 합치지 않으며 입력을 바꾸지 않는다', () => {
  const active = byId['codex-service'];
  const input = [active, { ...active, id: 'phone-test', clients: ['Android'] }, { ...active, id: 'past-test', historical: true }];
  const before = JSON.stringify(input);
  assert.equal(groupDevelopmentAccessChannels(input).length, 3);
  assert.equal(JSON.stringify(input), before);
});

test('기기 순서만 달라도 같은 집합으로 묶되 입력 배열과 각 경로를 바꾸지 않는다', () => {
  const input = [byId['pi-services'], { ...byId['dots-service'], clients: ['Android', 'Home', 'Laptop'] }];
  const before = JSON.stringify(input);
  const groups = groupDevelopmentAccessRoutes(input);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].routes.length, 2);
  assert.equal(groups[0].routes[0], input[0]);
  assert.equal(groups[0].routes[1], input[1]);
  assert.equal(JSON.stringify(input), before);
});

test('기기 집합이 같아도 현재 접속과 과거 환경은 합치지 않는다', () => {
  const active = byId['pi-services'];
  const past = { ...active, id: 'past-only-test', historical: true };
  const groups = groupDevelopmentAccessRoutes([active, past]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map(group => group.historical), [false, true]);
  assert.notEqual(groups[0].id, groups[1].id);
});

test('공개 접속 도식은 주소·키나 확인하지 않은 접속 수단을 포함하지 않는다', () => {
  const content = JSON.stringify({ developmentAccessRoutes, developmentAccessDescription, developmentAccessTargets });
  assert.doesNotMatch(content, /https?:\/\/|localhost|192\.168\.|100\.\d+\.\d+\.\d+|sk-proj-|PRIVATE KEY|KEY=/u);
  assert.doesNotMatch(content, /공인 IP|Tailscale SSH|무료|무인증/u);
  for (const route of developmentAccessRoutes.filter(route => /SSH/u.test(route.method))) {
    assert.ok(!route.clients.includes('Android'));
    assert.equal(route.target, 'Pi');
  }
  assert.equal(developmentAccessTargets.OpenAIDots, 'OpenAI Dots');
  assert.equal(developmentAccessTargets.ClaudeCode, 'Claude Code');
});

test('접속 그림은 기기와 접속 수단을 각각 공유하는 정적 HTML로 보여 준다', async () => {
  const component = await readFile(new URL('../components/about/DevelopmentAccessOverview.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(component, /['"]use client['"]|fetch\(|MermaidDiagram|dangerouslySetInnerHTML/u);
  assert.match(component, /data-access-route=\{route.id\}/u);
  assert.match(component, /data-access-client=\{id\}/u);
  assert.match(component, /data-access-target=\{route.target\}/u);
  assert.match(component, /data-access-group=\{group.id\}/u);
  assert.match(component, /data-access-channel=\{channel.label\}/u);
  assert.match(component, /group.clients.map/u);
  assert.match(component, /groupDevelopmentAccessChannels\(group.routes\)/u);
  assert.match(component, /channel.routes.map/u);
  assert.doesNotMatch(component, /route.clients.map/u);
  assert.match(component, /filter\(route => !route.historical\)/u);
  assert.match(component, /이전 개발 환경 · 현재 미사용/u);
  assert.match(component, /filter\(route => route.historical\)/u);
  assert.match(component, /aria-labelledby="development-access-title" aria-describedby="development-access-description"/u);
});

test('개발 환경은 기기 정체성을 공유하는 통합 연결 그림 하나만 표시한다', async () => {
  const component = await readFile(new URL('../components/about/DevelopmentEnvironmentOverview.tsx', import.meta.url), 'utf8');
  assert.equal(component.split('<DevelopmentEnvironmentDiagram />').length - 1, 1);
  assert.doesNotMatch(component, /DevelopmentAccessOverview|DevelopmentTopology/u);
  assert.match(component, /기기 간 연결을 한 그림/u);
  assert.match(component, /폰에서 조작하는 앱과 실제 작업이 실행되는 PC/u);
});

test('데스크톱은 칩 뒤 분기, 모바일은 접속 수단별 독립 묶음으로 가로 넘침 없이 표시한다', async () => {
  const css = await readFile(new URL('../components/about/DevelopmentAccessOverview.module.css', import.meta.url), 'utf8');
  assert.match(css, /\.accessGroup\s*\{[^}]*grid-template-columns: minmax\(0, .85fr\) minmax\(0, 2fr\)/u);
  assert.match(css, /\.pathway\s*\{[^}]*grid-template-columns: minmax\(110px, .7fr\) minmax\(0, 1.3fr\)/u);
  assert.match(css, /\.branch \.route::before\s*\{[^}]*border-left: 1.5px/u);
  assert.match(css, /\.channel\s*\{[^}]*grid-template-rows: 1fr auto 1fr/u);
  assert.match(css, /\.gateway\s*\{[^}]*grid-row: 2/u);
  assert.match(css, /\.branch \.route:first-child::before \{ top: 50%/u);
  assert.match(css, /\.branch \.route:last-child::before \{ bottom: 50%/u);
  assert.match(css, /\.multi \.clients\s*\{[^}]*grid-column: 1; grid-row: 1; align-self: stretch/u);
  assert.match(css, /\.multi \.channels \{ display: contents/u);
  assert.match(css, /@media \(max-width: 960px\)/u);
  assert.match(css, /\.accessGroup, \.pathway \{ grid-template-columns: minmax\(0, 1fr\)/u);
  assert.match(css, /\.multi \.clients::after, \.multi \.channel::before \{ display: none/u);
  assert.doesNotMatch(css, /overflow-x: (?:auto|scroll)|min-width: \d{3,}px/u);
});
