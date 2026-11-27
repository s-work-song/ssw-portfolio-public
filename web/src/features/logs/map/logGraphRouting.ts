type Point = { x: number; y: number };
type Side = "left" | "right" | "top" | "bottom";
type Rect = { left: number; right: number; top: number; bottom: number };
type Port = { side: Side; point: Point; exit: Point; axis: number };
export type LogEdgeRoute = { points: Point[]; sourceSide: Side; targetSide: Side; path: string };

const WIDTH = 196;
const HEIGHT = 104;
const CLEARANCE = 10;
const BEND_COST = 24;

function ports({ x, y }: Point): Port[] {
  return [
    { side: "left", point: { x, y: y + HEIGHT / 2 }, exit: { x: x - CLEARANCE, y: y + HEIGHT / 2 }, axis: 0 },
    { side: "right", point: { x: x + WIDTH, y: y + HEIGHT / 2 }, exit: { x: x + WIDTH + CLEARANCE, y: y + HEIGHT / 2 }, axis: 0 },
    { side: "top", point: { x: x + WIDTH / 2, y }, exit: { x: x + WIDTH / 2, y: y - CLEARANCE }, axis: 1 },
    { side: "bottom", point: { x: x + WIDTH / 2, y: y + HEIGHT }, exit: { x: x + WIDTH / 2, y: y + HEIGHT + CLEARANCE }, axis: 1 },
  ];
}

function blocked(a: Point, b: Point, rects: Rect[]) {
  return rects.some((rect) => a.y === b.y
    ? a.y > rect.top && a.y < rect.bottom && Math.max(a.x, b.x) > rect.left && Math.min(a.x, b.x) < rect.right
    : a.x > rect.left && a.x < rect.right && Math.max(a.y, b.y) > rect.top && Math.min(a.y, b.y) < rect.bottom);
}

function simplify(points: Point[]) {
  const result: Point[] = [];
  for (const point of points) {
    const last = result.at(-1);
    if (last?.x === point.x && last.y === point.y) continue;
    const previous = result.at(-2);
    if (last && previous && ((previous.x === last.x && last.x === point.x)
      || (previous.y === last.y && last.y === point.y))) result.pop();
    result.push(point);
  }
  return result;
}

/** 카드에서 10px 떨어진 경로의 모서리만 최대 6px 둥글게 처리한다. */
function roundedPath(points: Point[]) {
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length - 1; index++) {
    const before = points[index - 1];
    const point = points[index];
    const after = points[index + 1];
    const incoming = Math.hypot(point.x - before.x, point.y - before.y);
    const outgoing = Math.hypot(after.x - point.x, after.y - point.y);
    const radius = Math.min(6, incoming / 2, outgoing / 2);
    const entry = { x: point.x + (before.x - point.x) / incoming * radius, y: point.y + (before.y - point.y) / incoming * radius };
    const exit = { x: point.x + (after.x - point.x) / outgoing * radius, y: point.y + (after.y - point.y) / outgoing * radius };
    path += ` L ${entry.x} ${entry.y} Q ${point.x} ${point.y} ${exit.x} ${exit.y}`;
  }
  const last = points.at(-1)!;
  return `${path} L ${last.x} ${last.y}`;
}

type QueueItem = { state: number; cost: number };
class MinQueue {
  items: QueueItem[] = [];
  push(item: QueueItem) {
    let index = this.items.length;
    this.items.push(item);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.items[parent].cost <= item.cost) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = item;
  }
  pop() {
    const first = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length) {
      let index = 0;
      while (index * 2 + 1 < this.items.length) {
        let child = index * 2 + 1;
        if (child + 1 < this.items.length && this.items[child + 1].cost < this.items[child].cost) child++;
        if (this.items[child].cost >= last.cost) break;
        this.items[index] = this.items[child];
        index = child;
      }
      this.items[index] = last;
    }
    return first;
  }
}

/** 모든 카드를 피해 직교 경로를 찾는다. 선택·확대율과 무관하게 참조 방향을 유지한다. */
export function routeLogGraphEdges(
  positions: Record<string, Point>,
  edges: { id: string; source: string; target: string }[],
): Record<string, LogEdgeRoute> {
  if (!edges.length) return {};
  const cards = Object.entries(positions).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const cardPorts = new Map(cards.map(([id, point]) => [id, ports(point)]));
  const rects = cards.map(([, { x, y }]) => ({
    left: x - CLEARANCE, right: x + WIDTH + CLEARANCE,
    top: y - CLEARANCE, bottom: y + HEIGHT + CLEARANCE,
  }));
  const exits = [...cardPorts.values()].flat().map((port) => port.exit);
  const xs = [...new Set(exits.map((point) => point.x))].sort((a, b) => a - b);
  const ys = [...new Set(exits.map((point) => point.y))].sort((a, b) => a - b);
  const xIndices = new Map(xs.map((value, index) => [value, index]));
  const yIndices = new Map(ys.map((value, index) => [value, index]));
  const pointId = ({ x, y }: Point) => yIndices.get(y)! * xs.length + xIndices.get(x)!;
  const grid = ys.flatMap((y) => xs.map((x) => ({ x, y })));
  const adjacency: { to: number; distance: number; axis: number }[][] = grid.map(() => []);
  for (let index = 0; index < grid.length; index++) {
    const row = Math.floor(index / xs.length);
    const column = index % xs.length;
    const candidates = [
      ...(column + 1 < xs.length ? [{ to: index + 1, axis: 0 }] : []),
      ...(row + 1 < ys.length ? [{ to: index + xs.length, axis: 1 }] : []),
    ];
    for (const { to, axis } of candidates) {
      if (blocked(grid[index], grid[to], rects)) continue;
      const distance = Math.abs(grid[index].x - grid[to].x) + Math.abs(grid[index].y - grid[to].y);
      adjacency[index].push({ to, distance, axis });
      adjacency[to].push({ to: index, distance, axis });
    }
  }

  const routes: Record<string, LogEdgeRoute> = {};
  for (const edge of edges) {
    const sourcePorts = cardPorts.get(edge.source);
    const targetPorts = cardPorts.get(edge.target);
    if (!sourcePorts || !targetPorts || edge.source === edge.target) continue;
    const costs = new Float64Array(grid.length * 2).fill(Infinity);
    const previous = new Int32Array(costs.length).fill(-1);
    const origins = new Int8Array(costs.length).fill(-1);
    const queue = new MinQueue();
    sourcePorts.forEach((port, index) => {
      const state = pointId(port.exit) * 2 + port.axis;
      costs[state] = CLEARANCE;
      origins[state] = index;
      queue.push({ state, cost: CLEARANCE });
    });
    const destinations = new Map(targetPorts.map((port, index) => [pointId(port.exit), index]));
    let bestCost = Infinity;
    let bestState = -1;
    let targetIndex = -1;
    while (queue.items.length) {
      const { state, cost } = queue.pop();
      if (cost !== costs[state]) continue;
      if (cost >= bestCost) break;
      const node = state >> 1;
      const axis = state % 2;
      const destination = destinations.get(node);
      if (destination !== undefined) {
        const finalCost = cost + CLEARANCE + (axis === targetPorts[destination].axis ? 0 : BEND_COST);
        if (finalCost < bestCost) {
          bestCost = finalCost; bestState = state; targetIndex = destination;
        }
      }
      for (const next of adjacency[node]) {
        const nextState = next.to * 2 + next.axis;
        const nextCost = cost + next.distance + (next.axis === axis ? 0 : BEND_COST);
        if (nextCost >= costs[nextState]) continue;
        costs[nextState] = nextCost;
        previous[nextState] = state;
        origins[nextState] = origins[state];
        queue.push({ state: nextState, cost: nextCost });
      }
    }
    if (bestState < 0) continue;
    const source = sourcePorts[origins[bestState]];
    const target = targetPorts[targetIndex];
    const points: Point[] = [target.point];
    for (let state = bestState; state >= 0; state = previous[state]) points.push(grid[state >> 1]);
    points.push(source.point);
    const simplified = simplify(points.reverse());
    routes[edge.id] = { points: simplified, sourceSide: source.side, targetSide: target.side, path: roundedPath(simplified) };
  }
  return routes;
}
