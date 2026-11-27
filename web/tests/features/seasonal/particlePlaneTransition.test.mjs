import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceParticleFrontShare, changeParticlePlane, splitParticleAlpha } from '../../../src/features/seasonal/particles/particlePlaneTransition.ts';

test('뒤로 숨기기를 켜도 이미 뒤에 내리는 눈의 밝기는 바뀌지 않는다', () => {
  const flakes = [{ plane: 'back', frontShare: 0 }, { plane: 'front', frontShare: 0 }];
  assert.equal(changeParticlePlane(true, flakes), 'back');
  assert.deepEqual(flakes, [{ plane: 'back', frontShare: 0 }, { plane: 'back', frontShare: 1 }]);
  flakes[1].frontShare = 0.4;
  changeParticlePlane(true, flakes);
  assert.equal(flakes[1].frontShare, 0.4);
});

test('앞에서 뒤로 옮길 때는 앞쪽에서만 사라지고, 가림 없는 곳은 같은 밝기를 유지한다', () => {
  const opacity = 0.7;
  const start = splitParticleAlpha(opacity, 1);
  const mid = splitParticleAlpha(opacity, advanceParticleFrontShare(1, 0.175));
  const end = splitParticleAlpha(opacity, advanceParticleFrontShare(1, 0.35));
  assert.deepEqual(start, { front: opacity, back: 0 });
  assert.ok(mid.front < start.front && mid.front > end.front);
  assert.equal(mid.front + (1 - mid.front) * mid.back, opacity);
  assert.deepEqual(end, { front: 0, back: opacity });
});

test('뒤로 숨기기를 끄면 기존 눈은 그 상태에 남고 다음 눈만 앞에서 시작한다', () => {
  const flakes = [{ plane: 'back', frontShare: 0 }, { plane: 'back', frontShare: 0.4 }];
  assert.equal(changeParticlePlane(false, flakes), 'front');
  assert.deepEqual(flakes, [{ plane: 'back', frontShare: 0 }, { plane: 'back', frontShare: 0.4 }]);
});
