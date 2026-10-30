import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { developmentConnections, developmentDrawingRoutes, developmentMachines, developmentNetworkDescription, developmentNetworkNotes, orthogonalPath, phoneRemoteGroup, tailnetMachines, topologySize } from '../../../../src/features/architecture/data/developmentTopology.ts';
import { developmentAccessTargets, developmentAccessRoutes } from '../../../../src/features/architecture/data/developmentAccess.ts';
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

test('가입 기기 5개와 기기 간 4개 관계만 그려 서비스 이용 선과 혼동하지 않는다', () => {
  assert.equal(tailnetMachines.length, 5);
  assert.equal(Object.keys(developmentMachines).length, 5);
  assert.equal(developmentConnections.length, 4);
  assert.equal(new Set(developmentConnections.map(c => c.id)).size, 4);
  assert.deepEqual(developmentConnections.map(c => [c.from, c.to]), [
    ['Home', 'Laptop'], ['Home', 'Pi'], ['Home', 'Android'], ['Laptop', 'Android'],
  ]);
  for (const id of tailnetMachines) assert.equal(developmentMachines[id].scope, 'tailnet');
  assert.match(developmentNetworkDescription, /모든 원격 작업의 VPN 경유를 뜻하지/u);
  assert.match(developmentNetworkDescription, /그록봇의 앱 접속.*위의 접속 경로 그림/u);
  assert.ok(developmentConnections.every(c => c.from !== 'Grok' && c.to !== 'Grok'));
  assert.deepEqual(developmentAccessRoutes.find(route => route.target === 'Grok').clients, ['Home', 'Laptop', 'Android']);
});

test('Dots는 영어이고 연결하지 않은 클라우드에 새 터널을 만들지 않는다', () => {
  assert.equal(developmentAccessTargets.OpenAIDots, 'OpenAI Dots');
  assert.doesNotMatch(JSON.stringify({ developmentMachines, developmentAccessTargets }), /닷츠/u);
  for (const id of ['ComputeEngine', 'CodexCloud', 'OpenAIDots']) {
    assert.equal(developmentMachines[id], undefined);
    assert.notEqual(developmentAccessRoutes.find(route => route.target === id).via, 'Cloudflare Tunnel');
  }
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
  assert.equal(phoneRemoteGroup.label, 'Codex 원격 · Claude Remote Control');
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

test('설명은 읽기 쉬운 네 항목이며 SVG 접근성 문구와 같은 정보를 유지한다', () => {
  assert.equal(developmentNetworkNotes.length, 4);
  assert.equal(developmentNetworkDescription, developmentNetworkNotes.join(' '));
  assert.match(developmentNetworkNotes[0], /가입 기기 묶음.*모든 원격 작업의 VPN 경유를 뜻하지/u);
  assert.match(developmentNetworkNotes[1], /RustDesk.*내부망\(LAN\)/u);
  assert.match(developmentNetworkNotes[2], /스마트폰에서 집 PC와 노트북 각각/u);
  assert.match(developmentNetworkNotes[3], /그록봇의 앱 접속.*위의 접속 경로 그림/u);
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
  assert.match(css, /stroke-linejoin: miter/u);
  assert.match(css, /@media \(max-width: 960px\)/u);
  assert.match(css, /\.pair\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) 20px minmax\(0, 1fr\)/u);
  assert.match(css, /\.pair\s*\{[^}]*align-items: stretch/u);
  assert.match(css, /\.pairLine\s*\{[^}]*align-self: center/u);
  assert.match(css, /\.phoneTargets\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(css, /\.phoneStem\s*\{[^}]*left: 50%/u);
  assert.doesNotMatch(css, /overflow-x: (?:auto|scroll)|min-width: \d{3,}px/u);
});

test('통합 그림은 물리 기기 다섯 개를 각각 한 번만 정의하고 앱은 폰 내부에 둔다', () => {
  assert.equal(new Set(environmentNodes.map(node => node.id)).size, environmentNodes.length);
  assert.deepEqual(new Set(environmentNodes.filter(node => node.kind === 'machine').map(node => node.id)), new Set(tailnetMachines));
  assert.deepEqual(environmentPhoneApps.map(app => app.label), ['Codex 앱', 'Claude 앱']);
  assert.deepEqual(environmentPhoneApps.map(app => app.session), ['Codex 세션', 'Claude Code 세션']);
  assert.ok(environmentPhoneApps.every(app => !environmentNodes.some(node => node.id === app.id)));
  const phoneRemote = environmentRelations.filter(relation => relation.from === 'Android' && relation.kind === 'remote');
  assert.deepEqual(phoneRemote.map(relation => relation.to), ['Home', 'Laptop']);
  assert.ok(phoneRemote.every(relation => relation.methods.includes('Codex 원격') && relation.methods.includes('Claude Remote Control')));
});

test('Colab 안에 LLM과 ComfyUI 용도를 표시하고 별도 머신을 만들지 않는다', () => {
  const colab = environmentNodes.find(node => node.id === 'Colab');
  assert.deepEqual(colab.lines, ['LLM 추론 서버', 'ComfyUI 이미지 · 영상 생성']);
  assert.deepEqual(colab.mobileLines, ['LLM 추론 서버', 'ComfyUI', '이미지 · 영상 생성']);
  assert.equal(environmentNodes.some(node => node.id === 'ComfyUI'), false);
});

test('원격 PC 실행과 클라우드 작업을 구분하고 공통 선은 논리적 서비스 이용만 나타낸다', () => {
  const ids = new Set(environmentNodes.map(node => node.id));
  for (const relation of environmentRelations) assert.ok(ids.has(relation.from) && ids.has(relation.to));
  assert.equal(environmentNodes.some(node => node.id === 'SharedServices'), false);
  for (const target of ['CloudTunnel', 'CodexTool']) {
    assert.deepEqual(environmentRelations.filter(relation => relation.to === target).map(relation => relation.from), ['Home', 'Laptop', 'Android']);
  }
  assert.deepEqual(environmentRelations.filter(relation => relation.from === 'CodexTool').map(relation => relation.to), ['CodexCloud', 'OpenAIDots']);
  assert.deepEqual(environmentRelations.filter(relation => relation.from === 'CloudTunnel').map(relation => relation.to), ['Pi', 'Colab']);
  assert.deepEqual(environmentRelations.filter(relation => relation.kind === 'lan').map(relation => [relation.from, relation.to]), [['Home', 'Pi']]);
  assert.match(environmentDiagramNotes.join(' '), /코드는 해당 PC에서 실행.*클라우드·Dots 작업과는 별도/u);
  assert.match(environmentDiagramNotes.join(' '), /선이 만나는 점은 네트워크 장비나 프록시가 아닙니다/u);
  assert.match(environmentDiagramNotes.join(' '), /실제 Cloudflare Tunnel은 각각 별개/u);
  assert.doesNotMatch(JSON.stringify({ environmentNodes, environmentRelations, environmentDiagramNotes }), /https?:\/\/|localhost|192\.168\.|100\.\d+\.\d+\.\d+|sk-proj-|PRIVATE KEY/u);
});

test('폰은 PC 위에 두고 PC 두 대와 집 PC·Pi 직접 연결은 외곽 우회 없이 짧은 직선이다', () => {
  for (const layout of ['desktop', 'mobile']) {
    const home = environmentNodes.find(node => node.id === 'Home')[layout];
    const laptop = environmentNodes.find(node => node.id === 'Laptop')[layout];
    const phone = environmentNodes.find(node => node.id === 'Android')[layout];
    const pi = environmentNodes.find(node => node.id === 'Pi')[layout];
    assert.equal(home[1], laptop[1]);
    assert.ok(phone[1] + phone[3] < home[1]);
    assert.equal(home[0], pi[0]);
    assert.ok(pi[1] - home[1] - home[3] <= 100);
    const rustdesk = environmentLayouts[layout].routes.find(route => route.id === 'rustdesk');
    const lan = environmentLayouts[layout].routes.find(route => route.id === 'home-pi');
    assert.equal(rustdesk.points.length, 2);
    assert.equal(rustdesk.points[0][1], rustdesk.points[1][1]);
    assert.ok(rustdesk.points[1][0] - rustdesk.points[0][0] <= 240);
    assert.equal(lan.points.length, 2);
    assert.equal(lan.points[0][0], lan.points[1][0]);
    assert.ok(lan.points[1][1] - lan.points[0][1] <= 100);
  }
});

test('PC 카드 사이에는 RustDesk 설명과 양쪽 여백을 확보한다', () => {
  for (const layout of ['desktop', 'mobile']) {
    const home = environmentNodes.find(node => node.id === 'Home')[layout];
    const laptop = environmentNodes.find(node => node.id === 'Laptop')[layout];
    const gap = laptop[0] - home[0] - home[2];
    assert.ok(gap >= (layout === 'desktop' ? 240 : 60));
    assert.ok(home[2] >= (layout === 'desktop' ? 240 : 136));
    assert.equal(home[2], laptop[2]);
    const drawing = environmentLayouts[layout];
    const label = drawing.labels.find(label => label.text === 'RustDesk');
    const labelWidth = label.rotate === -90 ? 26 : label.width;
    const clearance = layout === 'desktop' ? 60 : 16;
    assert.ok(label.x - labelWidth / 2 - (home[0] + home[2]) >= clearance);
    assert.ok(laptop[0] - label.x - labelWidth / 2 >= clearance);
    const route = drawing.routes.find(route => route.id === 'rustdesk');
    assert.equal(route.points[0][0], home[0] + home[2]);
    assert.equal(route.points[1][0], laptop[0]);
  }
});

test('내부망은 LAN만 표시하며 폰은 PC 두 대의 중심보다 왼쪽으로 치우쳐 있다', async () => {
  const component = await readFile(new URL('../../../../src/features/architecture/diagrams/DevelopmentEnvironmentDiagram.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(JSON.stringify({ environmentNodes, environmentRelations, environmentDiagramNotes, environmentLayouts }), /SSH/u);
  assert.doesNotMatch(component, /SSH/u);
  assert.match(component, />LAN · <i className=\{styles\.vpn\} \/>VPN<\/span>/u);
  for (const layout of ['desktop', 'mobile']) {
    const home = environmentNodes.find(node => node.id === 'Home')[layout];
    const laptop = environmentNodes.find(node => node.id === 'Laptop')[layout];
    const phone = environmentNodes.find(node => node.id === 'Android')[layout];
    const pcCenter = (home[0] + home[2] / 2 + laptop[0] + laptop[2] / 2) / 2;
    assert.ok(phone[0] + phone[2] / 2 < pcCenter);
  }
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
  assert.match(environmentDiagramNotes.join(' '), /그록봇 앱 접속선은 오른쪽 합류선에서 따로 내려옵니다/u);
});

test('소유·접속 영역의 제목은 모두 오른쪽 위로 정렬한다', () => {
  assert.ok(environmentGroups.every(group => group.titleAnchor === 'end'));
});

test('내 기기 4대와 외부 머신 1+3개는 별도 영역에 두고 접속 수단에 머신을 넣지 않는다', () => {
  const personal = environmentGroups.find(group => group.id === 'personal');
  const external = environmentGroups.find(group => group.id === 'external');
  const access = environmentGroups.find(group => group.id === 'access');
  const externalTailnet = environmentGroups.find(group => group.id === 'externalTailnet');
  assert.deepEqual(personal.nodeIds, ['Home', 'Laptop', 'Android', 'Pi']);
  assert.deepEqual(external.nodeIds, ['CodexCloud', 'OpenAIDots', 'Colab']);
  assert.deepEqual(externalTailnet.nodeIds, ['Grok']);
  assert.deepEqual(access.nodeIds, ['CloudTunnel', 'CodexTool']);
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

test('그록봇은 접속 수단과 같은 높이지만 별도 머신 범주이며 Tailscale은 가입 머신만 감싼다', () => {
  assert.deepEqual(new Set(environmentTailnet.nodeIds), new Set(tailnetMachines));
  for (const layout of ['desktop', 'mobile']) {
    const access = environmentGroups.find(group => group.id === 'access')[layout];
    const grok = environmentGroups.find(group => group.id === 'externalTailnet')[layout];
    assert.equal(access[1], grok[1]);
    assert.ok(access[0] + access[2] < grok[0]);
    const personal = environmentGroups.find(group => group.id === 'personal')[layout];
    const phone = environmentNodes.find(node => node.id === 'Android')[layout];
    if (layout === 'mobile') assert.ok(phone[1] >= personal[1] + 44, 'phone clears the personal group heading');
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

test('영역 경계와 서비스 분기선 사이에 세로 여유를 두고 LAN과 VPN을 구분한다', () => {
  assert.match(environmentTailnet.title, /Tailscale VPN/u);
  assert.match(environmentDiagramNotes.join(' '), /초록 실선은 내부망\(LAN\) 연결, 초록 점선 테두리는 Tailscale VPN/u);
  for (const layout of ['desktop', 'mobile']) {
    const personal = environmentGroups.find(group => group.id === 'personal')[layout];
    const access = environmentGroups.find(group => group.id === 'access')[layout];
    const external = environmentGroups.find(group => group.id === 'external')[layout];
    assert.ok(access[1] - personal[1] - personal[3] >= 120);
    assert.ok(external[1] - access[1] - access[3] >= 80);
  }
  const desktop = environmentLayouts.desktop;
  const fanout = desktop.routes.find(route => route.id === environmentServiceGroup.fanoutId);
  const tailnetBoundary = environmentTailnet.desktop.outline[4][1];
  assert.ok(fanout.points[0][1] - tailnetBoundary >= 80);
  const access = environmentGroups.find(group => group.id === 'access').desktop;
  assert.ok(access[1] - fanout.points[0][1] >= 24);
  assert.equal(desktop.routes.find(route => route.id === 'grok-access').points.length, 2);
});

test('세 기기의 서비스 이용선은 내 기기 안에서 합치고 접속 수단과 그록봇으로 따로 내보낸다', () => {
  assert.deepEqual(environmentServiceGroup.clients, ['Home', 'Laptop', 'Android']);
  // 설명은 2~3문장으로 줄였다. 합류 뒤 접속 수단과 그록봇 선이 따로 나간다는 요지만 고정한다.
  assert.match(environmentDiagramNotes.join(' '), /세 기기의 선은 내 기기 영역에서 합쳐진 뒤 Cloudflare Tunnel·Codex 쪽으로 갈라지고/u);
  assert.match(environmentDiagramNotes.join(' '), /그록봇 앱 접속선은 오른쪽 합류선에서 따로 내려옵니다/u);
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
  assert.ok(home.points[1][0] - home.points[0][0] >= 90, 'the Home service line has room before descending');
  assert.equal(new Set(drawing.junctions.map(junction => JSON.stringify(junction.point))).size, drawing.junctions.length);
  for (const [routeId, nodeId] of [['grok-access', 'Grok'], ['service-codex', 'CodexTool']]) {
    const route = drawing.routes.find(route => route.id === routeId);
    const [x, y, width] = environmentNodes.find(node => node.id === nodeId).desktop;
    assert.equal(route.points.length, 2);
    assert.equal(route.points[0][0], route.points[1][0]);
    assert.equal(route.points[1][1], y);
    assert.ok(route.points[1][0] > x && route.points[1][0] < x + width);
    if (nodeId === 'CodexTool') {
      assert.ok(route.points[1][0] >= x + 32);
      assert.ok(route.points[1][0] <= x + width / 2 - 32);
    }
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
  assert.match(component, /이전 환경 · Google Compute Engine/u);
  assert.match(css, /@media \(max-width: 760px\)/u);
  assert.match(css, /\.desktop \{ display: none; \}/u);
  assert.match(css, /\.mobile \{ display: block; \}/u);
  assert.match(css, /stroke-dasharray: 5 5/u);
  assert.doesNotMatch(css, /overflow-x: (?:auto|scroll)|min-width: \d{3,}px/u);
});
