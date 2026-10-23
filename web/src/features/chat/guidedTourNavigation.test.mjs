import assert from 'node:assert/strict';
import test from 'node:test';
import { GuidedTourNavigation } from './guidedTourNavigation.ts';
import { CHAT_ACTION_TARGET_ARRIVED_EVENT } from './navigation.ts';

function fixture(navigate, basePath = '') {
  const events = new EventTarget();
  const busyChanges = [];
  const requests = [];
  const timers = [];
  let path = `${basePath}/about-me/`;
  const arrive = (anchor) => events.dispatchEvent(new CustomEvent(CHAT_ACTION_TARGET_ARRIVED_EVENT, { detail: { anchor } }));
  const navigation = new GuidedTourNavigation({
    basePath,
    events,
    currentPath: () => path,
    navigateAction: (id) => { requests.push(id); navigate?.(id, arrive); },
    onBusyChange: (busy) => busyChanges.push(busy),
    scheduleTimeout: (callback) => {
      const timer = { callback, cancelled: false };
      timers.push(timer);
      return () => { timer.cancelled = true; };
    },
  });
  return { navigation, busyChanges, requests, timers, arrive, setPath: (next) => { path = next; } };
}

test('연속 다음·이전·현재 장소 입력은 도착하기 전까지 첫 이동만 받는다', () => {
  const f = fixture();
  let accepted = 0;
  assert.equal(f.navigation.run('past_work_archive', () => {
    accepted += 1;
    assert.equal(f.navigation.run('si_terminology', () => { accepted += 1; }), false);
  }), true);
  for (const id of ['si_terminology', 'overview', 'past_work_archive']) {
    assert.equal(f.navigation.run(id, () => { accepted += 1; }), false);
  }
  assert.equal(accepted, 1);
  assert.deepEqual(f.requests, ['past_work_archive']);
  f.arrive('si-terminology-notice');
  assert.equal(f.navigation.busy, true);
  f.arrive('past-work-archive');
  assert.equal(f.navigation.busy, false);
  assert.deepEqual(f.busyChanges, [true, false]);
  assert.equal(f.navigation.run('si_terminology', () => { accepted += 1; }), true);
  assert.equal(accepted, 2);
  f.navigation.cancel();
});

test('다른 탭으로 이동할 때는 목적지 경로와 앵커 도착이 함께 맞아야 풀린다', () => {
  const f = fixture();
  f.navigation.run('resume', () => {});
  f.arrive('resume-overview');
  assert.equal(f.navigation.busy, true);
  f.setPath('/about-me/resume/');
  f.arrive('portfolio-overview');
  assert.equal(f.navigation.busy, true);
  f.arrive('resume-overview');
  assert.equal(f.navigation.busy, false);
  assert.equal(f.timers[0].cancelled, true);
});

test('모션 없이 바로 도착해도 신호를 놓치지 않고 활성화한다', () => {
  const f = fixture((_id, arrive) => arrive('past-work-archive'));
  assert.equal(f.navigation.run('past_work_archive', () => {}), true);
  assert.equal(f.navigation.busy, false);
  assert.deepEqual(f.busyChanges, [true, false]);
  assert.equal(f.timers[0].cancelled, true);
});

test('GitHub Pages 하위 경로에서도 도착 직후 잠금이 풀린다', () => {
  const f = fixture(undefined, '/ssw-portfolio-public');
  f.navigation.run('past_work_archive', () => {});
  f.arrive('past-work-archive');
  assert.equal(f.navigation.busy, false);
  assert.equal(f.timers[0].cancelled, true);
  f.navigation.run('si_levels', () => {});
  f.arrive('ai-workflow-intro');
  assert.equal(f.navigation.busy, true);
  f.setPath('/ssw-portfolio-public/about-me/ai-workflow/');
  f.arrive('ai-workflow-intro');
  assert.equal(f.navigation.busy, false);
  assert.equal(f.timers[1].cancelled, true);
});

test('WebGL 분류 이동은 같은 Pages 경로와 분류 앵커의 도착 신호를 기다린다', () => {
  const f = fixture(undefined, '/ssw-portfolio-public');
  assert.equal(f.navigation.run('agent_experiments_webgl', () => {}), true);
  assert.deepEqual(f.requests, ['agent_experiments_webgl']);
  f.arrive('agent-experiments-svg');
  assert.equal(f.navigation.busy, true);
  f.arrive('agent-experiments-webgl');
  assert.equal(f.navigation.busy, false);
  assert.equal(f.timers[0].cancelled, true);
});

test('도착하지 못하거나 투어를 종료해도 재시도할 수 있고 이전 타이머는 새 잠금을 풀지 않는다', () => {
  const f = fixture();
  f.navigation.run('past_work_archive', () => {});
  const oldTimeout = f.timers[0].callback;
  oldTimeout();
  assert.equal(f.navigation.busy, false);
  f.navigation.run('si_terminology', () => {});
  oldTimeout();
  assert.equal(f.navigation.busy, true);
  f.navigation.cancel();
  assert.equal(f.navigation.busy, false);
  f.arrive('si-terminology-notice');
  assert.deepEqual(f.busyChanges, [true, false, true, false]);
});

test('이동 처리에서 예외가 나도 잠금을 정리한다', () => {
  const f = fixture(() => { throw new Error('navigation failed'); });
  assert.throws(() => f.navigation.run('past_work_archive', () => {}), /navigation failed/);
  assert.equal(f.navigation.busy, false);
  assert.equal(f.timers[0].cancelled, true);
});
