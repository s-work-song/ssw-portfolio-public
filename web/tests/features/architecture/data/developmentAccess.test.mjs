import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { developmentAccessDescription, developmentAccessRoutes, developmentAccessTargets, groupDevelopmentAccessChannels, groupDevelopmentAccessRoutes } from '../../../../src/features/architecture/data/developmentAccess.ts';
import { developmentMachines } from '../../../../src/features/architecture/data/developmentTopology.ts';

const byId = Object.fromEntries(developmentAccessRoutes.map(route => [route.id, route]));

test('접속 경로의 기기와 대상은 정의된 항목만 가리킨다', () => {
  for (const route of developmentAccessRoutes) {
    assert.equal(new Set(route.clients).size, route.clients.length);
    assert.ok(developmentAccessTargets[route.target]);
    for (const id of route.clients) assert.ok(developmentMachines[id]);
  }
});


test('묶음은 모든 현재 경로를 한 번씩 담는다', () => {
  const active = developmentAccessRoutes.filter(route => !route.historical);
  const routes = groupDevelopmentAccessRoutes(active).flatMap(group => group.routes);
  assert.equal(routes.length, active.length);
  assert.deepEqual(new Set(routes), new Set(active));
});

test('접속 수단 칩은 묶음의 경로를 빠짐없이 한 번씩 나눈다', () => {
  for (const group of groupDevelopmentAccessRoutes(developmentAccessRoutes.filter(route => !route.historical))) {
    const routes = groupDevelopmentAccessChannels(group.routes).flatMap(channel => channel.routes);
    assert.equal(routes.length, group.routes.length);
    assert.deepEqual(new Set(routes), new Set(group.routes));
  }
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
});

test('접속 그림은 기기와 접속 수단을 각각 공유하는 정적 HTML로 보여 준다', async () => {
  const component = await readFile(new URL('../../../../src/features/architecture/ui/DevelopmentAccessOverview.tsx', import.meta.url), 'utf8');
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
  assert.match(component, /filter\(route => route.historical\)/u);
  assert.match(component, /aria-labelledby="development-access-title" aria-describedby="development-access-description"/u);
});

test('개발 환경은 기기 정체성을 공유하는 통합 연결 그림 하나만 표시한다', async () => {
  const component = await readFile(new URL('../../../../src/features/architecture/ui/DevelopmentEnvironmentOverview.tsx', import.meta.url), 'utf8');
  assert.equal(component.split('<DevelopmentEnvironmentDiagram />').length - 1, 1);
  assert.doesNotMatch(component, /DevelopmentAccessOverview|DevelopmentTopology/u);
});

test('접속 그림은 가로 넘침을 만들지 않는다', async () => {
  const css = await readFile(new URL('../../../../src/features/architecture/ui/DevelopmentAccessOverview.module.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /overflow-x: (?:auto|scroll)|min-width: \d{3,}px/u);
});
