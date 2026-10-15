import assert from 'node:assert/strict';
import test from 'node:test';
import { readMapNavigation, writeMapNavigation, nextMapSelection, readViewportEntries, rememberViewport } from './logMapState.ts';

const posts = [{ slug: 'one' }, { slug: 'two' }];
const groups = [{ id: 'tag:개발', posts: [posts[0]] }];

test('새 모바일 방문은 태그로 시작하고 명시적인 공유 주소는 화면 크기보다 우선한다', () => {
  assert.equal(readMapNavigation(new URLSearchParams(), true, posts, groups).mode, 'tags');
  assert.equal(readMapNavigation(new URLSearchParams(), false, posts, groups).mode, 'all');
  assert.equal(readMapNavigation(new URLSearchParams('mapMode=all'), true, posts, groups).mode, 'all');
});

test('탐색 주소는 전역 필터와 hash를 보존하고 선택 태그와 기록을 복원한다', () => {
  const url = new URL('https://example.test/base/about-me/log/?layout=map&q=설계&tag=개발&view=recommended#log-entries');
  const state = { mode: 'tags', groupId: 'tag:개발', selectedSlug: 'one' };
  const next = writeMapNavigation(url, state);
  assert.deepEqual(readMapNavigation(next.searchParams, false, posts, groups), state);
  for (const key of ['layout', 'q', 'tag', 'view']) assert.equal(next.searchParams.get(key), url.searchParams.get(key));
  assert.equal(next.pathname, url.pathname);
  assert.equal(next.hash, '#log-entries');
  assert.equal(url.searchParams.has('mapPost'), false);
  const cleared = writeMapNavigation(next, { mode: 'all', groupId: '', selectedSlug: null });
  assert.equal(cleared.searchParams.has('mapPost'), false);
  assert.equal(cleared.searchParams.has('mapTag'), false);
});

test('삭제되거나 필터 밖인 태그·기록과 태그에 속하지 않은 기록은 선택하지 않는다', () => {
  const params = new URLSearchParams('mapMode=tags&mapTag=tag:개발&mapPost=two');
  assert.equal(readMapNavigation(params, false, posts, groups).selectedSlug, null);
  params.set('mapTag', 'missing');
  assert.deepEqual(readMapNavigation(params, false, posts, groups), { mode: 'tags', groupId: '', selectedSlug: null });
  params.set('mapMode', 'all');
  assert.equal(readMapNavigation(params, false, [], []).selectedSlug, null);
});

test('상단 태그를 고르면 저장된 다른 태그보다 해당 태그의 기록을 바로 연다', () => {
  const tagGroups = [...groups, { id: 'tag:건강', posts: [posts[1]] }];
  const params = new URLSearchParams('mapMode=tags&mapTag=tag:개발&mapPost=one');
  assert.deepEqual(readMapNavigation(params, false, posts, tagGroups, '건강'), {
    mode: 'tags', groupId: 'tag:건강', selectedSlug: null,
  });
  params.delete('mapTag');
  assert.equal(readMapNavigation(params, true, posts, tagGroups, '건강').groupId, 'tag:건강');
  params.set('mapMode', 'all');
  assert.equal(readMapNavigation(params, false, posts, tagGroups, '건강').mode, 'all');
});

test('상단 태그는 대소문자와 공백을 정규화하고 복원된 기록이 해당 태그에 있으면 유지한다', () => {
  const params = new URLSearchParams('mapMode=tags&mapPost=one');
  const tagGroups = [{ id: 'tag:ai', posts: [posts[0]] }];
  assert.deepEqual(readMapNavigation(params, false, posts, tagGroups, ' AI '), {
    mode: 'tags', groupId: 'tag:ai', selectedSlug: 'one',
  });
  assert.equal(readMapNavigation(params, false, posts, [], 'AI').groupId, '');
});

test('Escape 해제와 동일 배치의 이전 선택 해제·새 선택을 구분한다', () => {
  assert.equal(nextMapSelection('one', [{ type: 'select', id: 'one', selected: false }]), null);
  assert.equal(nextMapSelection('one', [
    { type: 'select', id: 'two', selected: true }, { type: 'select', id: 'one', selected: false },
  ]), 'two');
  assert.equal(nextMapSelection('one', [{ type: 'dimensions', id: 'one' }]), 'one');
  assert.equal(nextMapSelection('two', [{ type: 'select', id: 'one', selected: false }]), 'two');
});

test('뷰포트 저장은 잘못된 저장값에서 복구하고 최신 장면 12개만 보관한다', () => {
  const viewport = { x: -14.5, y: 71, zoom: 0.8 };
  let raw = rememberViewport('broken JSON', 'all', viewport);
  assert.deepEqual(readViewportEntries(raw), [{ key: 'all', viewport }]);
  raw = rememberViewport(raw, 'all', { x: 10, y: 20, zoom: 1.2 });
  assert.equal(readViewportEntries(raw).length, 1);
  for (let index = 0; index < 20; index++) raw = rememberViewport(raw, `scene-${index}`, viewport);
  assert.equal(readViewportEntries(raw).length, 12);
  assert.equal(readViewportEntries(raw)[0].key, 'scene-8');
  assert.deepEqual(readViewportEntries('{"key":"all"}'), []);
  assert.deepEqual(readViewportEntries(JSON.stringify([{ key: 'all', viewport: { x: 0, y: 0, zoom: 100 } }])), []);
});
