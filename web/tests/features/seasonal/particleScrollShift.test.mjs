import assert from 'node:assert/strict';
import test from 'node:test';
import { shiftParticleY } from '../../../src/features/seasonal/particles/particleScrollShift.ts';

test('스크롤한 만큼 입자를 반대로 옮겨 페이지에 붙어 있는 것처럼 보인다', () => {
  assert.equal(shiftParticleY(300, 100, 10, 800), 200);
  assert.equal(shiftParticleY(300, -50, 10, 800), 350);
  assert.equal(shiftParticleY(300, 0, 10, 800), 300);
});

test('화면 밖으로 밀려난 입자는 반대쪽 끝으로 돌아온다', () => {
  const radius = 10;
  const height = 800;
  const up = shiftParticleY(5, 40, radius, height);
  assert.ok(up > height && up <= height + radius * 2);
  const down = shiftParticleY(height - 5, -40, radius, height);
  assert.ok(down < 0 && down >= -radius * 2);
});

test('아직 화면 위에서 들어오지 않은 입자는 스크롤해도 시작 자리에 둔다', () => {
  assert.equal(shiftParticleY(-12.5, 100, 10, 800), -12.5);
});
