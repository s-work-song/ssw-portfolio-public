/**
 * step 곡선으로 그린 머메이드 흐름도의 계단식 꺾임을 줄이는 후처리다.
 * dagre는 여러 칸을 건너는 선에 칸마다 경유점을 두고, step 곡선은 경유점마다 가로·세로로 꺾는다.
 * 그래서 경유점의 x가 조금만 달라도 한 번이면 될 꺾임이 계단이 된다. 그린 뒤 선마다 노드·라벨·다른 선을
 * 피하면서 꺾임이 더 적은 직각 경로를 찾고, 찾으면 그 경로로 바꾸고 라벨도 새 경로 위로 옮긴다.
 */

export type Point = { x: number; y: number };
export type Box = {
  left: number; top: number; right: number; bottom: number;
  /** 위·아래 변에서 선을 붙일 수 없는 양 끝 폭(육각형의 비스듬한 변, 둥근 상자의 곡선). */
  inset?: number;
};
type Segment = { from: Point; to: Point };
type Direction = 'up' | 'down' | 'left' | 'right';
type Port = { point: Point; direction: Direction };

export type EdgeGeometry = {
  /** 지금 그려진 직각 경로. 끝은 화살표 머리만큼 대상 노드에서 떨어져 있다. */
  points: Point[];
  /** 대상 노드 경계에 닿는 실제 끝점. 화살표 머리 길이를 구하는 데 쓴다. */
  boundaryEnd: Point;
  source: Box;
  target: Box;
  /** 이 선에 붙은 라벨 상자. */
  label?: Box;
};

export type Surroundings = {
  /** 피해야 할 상자: 다른 노드, 다른 선의 라벨, 묶음 제목. */
  obstacles: Box[];
  /** 다른 선들의 선분. 겹쳐 달리면 안 되고, 교차는 늘리지 않는다. */
  segments: Segment[];
  /** 묶음(subgraph) 테두리. 그 위를 겹쳐 달리거나 라벨을 걸치면 안 된다. */
  borders?: Segment[];
};

const EPSILON = 0.5;
const CLEARANCE = 4;
const PARALLEL_GAP = 4;
const MIN_LEG = 8;

const near = (a: number, b: number) => Math.abs(a - b) < EPSILON;
const isVertical = (direction: Direction) => direction === 'up' || direction === 'down';
const sign = (direction: Direction) => (direction === 'down' || direction === 'right' ? 1 : -1);
const center = (box: Box): Point => ({ x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 });

/** 겹친 점과 한 직선 위의 가운데 점을 지운다. */
export function compact(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const last = result.at(-1);
    if (last && near(last.x, point.x) && near(last.y, point.y)) continue;
    const before = result.at(-2);
    if (before && last && ((near(before.x, last.x) && near(last.x, point.x)) || (near(before.y, last.y) && near(last.y, point.y)))) {
      result.pop();
    }
    result.push(point);
  }
  return result;
}

export function segmentsOf(points: Point[]): Segment[] {
  return points.slice(1).map((to, index) => ({ from: points[index], to }));
}

function directionOf({ from, to }: Segment): Direction | undefined {
  if (near(from.x, to.x) && !near(from.y, to.y)) return to.y > from.y ? 'down' : 'up';
  if (near(from.y, to.y) && !near(from.x, to.x)) return to.x > from.x ? 'right' : 'left';
  return undefined;
}

const lengthOf = ({ from, to }: Segment) => Math.abs(to.x - from.x) + Math.abs(to.y - from.y);

/** 경계 위의 점이 상자의 어느 변에 있는지 보고, 그 변에서 바깥으로 나가는 방향을 돌려준다. */
function outward(point: Point, box: Box): Direction {
  const sides: [number, Direction][] = [
    [Math.abs(point.y - box.bottom), 'down'], [Math.abs(point.y - box.top), 'up'],
    [Math.abs(point.x - box.right), 'right'], [Math.abs(point.x - box.left), 'left'],
  ];
  return sides.reduce((best, side) => (side[0] < best[0] ? side : best))[1];
}

const opposite: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };

/** 선분이 상자(margin만큼 넓힌) 안쪽을 지나는지 본다. 변에 닿기만 하는 것은 지나지 않는 것으로 친다. */
function crossesBox({ from, to }: Segment, box: Box, margin: number) {
  return Math.min(from.x, to.x) < box.right + margin && Math.max(from.x, to.x) > box.left - margin
    && Math.min(from.y, to.y) < box.bottom + margin && Math.max(from.y, to.y) > box.top - margin;
}

const boxesOverlap = (a: Box, b: Box, margin: number) =>
  a.left < b.right + margin && a.right > b.left - margin && a.top < b.bottom + margin && a.bottom > b.top - margin;

/** 점수 배열을 앞에서부터 비교해 a가 더 나으면(작으면) true. */
function isBetter(a: number[], b: number[]) {
  const index = a.findIndex((value, position) => value !== b[position]);
  return index >= 0 && a[index] < b[index];
}

function overlapsParallel(a: Segment, b: Segment) {
  const aVertical = near(a.from.x, a.to.x);
  if (aVertical !== near(b.from.x, b.to.x)) return false;
  const [axis, along]: ['x' | 'y', 'x' | 'y'] = aVertical ? ['x', 'y'] : ['y', 'x'];
  if (Math.abs(a.from[axis] - b.from[axis]) >= PARALLEL_GAP) return false;
  const start = Math.max(Math.min(a.from[along], a.to[along]), Math.min(b.from[along], b.to[along]));
  const end = Math.min(Math.max(a.from[along], a.to[along]), Math.max(b.from[along], b.to[along]));
  return end - start > PARALLEL_GAP;
}

function crossesSegment(a: Segment, b: Segment) {
  const [vertical, horizontal] = near(a.from.x, a.to.x) ? [a, b] : [b, a];
  if (!near(vertical.from.x, vertical.to.x) || !near(horizontal.from.y, horizontal.to.y)) return false;
  const x = vertical.from.x;
  const y = horizontal.from.y;
  return x > Math.min(horizontal.from.x, horizontal.to.x) + EPSILON && x < Math.max(horizontal.from.x, horizontal.to.x) - EPSILON
    && y > Math.min(vertical.from.y, vertical.to.y) + EPSILON && y < Math.max(vertical.from.y, vertical.to.y) - EPSILON;
}

const crossingCount = (segments: Segment[], others: Segment[]) =>
  segments.reduce((count, segment) => count + others.filter((other) => crossesSegment(segment, other)).length, 0);

/** 위·아래 변에서 선을 붙일 수 있는 x 범위. */
function flatRange(box: Box): [number, number] {
  const inset = box.inset ?? Math.max(MIN_LEG, (box.bottom - box.top) / 2);
  const low = box.left + inset;
  const high = box.right - inset;
  return low > high ? [center(box).x, center(box).x] : [low, high];
}

/**
 * 선을 붙일 자리 후보. 위·아래 변은 원래 선의 위아래 흐름을 따르고(U자로 도는 경로를 막는다),
 * 좌우 끝은 양쪽 모두 쓴다. leaving이면 노드에서 나가는 방향, 아니면 노드로 들어가는 방향이다.
 */
function portsOf(box: Box, xs: number[], downward: boolean, leaving: boolean): Port[] {
  const [low, high] = flatRange(box);
  const values = new Set([center(box).x, ...xs].map((x) => Math.round(Math.min(high, Math.max(low, x)) * 10) / 10));
  const y = downward === leaving ? box.bottom : box.top;
  const vertical: Direction = downward ? 'down' : 'up';
  const middle = center(box).y;
  return [
    ...[...values].map((x) => ({ point: { x, y }, direction: vertical })),
    { point: { x: box.left, y: middle }, direction: leaving ? 'left' : 'right' },
    { point: { x: box.right, y: middle }, direction: leaving ? 'right' : 'left' },
  ];
}

/**
 * 두 자리를 잇는 꺾임 0~2회 후보. 같은 축으로 나가고 들어오면 가운데 선분의 위치를 여러 개 시험한다.
 * 위치 후보는 원래 경로의 꺾인 자리, 두 끝의 중간과 바깥, 그리고 장애물 가장자리 바로 바깥이다.
 */
function routesBetween(start: Port, end: Port, levels: Point[], obstacles: Box[]): Point[][] {
  const from = start.point;
  const to = end.point;
  if (isVertical(start.direction) !== isVertical(end.direction)) {
    return [isVertical(start.direction) ? [from, { x: from.x, y: to.y }, to] : [from, { x: to.x, y: from.y }, to]];
  }
  const vertical = isVertical(start.direction);
  const axis = vertical ? 'y' : 'x';
  const [low, high] = vertical ? ['top', 'bottom'] as const : ['left', 'right'] as const;
  const gap = CLEARANCE + 2;
  const routes: Point[][] = [[from, to]];
  const values = [...levels.map((level) => level[axis]), (from[axis] + to[axis]) / 2,
    from[axis] + sign(start.direction) * MIN_LEG * 2, to[axis] - sign(end.direction) * MIN_LEG * 2,
    ...obstacles.flatMap((box) => [box[low] - gap, box[high] + gap])];
  for (const value of new Set(values)) {
    routes.push(vertical
      ? [from, { x: from.x, y: value }, { x: to.x, y: value }, to]
      : [from, { x: value, y: from.y }, { x: value, y: to.y }, to]);
  }
  return routes;
}

type Placement = { label?: Point; shift: number };

/**
 * 라벨을 새 경로 위에 놓는다. 원래 자리에서 가장 덜 움직이는 자리를 고르고, 놓을 곳이 없으면 undefined.
 * 화살표 머리와 출발점에는 라벨을 얹지 않는다.
 */
function placeLabel(label: Box, segments: Segment[], around: Surroundings): Placement | undefined {
  const ends = [segments[0].from, segments.at(-1)!.to];
  const width = label.right - label.left;
  const height = label.bottom - label.top;
  const origin = center(label);
  const spots: Point[] = [];
  for (const segment of segments) {
    const vertical = near(segment.from.x, segment.to.x);
    const [axis, half] = vertical ? ['y', height / 2] as const : ['x', width / 2] as const;
    const low = Math.min(segment.from[axis], segment.to[axis]) + half;
    const high = Math.max(segment.from[axis], segment.to[axis]) - half;
    if (low > high) continue;
    const along = Math.min(high, Math.max(low, origin[axis]));
    spots.push(vertical ? { x: segment.from.x, y: along } : { x: along, y: segment.from.y });
  }
  spots.sort((a, b) => Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y));
  for (const spot of spots) {
    const box = { left: spot.x - width / 2, right: spot.x + width / 2, top: spot.y - height / 2, bottom: spot.y + height / 2 };
    if (around.obstacles.some((obstacle) => boxesOverlap(box, obstacle, CLEARANCE / 2))) continue;
    if ([...around.segments, ...(around.borders ?? [])].some((segment) => crossesBox(segment, box, 0))) continue;
    if (ends.some((point) => crossesBox({ from: point, to: point }, box, MIN_LEG))) continue;
    // 자기 경로에서 라벨을 실은 선분 말고 다른 선분이 라벨을 지나가면 안 된다.
    if (segments.filter((segment) => crossesBox(segment, box, -EPSILON)).length > 1) continue;
    const shift = Math.hypot(spot.x - origin.x, spot.y - origin.y);
    return { label: shift < EPSILON ? undefined : spot, shift };
  }
  return undefined;
}

/**
 * 선 하나를 꺾임이 더 적은 직각 경로로 바꿀 수 있으면 새 경로(끝은 화살표 머리만큼 짧게)와
 * 옮길 라벨 중심을 돌려준다. 원래보다 꺾임이 줄지 않거나 교차가 늘면 undefined.
 */
export function straightenEdge(edge: EdgeGeometry, around: Surroundings) {
  const original = compact(edge.points);
  const originalSegments = segmentsOf(original);
  if (originalSegments.some((segment) => !directionOf(segment))) return undefined;
  const originalBends = original.length - 2;
  if (originalBends < 1) return undefined;
  const originalCrossings = crossingCount(originalSegments, around.segments);
  const arrow = Math.hypot(edge.boundaryEnd.x - original.at(-1)!.x, edge.boundaryEnd.y - original.at(-1)!.y);

  const start = original[0];
  const end = edge.boundaryEnd;
  // 두 노드의 붙일 수 있는 범위가 겹치면 그 가운데에서 곧게 내리는 후보도 넣는다.
  const [sourceLow, sourceHigh] = flatRange(edge.source);
  const [targetLow, targetHigh] = flatRange(edge.target);
  const shared = Math.max(sourceLow, targetLow) <= Math.min(sourceHigh, targetHigh)
    ? [(Math.max(sourceLow, targetLow) + Math.min(sourceHigh, targetHigh)) / 2] : [];
  const downward = end.y >= start.y;
  // 상대 노드의 옆을 바로 스치는 자리도 넣어, 상대 노드 옆으로 한 번만 꺾어 들어가는 경로를 만들 수 있게 한다.
  const starts: Port[] = [{ point: start, direction: outward(start, edge.source) },
    ...portsOf(edge.source, [start.x, end.x, ...shared, edge.target.left - MIN_LEG, edge.target.right + MIN_LEG], downward, true)];
  const ends: Port[] = [{ point: end, direction: opposite[outward(end, edge.target)] },
    ...portsOf(edge.target, [end.x, start.x, ...shared, edge.source.left - MIN_LEG, edge.source.right + MIN_LEG], downward, false)];

  let best: { points: Point[]; label?: Point; score: number[] } | undefined;
  for (const from of starts) {
    for (const to of ends) {
      for (const route of routesBetween(from, to, original, around.obstacles)) {
        const points = compact(route);
        const segments = segmentsOf(points);
        const directions = segments.map(directionOf);
        if (directions.some((direction) => !direction)) continue;
        if (directions[0] !== from.direction || directions.at(-1) !== to.direction) continue;
        if (lengthOf(segments[0]) < MIN_LEG / 2 || lengthOf(segments.at(-1)!) < arrow + MIN_LEG) continue;
        // 화살표 머리는 마지막 선분 끝에 붙으므로 그만큼 짧게 끝낸다.
        const last = points.at(-1)!;
        const shortened = [...points.slice(0, -1), { x: last.x - (isVertical(to.direction) ? 0 : sign(to.direction) * arrow), y: last.y - (isVertical(to.direction) ? sign(to.direction) * arrow : 0) }];
        const drawn = segmentsOf(shortened);
        const blocked = drawn.some((segment, index) => around.obstacles.some((box) => crossesBox(segment, box, CLEARANCE))
          || (index > 0 && crossesBox(segment, edge.source, -1))
          || (index < drawn.length - 1 && crossesBox(segment, edge.target, -1))
          || [...around.segments, ...(around.borders ?? [])].some((other) => overlapsParallel(segment, other)));
        if (blocked) continue;
        const placement = edge.label ? placeLabel(edge.label, drawn, around) : { shift: 0 };
        if (!placement) continue;
        const bends = shortened.length - 2;
        const crossings = crossingCount(drawn, around.segments);
        if (bends >= originalBends || crossings > originalCrossings) continue;
        // 꺾임 수, 교차 수, 라벨 이동 거리, 전체 길이 순으로 고른다.
        const score = [bends, crossings, Math.round(placement.shift), drawn.reduce((sum, segment) => sum + lengthOf(segment), 0)];
        if (!best || isBetter(score, best.score)) best = { points: shortened, label: placement.label, score };
      }
    }
  }
  return best && { points: best.points, label: best.label };
}

export type LoopGeometry = {
  /** 지금 그려진 순환 화살표 경로. */
  points: Point[];
  node: Box;
  /** 화살표 머리 길이. 경로 끝은 노드 경계에서 이만큼 떨어져 끝난다. */
  arrow: number;
  label?: Box;
};

type Side = 'top' | 'bottom' | 'left' | 'right';

/**
 * 같은 노드로 돌아오는 순환 화살표가 다른 선과 겹치거나 교차하면, 노드의 빈 변에 작은 ㄷ자로 다시 긋는다.
 * 라벨은 ㄷ자 바깥에 둔다. 지금 경로가 다른 선과 엉키지 않으면 undefined(그대로 둔다).
 */
export function rerouteLoop(loop: LoopGeometry, around: Surroundings) {
  const borders = around.borders ?? [];
  const original = segmentsOf(compact(loop.points));
  const tangled = original.some((segment) => around.segments.some((other) => crossesSegment(segment, other) || overlapsParallel(segment, other)));
  if (!tangled) return undefined;

  const { node, arrow, label } = loop;
  const labelWidth = label ? label.right - label.left : 0;
  const labelHeight = label ? label.bottom - label.top : 0;
  const middle = center(node);
  let best: { points: Point[]; label?: Point; score: number[] } | undefined;
  for (const side of ['top', 'bottom', 'left', 'right'] as Side[]) {
    const horizontalSide = side === 'top' || side === 'bottom';
    const [low, high] = horizontalSide ? flatRange(node) : [node.top + MIN_LEG / 2, node.bottom - MIN_LEG / 2];
    const span = Math.min(MIN_LEG * 4, high - low);
    if (span < MIN_LEG * 2) continue;
    const outwardSign = side === 'top' || side === 'left' ? -1 : 1;
    const edge = { top: node.top, bottom: node.bottom, left: node.left, right: node.right }[side];
    const starts = new Set([low, (low + high - span) / 2, high - span]);
    for (let value = low; value <= high - span; value += MIN_LEG) starts.add(value);
    for (const depth of [MIN_LEG * 2, MIN_LEG * 3, MIN_LEG * 4]) {
      for (const start of starts) {
        const end = start + span;
        const out = edge + outwardSign * depth;
        const last = edge + outwardSign * arrow;
        const points = horizontalSide
          ? [{ x: start, y: edge }, { x: start, y: out }, { x: end, y: out }, { x: end, y: last }]
          : [{ x: edge, y: start }, { x: out, y: start }, { x: out, y: end }, { x: last, y: end }];
        const segments = segmentsOf(points);
        const blocked = segments.some((segment) => around.obstacles.some((box) => crossesBox(segment, box, CLEARANCE))
          || [...around.segments, ...borders].some((other) => crossesSegment(segment, other) || overlapsParallel(segment, other)));
        if (blocked) continue;
        let spot: Point | undefined;
        if (label) {
          const gap = 3;
          spot = horizontalSide
            ? { x: (start + end) / 2, y: out + outwardSign * (labelHeight / 2 + gap) }
            : { x: out + outwardSign * (labelWidth / 2 + gap), y: (start + end) / 2 };
          const box = { left: spot.x - labelWidth / 2, right: spot.x + labelWidth / 2, top: spot.y - labelHeight / 2, bottom: spot.y + labelHeight / 2 };
          if (boxesOverlap(box, node, 0) || around.obstacles.some((obstacle) => boxesOverlap(box, obstacle, CLEARANCE / 2))) continue;
          if ([...around.segments, ...borders].some((segment) => crossesBox(segment, box, 0))) continue;
        }
        // 얕은 ㄷ자, 노드 가운데에 가까운 자리 순으로 고른다.
        const score = [depth, Math.round(Math.abs((start + end) / 2 - (horizontalSide ? middle.x : middle.y)))];
        if (!best || isBetter(score, best.score)) best = { points, label: spot, score };
      }
    }
  }
  return best && { points: best.points, label: best.label };
}

/* ---------- 그려진 SVG에 적용 ---------- */

function boxIn(element: SVGGraphicsElement, toSvg: DOMMatrix): Box {
  const { x, y, width, height } = element.getBBox();
  const matrix = toSvg.multiply(element.getScreenCTM()!);
  const corners = [new DOMPoint(x, y), new DOMPoint(x + width, y + height)].map((point) => point.matrixTransform(matrix));
  return {
    left: Math.min(corners[0].x, corners[1].x), right: Math.max(corners[0].x, corners[1].x),
    top: Math.min(corners[0].y, corners[1].y), bottom: Math.max(corners[0].y, corners[1].y),
  };
}

const distanceTo = (point: Point, box: Box) =>
  Math.hypot(Math.max(box.left - point.x, 0, point.x - box.right), Math.max(box.top - point.y, 0, point.y - box.bottom));

/**
 * 머메이드가 그린 flowchart SVG의 선을 곧게 편다. 화면에 보이지 않아 크기를 잴 수 없으면 false를 돌려준다.
 * 순환 화살표는 다른 선과 엉킬 때만 빈 변으로 옮기고, 직각이 아닌 선은 건드리지 않는다.
 */
export function straightenRenderedEdges(svg: SVGSVGElement): boolean {
  const screen = svg.getScreenCTM();
  if (!screen || svg.getBoundingClientRect().width === 0) return false;
  const toSvg = screen.inverse();
  const nodes = [...svg.querySelectorAll<SVGGElement>('.nodes .node')].map((element): Box => {
    const box = boxIn(element, toSvg);
    const height = box.bottom - box.top;
    // 사각형은 변 전체, 육각형(polygon)은 비스듬한 변(높이의 1/4)을 뺀 범위, 둥근 상자는 곡선을 뺀 범위에 선을 붙인다.
    const shape = element.querySelector(':scope > .label-container')?.tagName;
    const inset = shape === 'rect' ? MIN_LEG / 2 : shape === 'polygon' ? height / 4 + MIN_LEG / 2 : height / 2 + 2;
    return { ...box, inset };
  });
  const titles = [...svg.querySelectorAll<SVGGElement>('.cluster-label')].map((element) => boxIn(element, toSvg));
  const borders = [...svg.querySelectorAll<SVGRectElement>('.cluster > rect')].flatMap((element) => {
    const { left, top, right, bottom } = boxIn(element, toSvg);
    return segmentsOf([{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }, { x: left, y: top }]);
  });
  const labels = new Map<string, { element: SVGGElement; box: Box }>();
  for (const element of svg.querySelectorAll<SVGGElement>('.edgeLabels .edgeLabel')) {
    const id = element.querySelector<SVGGElement>('[data-id]')?.dataset.id;
    if (id && element.textContent?.trim()) labels.set(id, { element, box: boxIn(element, toSvg) });
  }

  const nearest = (point: Point) => nodes.reduce((best, box) => (distanceTo(point, box) < distanceTo(point, best) ? box : best));
  // 모든 선을 읽어 두되, 서로 다른 두 노드를 잇는 선에는 geometry를, 같은 노드로 돌아오는 선에는 loop를 붙인다.
  // 건드리지 않는 선도 다른 선이 피해야 할 장애물로 남긴다.
  const edges = [...svg.querySelectorAll<SVGPathElement>('.edgePaths path[data-id]')].flatMap((path) => {
    const d = path.getAttribute('d') ?? '';
    if (/[^MLml\d\s,.eE+-]/u.test(d)) return [];
    const local = path.getScreenCTM()!;
    const fromPath = toSvg.multiply(local);
    const numbers = d.match(/-?\d*\.?\d+(?:e[+-]?\d+)?/giu)?.map(Number) ?? [];
    const points: Point[] = [];
    for (let index = 0; index + 1 < numbers.length; index += 2) {
      const { x, y } = new DOMPoint(numbers[index], numbers[index + 1]).matrixTransform(fromPath);
      points.push({ x, y });
    }
    if (points.length < 2) return [];
    const edge = {
      path, points, toPathSpace: local.inverse().multiply(screen), id: path.dataset.id!,
      geometry: undefined as EdgeGeometry | undefined, loop: undefined as LoopGeometry | undefined,
    };
    if (!path.dataset.points || nodes.length === 0) return [edge];
    const raw = JSON.parse(atob(path.dataset.points)) as Point[];
    const boundaryEnd = new DOMPoint(raw.at(-1)!.x, raw.at(-1)!.y).matrixTransform(fromPath);
    const source = nearest(points[0]);
    const target = nearest(boundaryEnd);
    if (distanceTo(points[0], source) > 2 || distanceTo(boundaryEnd, target) > 2) return [edge];
    if (source === target) {
      const last = points.at(-1)!;
      edge.loop = { points, node: source, arrow: Math.hypot(boundaryEnd.x - last.x, boundaryEnd.y - last.y) };
    } else {
      edge.geometry = { points, boundaryEnd: { x: boundaryEnd.x, y: boundaryEnd.y }, source, target };
    }
    return [edge];
  });

  const surroundings = (edge: (typeof edges)[number], ends: Box[]): Surroundings => ({
    obstacles: [...nodes.filter((box) => !ends.includes(box)), ...titles,
      ...[...labels.entries()].filter(([id]) => id !== edge.id).map(([, other]) => other.box)],
    segments: edges.filter((other) => other !== edge).flatMap((other) => segmentsOf(compact(other.points))),
    borders,
  });
  const redraw = (edge: (typeof edges)[number], points: Point[], spot: Point | undefined) => {
    edge.points = points;
    edge.path.setAttribute('d', `M${points.map((point) => {
      const { x, y } = new DOMPoint(point.x, point.y).matrixTransform(edge.toPathSpace);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join('L')}`);
    const label = labels.get(edge.id);
    if (label && spot) {
      const shift = { x: spot.x - center(label.box).x, y: spot.y - center(label.box).y };
      const matrix = label.element.transform.baseVal.consolidate()?.matrix;
      label.element.setAttribute('transform', `translate(${(matrix?.e ?? 0) + shift.x}, ${(matrix?.f ?? 0) + shift.y})`);
      label.box = { left: label.box.left + shift.x, right: label.box.right + shift.x, top: label.box.top + shift.y, bottom: label.box.bottom + shift.y };
    }
  };

  // 순환 화살표를 먼저 빈 변으로 옮기고, 나머지 선은 그 순환 화살표를 피해서 편다.
  for (const edge of edges) {
    if (!edge.loop) continue;
    const result = rerouteLoop({ ...edge.loop, label: labels.get(edge.id)?.box }, surroundings(edge, [edge.loop.node]));
    if (result) redraw(edge, result.points, result.label);
  }
  for (const edge of edges) {
    if (!edge.geometry) continue;
    edge.geometry.label = labels.get(edge.id)?.box;
    const result = straightenEdge(edge.geometry, surroundings(edge, [edge.geometry.source, edge.geometry.target]));
    if (!result) continue;
    edge.geometry.points = result.points;
    redraw(edge, result.points, result.label);
  }
  return true;
}
