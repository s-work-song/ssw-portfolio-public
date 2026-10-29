import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compact, rerouteLoop, segmentsOf, straightenEdge } from '../../../src/components/diagrams/straightenEdges.ts';

const box = (left, top, right, bottom, inset) => ({ left, top, right, bottom, ...(inset === undefined ? {} : { inset }) });
const bends = (points) => compact(points).length - 2;
const nothingAround = { obstacles: [], segments: [] };

/** 경로의 선분이 상자 안쪽을 지나는지 본다(테스트용 단순 판정). */
function passesThrough(points, area) {
  return segmentsOf(points).some(({ from, to }) => Math.min(from.x, to.x) < area.right && Math.max(from.x, to.x) > area.left
    && Math.min(from.y, to.y) < area.bottom && Math.max(from.y, to.y) > area.top);
}

test('경유점 때문에 생긴 계단은 한 번 꺾는 경로로 편다', () => {
  const source = box(0, 0, 100, 40, 4);
  const target = box(160, 200, 260, 240, 4);
  // 오른쪽으로 나가 계단 두 번을 거쳐 내려오는 머메이드식 경로(끝은 화살표 머리 4px만큼 짧다).
  const points = [{ x: 100, y: 20 }, { x: 130, y: 20 }, { x: 130, y: 80 }, { x: 170, y: 80 }, { x: 170, y: 140 }, { x: 210, y: 140 }, { x: 210, y: 196 }];
  const result = straightenEdge({ points, boundaryEnd: { x: 210, y: 200 }, source, target }, nothingAround);
  assert.ok(result);
  assert.ok(bends(result.points) <= 1, JSON.stringify(result.points));
  // 화살표 머리가 붙을 자리만큼 대상 노드 앞에서 끝난다.
  const end = result.points.at(-1);
  assert.ok(end.y <= target.top - 3.9 || end.x <= target.left - 3.9 || end.x >= target.right + 3.9);
});

test('장애물을 지나가는 경로는 고르지 않는다', () => {
  const source = box(0, 0, 100, 40, 4);
  const target = box(0, 300, 100, 340, 4);
  const blocker = box(-20, 120, 140, 180);
  // 장애물 오른쪽으로 돌아가는 계단 경로.
  const points = [{ x: 50, y: 40 }, { x: 50, y: 80 }, { x: 160, y: 80 }, { x: 160, y: 220 }, { x: 60, y: 220 }, { x: 60, y: 260 }, { x: 50, y: 260 }, { x: 50, y: 296 }];
  const result = straightenEdge({ points, boundaryEnd: { x: 50, y: 300 }, source, target }, { obstacles: [blocker], segments: [] });
  assert.ok(result);
  assert.equal(passesThrough(result.points, blocker), false, JSON.stringify(result.points));
  assert.ok(bends(result.points) < bends(points));
});

test('라벨은 새 경로 위로 옮기고, 놓을 곳이 없으면 경로를 바꾸지 않는다', () => {
  const source = box(0, 0, 100, 40, 4);
  const target = box(160, 300, 260, 340, 4);
  const points = [{ x: 100, y: 20 }, { x: 130, y: 20 }, { x: 130, y: 150 }, { x: 210, y: 150 }, { x: 210, y: 296 }];
  const label = box(115, 140, 145, 160);
  const result = straightenEdge({ points, boundaryEnd: { x: 210, y: 300 }, source, target, label }, nothingAround);
  assert.ok(result?.label);
  const onRoute = segmentsOf(result.points).some(({ from, to }) =>
    (Math.abs(from.x - to.x) < 0.5 && Math.abs(result.label.x - from.x) < 0.5)
    || (Math.abs(from.y - to.y) < 0.5 && Math.abs(result.label.y - from.y) < 0.5));
  assert.ok(onRoute, JSON.stringify(result));
  // 세로선에는 라벨 높이만큼, 가로선에는 폭만큼 자리가 필요하다. 어느 선분에도 올라가지 않으면 원래 경로를 둔다.
  const huge = box(0, 0, 400, 400);
  assert.equal(straightenEdge({ points, boundaryEnd: { x: 210, y: 300 }, source, target, label: huge }, nothingAround), undefined);
});

test('이미 곧은 선과 직각이 아닌 선은 건드리지 않는다', () => {
  const source = box(0, 0, 100, 40, 4);
  const target = box(0, 100, 100, 140, 4);
  assert.equal(straightenEdge({ points: [{ x: 50, y: 40 }, { x: 50, y: 96 }], boundaryEnd: { x: 50, y: 100 }, source, target }, nothingAround), undefined);
  assert.equal(straightenEdge({ points: [{ x: 50, y: 40 }, { x: 70, y: 70 }, { x: 50, y: 96 }], boundaryEnd: { x: 50, y: 100 }, source, target }, nothingAround), undefined);
});

test('3단계 흐름도의 "답변" 선은 옆 상자를 피해 한 번만 꺾는다', () => {
  // 실제 렌더링에서 뽑은 좌표: 분류 결과(B) → 최종 답변(A), 왼쪽에 대기 상자(F), 오른쪽에 지침 재주입 상자들이 있다.
  const source = box(174.7, 387.4, 253.7, 416.2, 29 / 4 + 4);
  const target = box(164.3, 796, 264.1, 836.8, 4);
  const others = [box(8, 366, 144.3, 437.6), box(189.7, 486.4, 328.5, 542.6), box(203.3, 591.4, 314.9, 663), box(189.7, 711.8, 328.5, 768)];
  const points = [{ x: 203.5, y: 416.2 }, { x: 186.4, y: 416.2 }, { x: 186.4, y: 462 }, { x: 169.3, y: 462 }, { x: 169.3, y: 782 },
    { x: 176.9, y: 782 }, { x: 176.9, y: 793.6 }, { x: 184.4, y: 793.6 }];
  const label = box(155.4, 616.8, 183.3, 637.6);
  const result = straightenEdge({ points, boundaryEnd: { x: 187.6, y: 796 }, source, target, label }, { obstacles: others, segments: [] });
  assert.ok(result);
  assert.ok(bends(result.points) <= 1, JSON.stringify(result.points));
  for (const other of others) assert.equal(passesThrough(result.points, other), false);
});

test('다른 선과 엉킨 순환 화살표는 노드의 빈 변으로 옮기고, 엉키지 않으면 그대로 둔다', () => {
  // 개요도 4단계와 같은 배치: 분류 노드 오른쪽에서 "답변"·"도구" 선이 위아래로 나가고, 순환 화살표도 오른쪽에 붙어 있다.
  const node = box(251, 121, 404, 177, 56 / 4 + 4);
  const answer = [{ x: 404, y: 123 }, { x: 431, y: 123 }, { x: 431, y: 103 }, { x: 495, y: 103 }];
  const tool = [{ x: 404, y: 174 }, { x: 431, y: 174 }, { x: 431, y: 194 }, { x: 495, y: 194 }];
  const loopPoints = [{ x: 400, y: 119 }, { x: 422, y: 119 }, { x: 422, y: 99 }, { x: 444, y: 99 }, { x: 444, y: 199 }, { x: 424, y: 199 }, { x: 424, y: 180 }, { x: 404, y: 180 }];
  const label = box(440, 139, 596, 159);
  const around = { obstacles: [], segments: [...segmentsOf(answer), ...segmentsOf(tool)] };
  const result = rerouteLoop({ points: loopPoints, node, arrow: 4, label }, around);
  assert.ok(result);
  const segments = segmentsOf(result.points);
  // 새 순환 화살표는 노드 밖으로 나갔다 같은 노드로 돌아오고, 두 실선과 만나지 않는다.
  assert.equal(passesThrough(result.points.slice(1, -1), node), false);
  for (const line of [answer, tool]) assert.equal(passesThrough(line, { left: Math.min(...result.points.map((p) => p.x)), right: Math.max(...result.points.map((p) => p.x)), top: Math.min(...result.points.map((p) => p.y)), bottom: Math.max(...result.points.map((p) => p.y)) }), false);
  assert.equal(segments.length, 3);
  assert.ok(result.label);

  const lonely = rerouteLoop({ points: loopPoints, node, arrow: 4, label }, { obstacles: [], segments: [] });
  assert.equal(lonely, undefined);
});

test('챗봇 구조 실험 카드의 흐름도만 꺾임 정리를 켠다', async () => {
  const details = await readFile(new URL('../../../src/features/research/ui/ChatbotArchitectureDetails.tsx', import.meta.url), 'utf8');
  const component = await readFile(new URL('../../../src/components/diagrams/MermaidDiagram.tsx', import.meta.url), 'utf8');
  assert.equal(details.match(/\bstraightenEdges\b/gu)?.length, 2);
  assert.match(component, /straightenEdges = false/u);
  // 접힌 상태에서 다시 그려 크기를 잴 수 없으면 보이게 될 때 편다.
  assert.match(component, /new ResizeObserver/u);
});
