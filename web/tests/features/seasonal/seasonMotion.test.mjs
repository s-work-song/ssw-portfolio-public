import assert from 'node:assert/strict';
import test from 'node:test';
import { motionAllowed } from '../../../src/features/seasonal/seasonMotion.ts';

test('움직이는 시즌 레이어는 "항상 끔"이면 멈추고, "시스템 따름"이면 운영체제의 모션 줄이기를 따른다', () => {
  assert.equal(motionAllowed('off', false), false);
  assert.equal(motionAllowed('off', true), false);
  assert.equal(motionAllowed('system', true), false);
  assert.equal(motionAllowed('system', false), true);
});

test('"항상 켬"은 운영체제의 모션 줄이기와 관계없이 움직인다', () => {
  assert.equal(motionAllowed('on', true), true);
  assert.equal(motionAllowed('on', false), true);
});
