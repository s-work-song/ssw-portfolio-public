import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { developmentConnections, developmentDrawingRoutes, developmentMachines, developmentNetworkDescription, developmentNetworkNotes, orthogonalPath, phoneRemoteGroup, tailnetMachines, topologySize } from '../../../../src/features/architecture/data/developmentTopology.ts';
import { environmentDiagramNotes, environmentGrokGroup, environmentGroups, environmentLayouts, environmentNodes, environmentPhoneApps, environmentRelations, environmentServiceGroup, environmentTailnet } from '../../../../src/features/architecture/data/developmentEnvironmentDiagram.ts';

function onBoundary([x, y], m) {
  const right = m.x + topologySize.machineWidth;
  const bottom = m.y + topologySize.machineHeight;
  return ((x === m.x || x === right) && y >= m.y && y <= bottom)
    || ((y === m.y || y === bottom) && x >= m.x && x <= right);
}

test('작업 PC는 왼쪽 열이고 같은 역할의 기기는 정확히 같은 행 높이를 사용한다', () => {
  const m = developmentMachines;
  assert.equal(m.Home.x, m.Laptop.x);
  assert.ok(m.Home.x < m.Pi.x && m.Laptop.x < m.Android.x);
  assert.equal(m.Home.y, m.Pi.y);
  assert.equal(m.Laptop.y, m.Android.y);
});

test('모든 연결은 수평·수직뿐이며 대각선 경로는 생성 단계에서 거부한다', () => {
  assert.equal(orthogonalPath([[0, 0], [0, 20], [30, 20]]), 'M 0 0 V 20 H 30');
  assert.throws(() => orthogonalPath([[0, 0], [20, 20]]), /orthogonal/u);
  assert.throws(() => orthogonalPath([[0, 0]]), /two endpoints/u);
  for (const c of [...developmentConnections, ...developmentDrawingRoutes]) {
    assert.doesNotMatch(orthogonalPath(c.route), /[LCQSA]/u, c.id);
    for (let index = 1; index < c.route.length; index += 1) assert.ok(c.route[index - 1][0] === c.route[index][0] || c.route[index - 1][1] === c.route[index][1], c.id);
  }
});

test('연결 양 끝은 대상 테두리에 붙고 경로가 기기 박스 내부를 가로지르지 않는다', () => {
  for (const c of developmentConnections) {
    assert.ok(onBoundary(c.route[0], developmentMachines[c.from]), c.id);
    assert.ok(onBoundary(c.route.at(-1), developmentMachines[c.to]), c.id);
    for (let index = 1; index < c.route.length; index += 1) {
      const [x1, y1] = c.route[index - 1];
      const [x2, y2] = c.route[index];
      for (const [id, m] of Object.entries(developmentMachines)) {
        const hitsInterior = x1 === x2
          ? x1 > m.x && x1 < m.x + topologySize.machineWidth && Math.max(y1, y2) > m.y && Math.min(y1, y2) < m.y + topologySize.machineHeight
          : y1 > m.y && y1 < m.y + topologySize.machineHeight && Math.max(x1, x2) > m.x && Math.min(x1, x2) < m.x + topologySize.machineWidth;
        assert.equal(hitsInterior, false, `${c.id} crosses ${id}`);
      }
    }
  }
});

test('기기 간 연결은 id가 겹치지 않고 가입 기기만 tailnet 범위이며 서비스 앱을 잇지 않는다', () => {
  assert.equal(new Set(developmentConnections.map(c => c.id)).size, developmentConnections.length);
  for (const id of tailnetMachines) assert.equal(developmentMachines[id].scope, 'tailnet');
  assert.ok(developmentConnections.every(c => c.from !== 'Grok' && c.to !== 'Grok'));
});


test('고정 배치는 겹치는 기기나 프레임 바깥 경로가 없다', () => {
  const machines = Object.values(developmentMachines);
  for (let index = 0; index < machines.length; index += 1) {
    const a = machines[index];
    assert.ok(a.x >= 0 && a.y >= 0 && a.x + topologySize.machineWidth <= topologySize.width && a.y + topologySize.machineHeight <= topologySize.height);
    for (const b of machines.slice(index + 1)) assert.equal(a.x < b.x + topologySize.machineWidth && a.x + topologySize.machineWidth > b.x && a.y < b.y + topologySize.machineHeight && a.y + topologySize.machineHeight > b.y, false);
  }
  for (const c of [...developmentConnections, ...developmentDrawingRoutes]) for (const [x, y] of c.route) assert.ok(x >= 0 && x <= topologySize.width && y >= 0 && y <= topologySize.height);
});

test('스마트폰 공통선은 한 번만 그린 뒤 집 PC와 노트북 두 대상으로 분기한다', () => {
  assert.equal(phoneRemoteGroup.source, 'Android');
  assert.deepEqual(phoneRemoteGroup.targets, ['Home', 'Laptop']);
  assert.deepEqual(phoneRemoteGroup.connectionIds, ['phone-home', 'phone-laptop']);
  const stem = developmentDrawingRoutes.filter(route => route.id === 'phone-shared');
  assert.equal(stem.length, 1);
  assert.ok(onBoundary(stem[0].route[0], developmentMachines.Android));
  assert.deepEqual(stem[0].route.at(-1), phoneRemoteGroup.junction);
  for (const [index, id] of phoneRemoteGroup.connectionIds.entries()) {
    const branch = developmentDrawingRoutes.find(route => route.id === id);
    assert.deepEqual(branch.route[0], phoneRemoteGroup.junction);
    assert.ok(onBoundary(branch.route.at(-1), developmentMachines[phoneRemoteGroup.targets[index]]));
  }
  const segments = developmentDrawingRoutes.flatMap(route => route.route.slice(1).map((point, index) => [route.route[index], point]));
  for (let index = 0; index < segments.length; index += 1) {
    const [[x1, y1], [x2, y2]] = segments[index];
    for (const [[a1, b1], [a2, b2]] of segments.slice(index + 1)) {
      const overlap = x1 === x2 && a1 === a2 && x1 === a1
        ? Math.min(Math.max(y1, y2), Math.max(b1, b2)) > Math.max(Math.min(y1, y2), Math.min(b1, b2))
        : y1 === y2 && b1 === b2 && y1 === b1
          ? Math.min(Math.max(x1, x2), Math.max(a1, a2)) > Math.max(Math.min(x1, x2), Math.min(a1, a2))
          : false;
      assert.equal(overlap, false, 'drawing routes must not paint a shared segment twice');
    }
  }
  const label = phoneRemoteGroup.labelPosition;
  assert.equal(label.y, phoneRemoteGroup.junction[1]);
  assert.ok(label.x - label.width / 2 > phoneRemoteGroup.junction[0]);
  assert.ok(label.x + label.width / 2 < developmentMachines.Android.x);
});

test('SVG 접근성 설명은 화면의 설명 항목과 같은 정보를 쓴다', () => {
  assert.equal(developmentNetworkDescription, developmentNetworkNotes.join(' '));
});

test('그룹·접근성 설명과 모바일 연결 카드는 정적 렌더링으로 제공한다', async () => {
  const component = await readFile(new URL('../../../../src/features/architecture/ui/DevelopmentTopology.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../../../src/features/architecture/ui/DevelopmentTopology.module.css', import.meta.url), 'utf8');
  assert.doesNotMatch(component, /['"]use client['"]|MermaidDiagram|fetch\(|dangerouslySetInnerHTML/u);
  for (const group of ['work-pcs', 'connected-devices']) assert.ok(component.includes(`data-group="${group}"`));
  assert.match(component, /role="img" aria-labelledby=/u);
  assert.match(component, /<title id="development-topology-svg-title"/u);
  assert.match(component, /<desc id="development-topology-svg-description"/u);
  assert.match(component, /developmentDrawingRoutes\.map/u);
  assert.match(component, /developmentConnections\.filter/u);
  assert.match(component, /\.map\(connection => <ConnectionRow/u);
  assert.equal((component.match(/<PathLabel \{\.\.\.phoneRemoteGroup\.labelPosition\}/gu) ?? []).length, 1);
  assert.equal((component.match(/<PhoneRemoteRow \/>/gu) ?? []).length, 1);
  assert.match(component, /<MachineCard id=\{phoneRemoteGroup\.source\}/u);
  assert.match(component, /phoneRemoteGroup\.targets\.map/u);
  assert.match(component, /<ul id="development-topology-description"/u);
  assert.match(component, /developmentNetworkNotes\.map/u);
  assert.doesNotMatch(component, /Cloudflare Tunnel|data-region="cloud"|botJunction/u);
  assert.doesNotMatch(css, /overflow-x: (?:auto|scroll)|min-width: \d{3,}px/u);
});

test('통합 그림은 물리 기기를 각각 한 번만 정의하고 앱은 폰 내부에 둔다', () => {
  assert.equal(new Set(environmentNodes.map(node => node.id)).size, environmentNodes.length);
  assert.deepEqual(new Set(environmentNodes.filter(node => node.kind === 'machine').map(node => node.id)), new Set(tailnetMachines));
  assert.ok(environmentPhoneApps.every(app => !environmentNodes.some(node => node.id === app.id)));
});


test('연결은 정의된 노드만 잇고 공통 선은 서비스 박스를 만들지 않으며 주소·키를 싣지 않는다', () => {
  const ids = new Set(environmentNodes.map(node => node.id));
  for (const relation of environmentRelations) assert.ok(ids.has(relation.from) && ids.has(relation.to));
  assert.equal(environmentNodes.some(node => node.id === 'SharedServices'), false);
  assert.doesNotMatch(JSON.stringify({ environmentNodes, environmentRelations, environmentDiagramNotes }), /https?:\/\/|localhost|192\.168\.|100\.\d+\.\d+\.\d+|sk-proj-|PRIVATE KEY/u);
});


test('그록봇은 세 기기에서 합쳐진 단일 앱 접속 선으로 연결하고 공통 서비스 박스를 경유하지 않는다', () => {
  assert.deepEqual(environmentRelations.filter(relation => relation.to === 'Grok').map(relation => relation.from), environmentGrokGroup.clients);
  for (const layout of ['desktop', 'mobile']) {
    const drawing = environmentLayouts[layout];
    const stems = drawing.routes.filter(route => route.id === environmentGrokGroup.stemId);
    assert.equal(stems.length, 1);
    assert.equal(stems[0].arrow, true);
    assert.deepEqual(stems[0].points[0], environmentGrokGroup.junctions[layout]);
    assert.ok(drawing.junctions.some(junction => JSON.stringify(junction.point) === JSON.stringify(stems[0].points[0])));
    assert.ok(environmentGrokGroup.sourceRouteIds.every(id => drawing.routes.some(route => route.id === id)));
    assert.equal(drawing.routes.some(route => route.id === 'shared-grok'), false);
  }
});


test('각 노드는 정확히 한 영역에 속하고 영역 안에 놓이며 영역끼리 겹치지 않는다', () => {
  const groupedIds = environmentGroups.flatMap(group => group.nodeIds);
  assert.equal(new Set(groupedIds).size, groupedIds.length);
  assert.deepEqual(new Set(groupedIds), new Set(environmentNodes.map(node => node.id)));
  for (const layout of ['desktop', 'mobile']) {
    for (const group of environmentGroups) {
      const [gx, gy, gw, gh] = group[layout];
      for (const id of group.nodeIds) {
        const [x, y, width, height] = environmentNodes.find(node => node.id === id)[layout];
        assert.ok(x >= gx && y >= gy && x + width <= gx + gw && y + height <= gy + gh, `${layout}: ${id} outside ${group.id}`);
      }
      for (const peer of environmentGroups.filter(peer => peer !== group)) {
        const [px, py, pw, ph] = peer[layout];
        assert.equal(gx < px + pw && gx + gw > px && gy < py + ph && gy + gh > py, false, `${group.id} overlaps ${peer.id}`);
      }
    }
  }
});

test('Tailscale 테두리는 가입 머신만 감싸고 접속 수단 선은 노드 경계에 닿는다', () => {
  assert.deepEqual(new Set(environmentTailnet.nodeIds), new Set(tailnetMachines));
  for (const layout of ['desktop', 'mobile']) {
    const outline = environmentTailnet[layout].outline;
    // The orthogonal outline comprises an upper rectangle and a right-hand extension.
    const topY = outline[0][1];
    const bottomY = outline[2][1];
    const notchX = outline[3][0];
    const notchY = outline[4][1];
    const leftX = outline[0][0];
    const rightX = outline[1][0];
    const contains = (x, y) => x >= leftX && x <= rightX && y >= topY && y <= bottomY && (y <= notchY || x >= notchX);
    for (const node of environmentNodes) {
      const [x, y, width, height] = node[layout];
      const corners = [[x, y], [x + width, y], [x, y + height], [x + width, y + height]];
      assert.equal(corners.every(([px, py]) => contains(px, py)), environmentTailnet.nodeIds.includes(node.id), `${layout}: ${node.id} membership`);
      if (!environmentTailnet.nodeIds.includes(node.id)) assert.ok(corners.every(([px, py]) => !contains(px, py)), `${layout}: ${node.id} intrudes into tailnet`);
    }
    for (const target of ['CloudTunnel', 'CodexTool']) {
      const route = environmentLayouts[layout].routes.find(route => route.id === (target === 'CloudTunnel' ? 'service-tunnel' : 'service-codex'));
      const [nx, ny, width, height] = environmentNodes.find(node => node.id === target)[layout];
      const [x, y] = route.points.at(-1);
      assert.ok(((x === nx || x === nx + width) && y >= ny && y <= ny + height) || ((y === ny || y === ny + height) && x >= nx && x <= nx + width));
    }
  }
});


test('세 기기의 서비스 이용선은 내 기기 안에서 합치고 접속 수단과 그록봇으로 따로 내보낸다', () => {
  for (const layout of ['desktop', 'mobile']) {
    const drawing = environmentLayouts[layout];
    const personal = environmentGroups.find(group => group.id === 'personal')[layout];
    const stem = drawing.routes.find(route => route.id === environmentServiceGroup.stemId);
    assert.deepEqual(stem.points, [environmentServiceGroup.junctions[layout], environmentServiceGroup.forks[layout]]);
    assert.equal(stem.points[0][0], stem.points[1][0]);
    const [x, y] = stem.points[0];
    assert.ok(x > personal[0] && x < personal[0] + personal[2] && y > personal[1] && y < personal[1] + personal[3]);
    const fanout = drawing.routes.find(route => route.id === environmentServiceGroup.fanoutId);
    assert.ok(fanout.points[0][0] < stem.points[1][0] && fanout.points[1][0] === stem.points[1][0]);
    assert.ok(fanout.points.every(point => point[1] === stem.points[1][1]));
    const clientRoutes = drawing.routes.filter(route => [
      ...environmentServiceGroup.sourceRouteIds, environmentServiceGroup.collectorId,
      environmentServiceGroup.stemId, environmentServiceGroup.fanoutId, ...environmentServiceGroup.branchRouteIds,
      environmentGrokGroup.stemId,
    ].includes(route.id));
    const boundaryY = personal[1] + personal[3];
    const crossings = clientRoutes.filter(route => route.points.slice(1).some((point, index) => {
      const previous = route.points[index];
      return previous[0] === point[0] && Math.min(previous[1], point[1]) < boundaryY && Math.max(previous[1], point[1]) > boundaryY;
    }));
    assert.deepEqual(crossings.map(route => route.id), [environmentServiceGroup.stemId, environmentGrokGroup.stemId]);
    for (const id of environmentServiceGroup.branchRouteIds) {
      const branch = drawing.routes.find(route => route.id === id);
      assert.equal(branch.points[0][1], fanout.points[0][1]);
      assert.ok(branch.points[0][0] >= fanout.points[0][0] && branch.points[0][0] <= fanout.points[1][0]);
    }
    const piRoute = drawing.routes.find(route => route.id === 'tunnel-pi');
    assert.ok(!clientRoutes.includes(piRoute));
    assert.equal(piRoute.arrow, true);
    const grok = drawing.routes.find(route => route.id === environmentGrokGroup.stemId);
    assert.deepEqual(grok.points[0], environmentGrokGroup.junctions[layout]);
    assert.equal(grok.points[0][1], environmentServiceGroup.junctions[layout][1]);
    assert.ok(grok.points[0][0] > fanout.points.at(-1)[0]);
    assert.ok(grok.points[0][1] < boundaryY);
  }
});

test('데스크톱 그록봇과 Codex은 꺾임 없이 수직으로 연결하고 Codex 카드 상단의 왼편으로 들어간다', () => {
  const drawing = environmentLayouts.desktop;
  const stem = drawing.routes.find(route => route.id === environmentServiceGroup.stemId);
  const codex = drawing.routes.find(route => route.id === 'service-codex');
  assert.deepEqual(stem.points.at(-1), codex.points[0]);
  assert.equal(stem.points[0][0], codex.points.at(-1)[0], 'the collector-to-Codex path has no lateral offset');
  const home = drawing.routes.find(route => route.id === 'home-services');
  assert.deepEqual(home.points.at(-1), stem.points[0]);
  assert.equal(new Set(drawing.junctions.map(junction => JSON.stringify(junction.point))).size, drawing.junctions.length);
  for (const [routeId, nodeId] of [['grok-access', 'Grok'], ['service-codex', 'CodexTool']]) {
    const route = drawing.routes.find(route => route.id === routeId);
    const [x, y, width] = environmentNodes.find(node => node.id === nodeId).desktop;
    assert.equal(route.points.length, 2);
    assert.equal(route.points[0][0], route.points[1][0]);
    assert.equal(route.points[1][1], y);
    assert.ok(route.points[1][0] > x && route.points[1][0] < x + width);
  }
  const forkY = environmentServiceGroup.forks.desktop[1];
  const grokX = environmentGrokGroup.junctions.desktop[0];
  assert.equal(drawing.routes.some(route => route.points.slice(1).some((point, index) => {
    const previous = route.points[index];
    return previous[1] === forkY && point[1] === forkY && Math.min(previous[0], point[0]) < grokX && Math.max(previous[0], point[0]) >= grokX;
  })), false);
});

for (const layout of ['desktop', 'mobile']) {
  test(`통합 ${layout} 배치의 기기·앱 영역이 겹치거나 프레임 밖으로 나가지 않는다`, () => {
    const drawing = environmentLayouts[layout];
    for (let index = 0; index < environmentNodes.length; index += 1) {
      const node = environmentNodes[index];
      const [x, y, width, height] = node[layout];
      assert.ok(x >= 0 && y >= 0 && x + width <= drawing.width && y + height <= drawing.height, node.id);
      for (const peer of environmentNodes.slice(index + 1)) {
        const [px, py, pw, ph] = peer[layout];
        assert.equal(x < px + pw && x + width > px && y < py + ph && y + height > py, false, `${node.id} overlaps ${peer.id}`);
      }
    }
    for (const route of drawing.routes) {
      assert.doesNotMatch(orthogonalPath(route.points), /[LCQSA]/u, route.id);
      for (const [x, y] of route.points) assert.ok(x >= 0 && y >= 0 && x <= drawing.width && y <= drawing.height, route.id);
      for (let index = 1; index < route.points.length; index += 1) {
        const [x1, y1] = route.points[index - 1];
        const [x2, y2] = route.points[index];
        for (const node of environmentNodes) {
          const [x, y, width, height] = node[layout];
          const hitsInterior = x1 === x2
            ? x1 > x && x1 < x + width && Math.max(y1, y2) > y && Math.min(y1, y2) < y + height
            : y1 > y && y1 < y + height && Math.max(x1, x2) > x && Math.min(x1, x2) < x + width;
          assert.equal(hitsInterior, false, `${route.id} crosses ${node.id}`);
        }
      }
      if (route.arrow) {
        const [x, y] = route.points.at(-1);
        assert.ok(environmentNodes.some(node => {
          const [nx, ny, width, height] = node[layout];
          return ((x === nx || x === nx + width) && y >= ny && y <= ny + height)
            || ((y === ny || y === ny + height) && x >= nx && x <= nx + width);
        }), `${route.id} arrow does not reach a node`);
      }
    }
  });
}

test('통합 SVG는 외부 렌더러 없이 정적으로 생성하고 모바일도 같은 기기 데이터를 사용한다', async () => {
  const component = await readFile(new URL('../../../../src/features/architecture/diagrams/DevelopmentEnvironmentDiagram.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../../../src/features/architecture/diagrams/DevelopmentEnvironmentDiagram.module.css', import.meta.url), 'utf8');
  assert.doesNotMatch(component, /['"]use client['"]|fetch\(|MermaidDiagram|dangerouslySetInnerHTML/u);
  assert.equal((component.match(/environmentNodes.map\(node => <Node/gu) ?? []).length, 1);
  assert.match(component, /data-environment-machine=\{node.kind === 'machine' \? node.id : undefined\}/u);
  assert.match(component, /data-environment-app=\{app.id\}/u);
  assert.match(component, /data-environment-session=\{app.session\}/u);
  assert.match(component, /data-environment-tailnet="membership"/u);
  assert.match(component, /aria-labelledby=\{`\$\{prefix\}-title \$\{prefix\}-description`\}/u);
  assert.match(css, /@media \(max-width: 760px\)/u);
  assert.match(css, /\.desktop \{ display: none; \}/u);
  assert.match(css, /\.mobile \{ display: block; \}/u);
  assert.doesNotMatch(css, /overflow-x: (?:auto|scroll)|min-width: \d{3,}px/u);
});
