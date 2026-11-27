import assert from 'node:assert/strict';
import test from 'node:test';
import { createParticleDensityTransition } from '../../../src/features/seasonal/particles/particleDensityTransition.ts';
import { SNOW_PARTICLE_TIMING } from '../../../src/features/seasonal/snowParticleTiming.ts';

const onScreen = () => ({ visibility: 1, spawn: 'screen' });
const aboveScreen = () => ({ visibility: 1, spawn: 'above' });
const createSnowDensityTransition = (count, random) => createParticleDensityTransition(count, SNOW_PARTICLE_TIMING, random);

test('눈을 늘리면 기존 눈을 유지하고 새 눈을 화면 위에서 조금씩 보낸다', () => {
  const existing = onScreen();
  const flakes = [existing];
  const density = createSnowDensityTransition(1);
  density.setTarget(11, flakes.length, 900);
  density.step(flakes, 0, aboveScreen);
  assert.equal(flakes.length, 1);
  density.step(flakes, 0.36, aboveScreen);
  assert.ok(flakes.length > 1 && flakes.length < 11);
  density.step(flakes, 0.9, aboveScreen);
  assert.equal(flakes.length, 11);
  assert.equal(flakes[0], existing);
  assert.ok(flakes.slice(1).every((flake) => flake.spawn === 'above'));
});

test('눈을 줄이면 해당 눈만 흐려지고 투명해진 뒤 제거된다', () => {
  const flakes = Array.from({ length: 4 }, onScreen);
  const density = createSnowDensityTransition(4);
  density.setTarget(2, flakes.length, 900);
  density.step(flakes, 0.35, aboveScreen);
  assert.deepEqual(flakes.map((flake) => flake.visibility), [1, 1, 0.5, 0.5]);
  assert.equal(density.isRetiring(1), false);
  assert.equal(density.isRetiring(2), true);
  density.step(flakes, 0.35, aboveScreen);
  assert.deepEqual(flakes.map((flake) => flake.visibility), [1, 1]);
});

test('페이드 중 다시 늘리면 같은 눈송이의 밝기를 되돌린다', () => {
  const existing = onScreen();
  const flakes = [onScreen(), existing];
  const density = createSnowDensityTransition(2);
  density.setTarget(1, flakes.length, 900);
  density.step(flakes, 0.35, aboveScreen);
  density.setTarget(2, flakes.length, 900);
  density.step(flakes, 0.175, aboveScreen);
  assert.equal(flakes[1], existing);
  assert.equal(existing.visibility, 0.75);
  density.step(flakes, 0.175, aboveScreen);
  assert.equal(existing.visibility, 1);
});

test('눈을 완전히 끄면 기존 눈이 흐려지는 동안만 그린 뒤 멈춘다', () => {
  const flakes = [onScreen(), onScreen()];
  const density = createSnowDensityTransition(flakes.length);
  density.setTarget(0, flakes.length, 900);
  density.step(flakes, 0.35, aboveScreen);
  assert.equal(density.hasWork(flakes.length), true);
  assert.equal(density.isRetiring(0), true);
  assert.deepEqual(flakes.map((flake) => flake.visibility), [0.5, 0.5]);
  density.step(flakes, 0.35, aboveScreen);
  assert.deepEqual(flakes, []);
  assert.equal(density.hasWork(flakes.length), false);
});

test('꺼진 상태에서 켜면 첫 한 송이를 곧 내리고 나머지는 여러 초에 흩어 보낸다', () => {
  const flakes = [];
  let alternate = false;
  const density = createSnowDensityTransition(0, () => (alternate = !alternate) ? 0.1 : 0.9);
  assert.equal(density.hasWork(0), false);
  density.setTarget(36, 0, 900);
  assert.equal(density.hasWork(0), true);
  density.step(flakes, 0, aboveScreen);
  assert.equal(flakes.length, 0);
  density.step(flakes, 0.15, aboveScreen);
  assert.equal(flakes.length, 1);
  density.step(flakes, 0.8, aboveScreen);
  assert.ok(flakes.length > 1 && flakes.length < 6);
  density.step(flakes, 4, aboveScreen);
  assert.ok(flakes.length > 10 && flakes.length < 20);
  density.step(flakes, 8, aboveScreen);
  assert.equal(flakes.length, 36);
  assert.ok(flakes.every((flake) => flake.spawn === 'above'));
});

test('키가 작은 화면과 적은 눈송이 수에서도 처음에 한 묶음으로 내리지 않는다', () => {
  const flakes = [];
  const density = createSnowDensityTransition(0, () => 0.5);
  density.setTarget(4, 0, 300);
  density.step(flakes, 0.7, aboveScreen);
  assert.equal(flakes.length, 1);
  density.step(flakes, 3, aboveScreen);
  assert.equal(flakes.length, 4);
});

test('다른 효과는 시작 간격과 페이드 시간을 눈과 별개로 설정할 수 있다', () => {
  const particles = [];
  const density = createParticleDensityTransition(0, {
    startupRampSeconds: () => 2,
    increaseSeconds: 0.4,
    fadeOutSeconds: 0.2,
  }, () => 0.5);
  density.setTarget(8, 0, 900);
  density.step(particles, 2, aboveScreen);
  assert.equal(particles.length, 8);
  density.setTarget(0, particles.length, 900);
  density.step(particles, 0.2, aboveScreen);
  assert.equal(density.hasWork(particles.length), false);
});
