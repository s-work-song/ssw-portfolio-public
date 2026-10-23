import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { requestLogReadingStart, scheduleLogReadingPosition } from './logReadingPosition.ts';

function fixture(hash = '', target = null) {
  requestLogReadingStart('');
  const frames = new Map();
  const calls = [];
  const view = {
    location: { hash },
    document: { getElementById: (id) => id === 'log-section-2' ? target : null },
    requestAnimationFrame: (callback) => { frames.set(1, callback); return 1; },
    cancelAnimationFrame: (id) => frames.delete(id),
    scrollTo: (options) => calls.push(options),
  };
  const tick = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback());
  };
  return { view, calls, tick };
}

test('일반 기록 열기는 본문 렌더 다음 프레임에 이전 스크롤을 즉시 초기화한다', () => {
  const { view, calls, tick } = fixture();
  requestLogReadingStart('current');
  scheduleLogReadingPosition(view, 'current');
  assert.deepEqual(calls, []);
  tick();
  assert.deepEqual(calls, [{ top: 0, left: 0, behavior: 'instant' }]);
});

test('소제목 바로가기는 맨 위로 보내지 않고 기존 앵커 이동과 초점을 보존한다', () => {
  const anchorCalls = [];
  const { view, calls, tick } = fixture('#log-section-2', {
    scrollIntoView: (options) => anchorCalls.push(['scroll', options]),
    focus: (options) => anchorCalls.push(['focus', options]),
  });
  scheduleLogReadingPosition(view, 'current');
  tick();
  assert.deepEqual(calls, []);
  assert.deepEqual(anchorCalls, [
    ['scroll', { behavior: 'smooth', block: 'center' }],
    ['focus', { preventScroll: true }],
  ]);
});

test('존재하지 않는 소제목 링크도 이전 글의 중간 위치에 남기지 않는다', () => {
  const { view, calls, tick } = fixture('#missing');
  requestLogReadingStart('current');
  scheduleLogReadingPosition(view, 'current');
  tick();
  assert.deepEqual(calls, [{ top: 0, left: 0, behavior: 'instant' }]);
});

test('본문 전환 또는 화면 이탈 시 예약한 스크롤을 취소한다', () => {
  const { view, calls, tick } = fixture();
  requestLogReadingStart('current');
  const cancel = scheduleLogReadingPosition(view, 'current');
  cancel();
  tick();
  assert.deepEqual(calls, []);
});

test('스크롤은 로딩 중이 아닌 현재 slug의 본문이 준비된 뒤 실행한다', async () => {
  const client = await readFile(new URL('./LogDetailClient.tsx', import.meta.url), 'utf8');
  assert.match(client, /const detail = loaded\?\.slug === slug \? loaded.detail : null/);
  assert.match(client, /if \(!detail\) return;\s+return scheduleLogReadingPosition\(window, slug\);\s+\}, \[detail, slug\]\)/);
  assert.doesNotMatch(client, /history\.scrollRestoration|window\.scrollTo/);
});

test('새 글 열기 요청이 없는 뒤로가기·앞으로가기는 복원 위치를 덮어쓰지 않는다', () => {
  const { view, calls, tick } = fixture();
  scheduleLogReadingPosition(view, 'current');
  tick();
  assert.deepEqual(calls, []);
  requestLogReadingStart('current');
  scheduleLogReadingPosition(view, 'current');
  tick();
  calls.length = 0;
  scheduleLogReadingPosition(view, 'current');
  tick();
  assert.deepEqual(calls, []);
});

test('이전 글의 늦은 렌더는 다음 글의 시작 위치 요청을 소비하지 않는다', () => {
  const { view, calls, tick } = fixture();
  requestLogReadingStart('next');
  scheduleLogReadingPosition(view, 'previous');
  tick();
  assert.deepEqual(calls, []);
  scheduleLogReadingPosition(view, 'next');
  tick();
  assert.deepEqual(calls, [{ top: 0, left: 0, behavior: 'instant' }]);
});

test('Strict Mode에서 취소 뒤 다시 예약해도 새 글 열기 요청을 보존한다', () => {
  const { view, calls, tick } = fixture();
  requestLogReadingStart('current');
  scheduleLogReadingPosition(view, 'current')();
  scheduleLogReadingPosition(view, 'current');
  tick();
  assert.deepEqual(calls, [{ top: 0, left: 0, behavior: 'instant' }]);
});

test('목록·두 관계도·관련 글·미세조정 소개는 새 탭 클릭과 구분되는 같은 읽기 링크를 사용한다', async () => {
  const link = await readFile(new URL('../LogReadingLink.tsx', import.meta.url), 'utf8');
  assert.match(link, /onNavigate=\{\(\) => \{/);
  assert.match(link, /requestLogReadingStart\(slug\)/);
  assert.match(link, /href=\{portfolioLogHref\(slug\)\}/);
  assert.doesNotMatch(link, /scrollTo|preventDefault|scroll=\{false\}/);
  for (const file of ['../LogEntries.tsx', '../LogRelationshipMap.tsx', '../LogTagMap.tsx', './LogDetailClient.tsx', '../../../../components/about/ProjectCardGrid.tsx']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /<LogReadingLink\b/, file);
    assert.doesNotMatch(source, /href=\{portfolioLogHref/, file);
  }
});
