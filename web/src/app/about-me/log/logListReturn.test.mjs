import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { rememberLogListReturn, readLogListReturn, captureLogDetailReturn, logListReturnHref,
  requestLogListReturn, takeLogListReturn, findLogListReturnTarget, restoreLogListTarget } from './logListReturn.ts';

function browser(url = 'https://example.test/ssw-portfolio-public/about-me/log/?q=AI&tag=설계&view=recommended') {
  const location = new URL(url);
  const calls = [];
  const history = {
    state: { __NA: true, tree: { preserved: true } },
    replaceState(state, unused, nextUrl) { this.state = state; calls.push(nextUrl); },
  };
  return { location, history, calls };
}

function navigate(view, path) {
  view.location = new URL(path, view.location);
  view.history.state = { __NA: true, tree: { preserved: true } };
}

function openFromList(view, slug = 'chosen-post') {
  rememberLogListReturn(view, slug);
  const entry = readLogListReturn(view);
  navigate(view, `/ssw-portfolio-public/about-me/log/view/?slug=${slug}`);
  assert.deepEqual(captureLogDetailReturn(view, slug), entry);
  return entry;
}

test('상세에 출발 목록을 전달하고 새로고침이나 effect 재실행에도 보존한다', () => {
  const view = browser();
  const entry = openFromList(view);
  assert.deepEqual(captureLogDetailReturn(view, 'chosen-post'), entry);
  const reloaded = browser(view.location.href);
  reloaded.history.state = structuredClone(view.history.state);
  assert.deepEqual(captureLogDetailReturn(reloaded, 'chosen-post'), entry);
  assert.equal(reloaded.history.state.__NA, true);
  assert.deepEqual(reloaded.history.state.tree, { preserved: true });
});

test('목록 버튼은 검색 조건과 원래 카드로 복귀하며 basePath를 중복하지 않는다', () => {
  const view = browser();
  const entry = openFromList(view);
  assert.equal(logListReturnHref(entry), '/about-me/log/?q=AI&tag=%EC%84%A4%EA%B3%84&view=recommended');
  requestLogListReturn(view, entry);
  navigate(view, entry.url);
  assert.deepEqual(takeLogListReturn(view), entry);
  assert.deepEqual(readLogListReturn(view), entry);
  assert.deepEqual(takeLogListReturn(view), entry);
  assert.equal(view.history.state.__NA, true);
});

test('관련 글을 연속으로 읽은 뒤에도 최초 목록과 최초 선택 기록으로 복귀한다', () => {
  const view = browser();
  const original = openFromList(view);
  for (const slug of ['second-post', 'third-post']) {
    const before = structuredClone(view.history.state);
    rememberLogListReturn(view, slug);
    assert.deepEqual(view.history.state, before);
    navigate(view, `/ssw-portfolio-public/about-me/log/view/?slug=${slug}`);
    assert.deepEqual(captureLogDetailReturn(view, slug), original);
  }
  requestLogListReturn(view, captureLogDetailReturn(view, 'third-post'));
  navigate(view, original.url);
  assert.deepEqual(takeLogListReturn(view), original);
});

test('관계도 선택 상태도 목록 버튼 경로에 그대로 전달한다', () => {
  const view = browser('https://example.test/ssw-portfolio-public/about-me/log/?layout=map&mapMode=tags&mapTag=tag:ai&mapPost=one');
  const entry = openFromList(view, 'one');
  assert.equal(logListReturnHref(entry), '/about-me/log/?layout=map&mapMode=tags&mapTag=tag:ai&mapPost=one');
  requestLogListReturn(view, entry);
  navigate(view, entry.url);
  assert.deepEqual(takeLogListReturn(view), entry);
});

test('직접 연 상세는 일반 목록으로 이동하며 다른 글의 저장 상태를 사용하지 않는다', () => {
  const view = browser('https://example.test/about-me/log/view/?slug=direct');
  assert.equal(captureLogDetailReturn(view, 'direct'), null);
  assert.equal(logListReturnHref(null), '/about-me/log');
  view.history.state.portfolioLogDetailReturn = { slug: 'different', entry: { url: '/about-me/log/', slug: 'one' } };
  assert.equal(captureLogDetailReturn(view, 'direct'), null);
  requestLogListReturn(view, null);
  navigate(view, '/about-me/log/');
  assert.equal(takeLogListReturn(view), null);
});

test('목록 복귀 전달값은 다른 URL이나 별도 창으로 새지 않고 한 번만 소비한다', () => {
  const view = browser();
  const entry = openFromList(view);
  requestLogListReturn(view, entry);
  const otherWindow = browser(`https://example.test${entry.url}`);
  assert.equal(takeLogListReturn(otherWindow), null);
  navigate(view, '/about-me/log/?q=different');
  assert.equal(takeLogListReturn(view), null);
  navigate(view, entry.url);
  assert.equal(takeLogListReturn(view), null);
});

test('잘못되거나 외부로 향하는 복귀 주소는 기본 목록으로 제한한다', () => {
  for (const url of ['https://evil.test/about-me/log/', '//evil.test/about-me/log/',
    'javascript:alert(1)', '/about-me/log/view/?slug=one', '/x/../about-me/log/', 'about-me/log/']) {
    const view = browser();
    const entry = { url, slug: 'one' };
    assert.equal(logListReturnHref(entry), '/about-me/log');
    requestLogListReturn(view, entry);
    assert.equal(takeLogListReturn(view), null);
  }
});

test('오류 화면과 상하단 목록 링크 모두 같은 복귀 처리를 사용한다', async () => {
  const detail = await readFile(new URL('./view/LogDetailClient.tsx', import.meta.url), 'utf8');
  const link = await readFile(new URL('./LogListLink.tsx', import.meta.url), 'utf8');
  const hook = await readFile(new URL('./useLogListReturn.ts', import.meta.url), 'utf8');
  assert.equal((detail.match(/<LogListLink returnTo=\{returnTo\}/g) ?? []).length, 4);
  assert.doesNotMatch(detail, /href=["']\/about-me\/log["']/);
  assert.match(detail, /captureLogDetailReturn\(window, slug\)/);
  assert.match(link, /href=\{logListReturnHref\(returnTo\)\}/);
  assert.match(link, /onNavigate=\{\(\) => requestLogListReturn\(window, returnTo\)\}/);
  assert.match(hook, /pending\.current = takeLogListReturn\(window\)/);
  assert.doesNotMatch(link, /history\.back|router\.back|onClick=/);
});

test('출발한 방문 기록에 slug를 저장하고 Next 상태·검색·태그·추천 순서 URL을 보존한다', () => {
  const view = browser();
  rememberLogListReturn(view, 'chosen-post');
  assert.deepEqual(readLogListReturn(view), {
    slug: 'chosen-post', url: '/ssw-portfolio-public/about-me/log/?q=AI&tag=%EC%84%A4%EA%B3%84&view=recommended',
  });
  assert.equal(view.history.state.__NA, true);
  assert.deepEqual(view.history.state.tree, { preserved: true });
  assert.equal(view.calls.length, 1);
  assert.equal(view.calls[0], `${view.location.pathname}${view.location.search}`);
});

test('상세의 관련 글과 다른 페이지는 목록 복귀 대상을 덮어쓰지 않는다', () => {
  for (const path of ['/about-me/log/view/?slug=one', '/about-me/log-extra/', '/about-me/']) {
    const view = browser(`https://example.test${path}`);
    rememberLogListReturn(view, 'two');
    assert.deepEqual(view.calls, []);
    assert.equal(readLogListReturn(view), null);
  }
});

test('관계도와 선택 태그·기록, 기존 hash도 변경하지 않고 저장한다', () => {
  const view = browser('https://example.test/about-me/log/?layout=map&mapMode=tags&mapTag=tag:ai&mapPost=one#existing');
  rememberLogListReturn(view, 'one');
  assert.equal(readLogListReturn(view).url, `${view.location.pathname}${view.location.search}#existing`);
});

test('다른 검색 조건의 방문 기록이나 잘못된 상태는 복원하지 않는다', () => {
  const view = browser();
  rememberLogListReturn(view, 'one');
  view.location.search = '?q=changed';
  assert.equal(readLogListReturn(view), null);
  for (const marker of [null, 'one', {}, { url: '/about-me/log/', slug: 1 }, { url: '/about-me/log/', slug: '' }]) {
    view.history.state = { portfolioLogListReturn: marker };
    assert.equal(readLogListReturn(view), null);
  }
});

test('별개의 방문 기록은 각자 선택한 기록을 유지한다', () => {
  const first = browser();
  const second = browser();
  rememberLogListReturn(first, 'first');
  rememberLogListReturn(second, 'second');
  assert.equal(readLogListReturn(first).slug, 'first');
  assert.equal(readLogListReturn(second).slug, 'second');
});

test('방문 기록 저장이 제한된 환경에서도 글 열기를 막지 않는다', () => {
  const view = browser();
  view.history.replaceState = () => { throw new Error('blocked'); };
  assert.doesNotThrow(() => rememberLogListReturn(view, 'one'));
  assert.equal(readLogListReturn(view), null);
});

test('목록은 카드 ID로, 관계도는 선택한 기록의 설명 패널로 복귀한다', () => {
  const card = {};
  const panel = { dataset: { logReturnSlug: 'one' } };
  const root = {
    ownerDocument: { getElementById: (id) => id === 'log-card-one' ? card : null },
    querySelectorAll: () => [panel],
    contains: (node) => node === card || node === panel,
  };
  assert.equal(findLogListReturnTarget(root, 'one', 'list', true), card);
  assert.equal(findLogListReturnTarget(root, 'one', 'map', true), panel);
  assert.equal(findLogListReturnTarget(root, 'gone', 'list', false), root);
  assert.equal(findLogListReturnTarget(root, 'loading', 'map', true), null);
});

test('카드 현재 좌표까지 부드럽게 이동하며 초점은 애니메이션을 가로채지 않는다', () => {
  const calls = [];
  let frame;
  const view = { scrollY: 600, scrollTo: (options) => calls.push(['scroll', options]),
    innerHeight: 900, document: { documentElement: { dataset: {}, scrollHeight: 4000 } },
    matchMedia: () => ({ matches: false }), requestAnimationFrame(callback) { frame = callback; return 1; } };
  const target = { isConnected: true, getBoundingClientRect: () => ({ top: 500 }), focus: (options) => calls.push(['focus', options]) };
  restoreLogListTarget(view, target);
  assert.deepEqual(calls, [['focus', { preventScroll: true }]]);
  frame(0);
  frame(225);
  frame(450);
  assert.deepEqual(calls.slice(1).map((call) => call[1].top), [600, 1016.5, 1076]);
});

test('사이트 애니메이션 설정과 기기의 동작 줄이기 설정을 존중한다', () => {
  for (const [motion, osReduced, animated] of [
    ['off', false, false], [undefined, true, false], ['on', true, true],
  ]) {
    const calls = [];
    let scheduled = false;
    const view = { scrollY: 0, scrollTo: (options) => calls.push(options),
      innerHeight: 900, document: { documentElement: { dataset: { motion }, scrollHeight: 4000 } },
      matchMedia: () => ({ matches: osReduced }), requestAnimationFrame() { scheduled = true; return 1; } };
    restoreLogListTarget(view, { getBoundingClientRect: () => ({ top: 300 }), focus() {} });
    assert.equal(scheduled, animated);
    if (!animated) assert.equal(calls[0].behavior, 'instant');
  }
});

test('복귀 애니메이션은 취소·화면 이탈 시 멈추고 페이지 끝을 넘어가지 않는다', () => {
  const positions = [];
  let frame;
  let cancelled = false;
  const view = { scrollY: 0, innerHeight: 900,
    document: { documentElement: { dataset: {}, scrollHeight: 1000 } },
    matchMedia: () => ({ matches: false }), scrollTo: ({ top }) => positions.push(top),
    requestAnimationFrame(callback) { frame = callback; return 1; }, cancelAnimationFrame() { cancelled = true; } };
  const target = { isConnected: true, getBoundingClientRect: () => ({ top: 800 }), focus() {} };
  const stop = restoreLogListTarget(view, target);
  frame(0);
  frame(450);
  assert.deepEqual(positions, [0, 100]);
  stop();
  frame(600);
  assert.equal(cancelled, true);
  assert.equal(positions.length, 2);
  restoreLogListTarget(view, target);
  target.isConnected = false;
  frame(1000);
  assert.equal(positions.length, 2);
});

test('데이터·애니메이션 완료 후 복원하며 사용자 조작과 화면 이탈은 대기를 취소한다', async () => {
  const entries = await readFile(new URL('./LogEntries.tsx', import.meta.url), 'utf8');
  const hook = await readFile(new URL('./useLogListReturn.ts', import.meta.url), 'utf8');
  assert.match(entries, /useLogListReturn\(isLocationStateReady && !isLoading && !loadError && !isViewModeFading/);
  assert.match(entries, /displayMode === "map" \|\| listSettled/);
  assert.match(entries, /renderedPosts\.every/);
  assert.match(entries, /animatingSlugs\.size === 0/);
  for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
    assert.ok(hook.includes(`addEventListener('${event}'`));
    assert.ok(hook.includes(`removeEventListener('${event}'`));
  }
  assert.match(hook, /await Promise\.allSettled/);
  assert.match(hook, /observer\.disconnect\(\)/);
  assert.match(hook, /return stop/);
  assert.doesNotMatch(hook, /scrollRestoration|history\.back|location\.hash\s*=/);
});
