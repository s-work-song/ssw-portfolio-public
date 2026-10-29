import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLogGraph, layoutLogGraph } from '../../../../src/features/logs/map/logGraph.ts';
import { routeLogGraphEdges } from '../../../../src/features/logs/map/logGraphRouting.ts';

const CARD_WIDTH = 196;
const CARD_HEIGHT = 104;
const CLEARANCE = 10;
const EPSILON = 0.001;

const post = (slug, tags = ['routing']) => ({ slug, tags, title: slug, summary: '' });
const edge = (id, source, target) => ({ id, source, target });

function onCardSide(position, point, side) {
  const left = position.x;
  const right = position.x + CARD_WIDTH;
  const top = position.y;
  const bottom = position.y + CARD_HEIGHT;
  if (side === 'left' || side === 'right') {
    return Math.abs(point.x - (side === 'left' ? left : right)) <= EPSILON
      && point.y >= top - EPSILON && point.y <= bottom + EPSILON;
  }
  return Math.abs(point.y - (side === 'top' ? top : bottom)) <= EPSILON
    && point.x >= left - EPSILON && point.x <= right + EPSILON;
}

function crossesOpenRectangle(start, end, rectangle) {
  const left = rectangle.x;
  const right = rectangle.x + rectangle.width;
  const top = rectangle.y;
  const bottom = rectangle.y + rectangle.height;
  if (Math.abs(start.x - end.x) <= EPSILON) {
    return start.x > left + EPSILON && start.x < right - EPSILON
      && Math.max(start.y, end.y) > top + EPSILON
      && Math.min(start.y, end.y) < bottom - EPSILON;
  }
  if (Math.abs(start.y - end.y) <= EPSILON) {
    return start.y > top + EPSILON && start.y < bottom - EPSILON
      && Math.max(start.x, end.x) > left + EPSILON
      && Math.min(start.x, end.x) < right - EPSILON;
  }
  return true;
}

function assertRoundedPath(route, label) {
  assert.match(route.path, /^\s*M\s*-?(?:\d|\.)/i, `${label}: SVG path는 시작점에서 시작해야 한다`);
  assert.doesNotMatch(route.path, /\bC\b/i, `${label}: 직교 모서리에 큰 cubic 곡선을 쓰지 않는다`);
  if (route.points.length > 2) {
    assert.match(route.path, /[QA]/i, `${label}: 꺾인 경로의 모서리는 둥글게 표현해야 한다`);
  }

  const tokens = route.path.match(/[MLQA]|-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/gi) ?? [];
  let cursor = null;
  for (let index = 0; index < tokens.length;) {
    const command = tokens[index++].toUpperCase();
    if (command === 'M' || command === 'L') {
      cursor = { x: Number(tokens[index++]), y: Number(tokens[index++]) };
    } else if (command === 'Q') {
      const control = { x: Number(tokens[index++]), y: Number(tokens[index++]) };
      const end = { x: Number(tokens[index++]), y: Number(tokens[index++]) };
      assert.ok(cursor && Math.hypot(cursor.x - control.x, cursor.y - control.y) <= 6 + EPSILON,
        `${label}: quadratic 모서리 진입 반경은 6px 이하여야 한다`);
      assert.ok(Math.hypot(end.x - control.x, end.y - control.y) <= 6 + EPSILON,
        `${label}: quadratic 모서리 이탈 반경은 6px 이하여야 한다`);
      cursor = end;
    } else if (command === 'A') {
      const radiusX = Number(tokens[index++]);
      const radiusY = Number(tokens[index++]);
      index += 3;
      cursor = { x: Number(tokens[index++]), y: Number(tokens[index++]) };
      assert.ok(radiusX <= 6 + EPSILON && radiusY <= 6 + EPSILON,
        `${label}: arc 모서리 반경은 6px 이하여야 한다`);
    }
  }
}

function assertRouteGeometry(positions, graphEdge, route, { clearance = true } = {}) {
  const label = graphEdge.id;
  assert.ok(route, `${label}: 모든 유효한 edge에 경로가 있어야 한다`);
  assert.ok(Array.isArray(route.points) && route.points.length >= 2, `${label}: 경로점이 두 개 이상이어야 한다`);
  assert.ok(route.points.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)),
    `${label}: 경로점 좌표는 유한해야 한다`);

  const source = positions[graphEdge.source];
  const target = positions[graphEdge.target];
  assert.ok(onCardSide(source, route.points[0], route.sourceSide), `${label}: 시작점은 source 카드의 ${route.sourceSide} 테두리여야 한다`);
  assert.ok(onCardSide(target, route.points.at(-1), route.targetSide), `${label}: 끝점은 target 카드의 ${route.targetSide} 테두리여야 한다`);

  for (let index = 1; index < route.points.length; index++) {
    const start = route.points[index - 1];
    const end = route.points[index];
    assert.ok(Math.abs(start.x - end.x) <= EPSILON || Math.abs(start.y - end.y) <= EPSILON,
      `${label}: ${index - 1}번 segment는 수평 또는 수직이어야 한다`);
    assert.ok(Math.abs(start.x - end.x) > EPSILON || Math.abs(start.y - end.y) > EPSILON,
      `${label}: 같은 경로점을 연속으로 만들지 않는다`);

    for (const [slug, position] of Object.entries(positions)) {
      assert.equal(crossesOpenRectangle(start, end, {
        x: position.x, y: position.y, width: CARD_WIDTH, height: CARD_HEIGHT,
      }), false, `${label}: ${slug} 카드 내부를 지나면 안 된다`);

      if (clearance && slug !== graphEdge.source && slug !== graphEdge.target) {
        assert.equal(crossesOpenRectangle(start, end, {
          x: position.x - CLEARANCE,
          y: position.y - CLEARANCE,
          width: CARD_WIDTH + CLEARANCE * 2,
          height: CARD_HEIGHT + CLEARANCE * 2,
        }), false, `${label}: ${slug} 카드에서 ${CLEARANCE}px 이상 떨어져야 한다`);
      }
    }
  }
  assertRoundedPath(route, label);
}

test('가로·세로의 가까운 카드는 최단 직선과 source→target 방향의 포트를 선택한다', () => {
  const cases = [
    { source: { x: 0, y: 20 }, target: { x: 320, y: 20 }, sourceSide: 'right', targetSide: 'left' },
    { source: { x: 320, y: 20 }, target: { x: 0, y: 20 }, sourceSide: 'left', targetSide: 'right' },
    { source: { x: 30, y: 0 }, target: { x: 30, y: 230 }, sourceSide: 'bottom', targetSide: 'top' },
    { source: { x: 30, y: 230 }, target: { x: 30, y: 0 }, sourceSide: 'top', targetSide: 'bottom' },
  ];

  cases.forEach((item, index) => {
    const positions = { source: item.source, target: item.target };
    const graphEdge = edge(`axis-${index}`, 'source', 'target');
    const route = routeLogGraphEdges(positions, [graphEdge])[graphEdge.id];
    assertRouteGeometry(positions, graphEdge, route);
    assert.equal(route.sourceSide, item.sourceSide);
    assert.equal(route.targetSide, item.targetSide);
    assert.equal(route.points.length, 2, '가로·세로로 열린 두 카드는 되돌아 꺾지 않는다');
  });
});

test('역방향 직접 참조도 source와 target을 뒤집지 않는다', () => {
  const positions = { newer: { x: 340, y: 0 }, older: { x: 0, y: 0 } };
  const reference = edge('reference:newer-to-older', 'newer', 'older');
  const route = routeLogGraphEdges(positions, [reference])[reference.id];
  assertRouteGeometry(positions, reference, route);
  assert.equal(route.sourceSide, 'left');
  assert.equal(route.targetSide, 'right');
  assert.deepEqual(route.points.map(({ x }) => x), [340, CARD_WIDTH]);
});

test('2×2 카드의 가로·세로·대각 연결은 어떤 카드도 덮지 않는다', () => {
  const positions = {
    topLeft: { x: 0, y: 0 }, topRight: { x: 260, y: 0 },
    bottomLeft: { x: 0, y: 170 }, bottomRight: { x: 260, y: 170 },
  };
  const edges = [
    edge('top-row', 'topLeft', 'topRight'), edge('left-column', 'topLeft', 'bottomLeft'),
    edge('descending-diagonal', 'topLeft', 'bottomRight'), edge('ascending-diagonal', 'bottomLeft', 'topRight'),
  ];
  const routes = routeLogGraphEdges(positions, edges);
  assert.deepEqual(Object.keys(routes).sort(), edges.map(({ id }) => id).sort());
  edges.forEach((graphEdge) => assertRouteGeometry(positions, graphEdge, routes[graphEdge.id]));
});

test('중간 카드가 직선을 막으면 10px 여유를 둔 직교 다중 경로로 우회한다', () => {
  const positions = {
    source: { x: 0, y: 0 }, blocker: { x: 246, y: 0 }, target: { x: 492, y: 0 },
  };
  const graphEdge = edge('blocked', 'source', 'target');
  const route = routeLogGraphEdges(positions, [graphEdge])[graphEdge.id];
  assertRouteGeometry(positions, graphEdge, route);
  assert.ok(route.points.length >= 4, '장애물 앞에서 꺾고 지난 뒤 원래 축으로 돌아와야 한다');
  assert.ok(route.points.some(({ y }) => y <= -CLEARANCE + EPSILON || y >= CARD_HEIGHT + CLEARANCE - EPSILON),
    '중간 카드의 확장 경계 바깥으로 우회해야 한다');
});

test('28개 군집의 실제 배치에서 모든 생성 edge가 모든 카드 내부를 피한다', () => {
  const posts = Array.from({ length: 28 }, (_, index) => post(`cluster-${String(index).padStart(2, '0')}`));
  const { edges } = buildLogGraph(posts);
  const positions = layoutLogGraph(posts, edges);
  const routes = routeLogGraphEdges(positions, edges);
  assert.ok(edges.length > posts.length, '여러 방향과 장애물이 생기는 충분한 연결을 검사한다');
  assert.equal(Object.keys(routes).length, edges.length);
  edges.forEach((graphEdge) => assertRouteGeometry(positions, graphEdge, routes[graphEdge.id]));
});

test('위치·edge의 입력 순서가 달라도 경로와 포트 선택은 안정적이며 입력을 바꾸지 않는다', () => {
  const positions = {
    a: { x: 0, y: 0 }, b: { x: 260, y: 0 }, c: { x: 0, y: 170 }, d: { x: 260, y: 170 },
  };
  const edges = [edge('a-d', 'a', 'd'), edge('b-c', 'b', 'c'), edge('a-b', 'a', 'b')];
  const beforePositions = JSON.stringify(positions);
  const beforeEdges = JSON.stringify(edges);
  const first = routeLogGraphEdges(positions, edges);
  const reversedPositions = Object.fromEntries(Object.entries(positions).toReversed());
  const second = routeLogGraphEdges(reversedPositions, edges.toReversed());

  assert.deepEqual(second, first);
  assert.equal(JSON.stringify(positions), beforePositions);
  assert.equal(JSON.stringify(edges), beforeEdges);
});
