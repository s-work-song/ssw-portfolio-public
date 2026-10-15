import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { $ZodError } from 'zod/v4/core';
import {
  getPortfolioLog, getPortfolioLogOutline, findRelatedPortfolioLogs,
  listPortfolioLogs, LogApiError, portfolioLogHref,
  resolvePortfolioLogTarget, searchPortfolioLogs,
} from './logApi.ts';
import {
  logDetailResponseSchema, logListResponseSchema, logSummarySchema,
} from './logResponseSchemas.ts';

const originalBase = process.env.NEXT_PUBLIC_RAG_API_BASE_URL;
before(() => { process.env.NEXT_PUBLIC_RAG_API_BASE_URL = 'https://logs.example.test/'; });
after(() => {
  if (originalBase === undefined) delete process.env.NEXT_PUBLIC_RAG_API_BASE_URL;
  else process.env.NEXT_PUBLIC_RAG_API_BASE_URL = originalBase;
});

const summary = () => ({ slug: 'test-log', title: '기록', tags: ['개발'], summary: '요약' });
const list = () => ({ posts: [summary()], total: 1, availableTags: ['개발'] });
const detail = () => ({ post: { ...summary(), content: '# 본문\n\n내용' }, relatedPosts: [] });
const jsonResponse = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status, headers: { 'Content-Type': 'application/json' },
});

test('스키마: 선택 날짜·정렬값을 생략하고 빈 목록·태그·본문을 허용한다', () => {
  assert.deepEqual(logListResponseSchema.parse({ posts: [], total: 0, availableTags: [] }), {
    posts: [], total: 0, availableTags: [],
  });
  const empty = { post: { ...summary(), tags: [], summary: '', content: '' }, relatedPosts: [] };
  assert.deepEqual(logDetailResponseSchema.parse(empty), empty);
});

test('스키마: 문자열을 자르거나 강제 변환하지 않고 기존 숫자 정렬값을 보존한다', () => {
  const input = { ...summary(), title: '  원문  ', date: '2026-09', order: -1.5, recommendedOrder: 2.25 };
  assert.deepEqual(logSummarySchema.parse(input), input);
  assert.equal(logListResponseSchema.parse({ ...list(), total: 100 }).total, 100);
});

test('스키마: 서버 추가 필드와 연관 글 메타데이터는 거부하지 않고 결과에서 제외한다', () => {
  const input = {
    ...detail(), serverVersion: 2,
    post: { ...detail().post, futureField: true },
    relatedPosts: [{ ...summary(), commonTags: ['개발'], commonKeywords: [], route: '/future' }],
  };
  assert.deepEqual(logDetailResponseSchema.parse(input), {
    post: detail().post, relatedPosts: [summary()],
  });
  const original = list();
  const parsed = logListResponseSchema.parse({ ...original, paging: { next: null } });
  assert.deepEqual(parsed, list());
  assert.notEqual(parsed.posts, original.posts);
});

const invalidListCases = [
  ['posts 누락', (v) => { delete v.posts; }],
  ['posts null', (v) => { v.posts = null; }],
  ['posts 객체', (v) => { v.posts = {}; }],
  ['slug 누락', (v) => { delete v.posts[0].slug; }],
  ['title 숫자', (v) => { v.posts[0].title = 42; }],
  ['tags null', (v) => { v.posts[0].tags = null; }],
  ['tags 문자열', (v) => { v.posts[0].tags = '개발'; }],
  ['tags 혼합 배열', (v) => { v.posts[0].tags = ['개발', 7]; }],
  ['summary 누락', (v) => { delete v.posts[0].summary; }],
  ['date 숫자', (v) => { v.posts[0].date = 2026; }],
  ['order 문자열', (v) => { v.posts[0].order = '1'; }],
  ['recommendedOrder null', (v) => { v.posts[0].recommendedOrder = null; }],
  ['total 누락', (v) => { delete v.total; }],
  ['total 문자열', (v) => { v.total = '1'; }],
  ['total 음수', (v) => { v.total = -1; }],
  ['total 소수', (v) => { v.total = 0.5; }],
  ['total 무한대', (v) => { v.total = Infinity; }],
  ['availableTags 누락', (v) => { delete v.availableTags; }],
  ['availableTags 혼합 배열', (v) => { v.availableTags = ['개발', false]; }],
];
for (const [label, invalidate] of invalidListCases) {
  test(`스키마: 목록 형식 오류를 거부한다 — ${label}`, () => {
    const input = list();
    invalidate(input);
    assert.equal(logListResponseSchema.safeParse(input).success, false);
  });
}

const invalidDetailCases = [
  ['post null', (v) => { v.post = null; }],
  ['content 누락', (v) => { delete v.post.content; }],
  ['content 객체', (v) => { v.post.content = { text: '본문' }; }],
  ['relatedPosts 누락', (v) => { delete v.relatedPosts; }],
  ['relatedPosts 객체', (v) => { v.relatedPosts = {}; }],
  ['연관 글 tags 누락', (v) => { const item = summary(); delete item.tags; v.relatedPosts = [item]; }],
];
for (const [label, invalidate] of invalidDetailCases) {
  test(`스키마: 상세 형식 오류를 거부한다 — ${label}`, () => {
    const input = detail();
    invalidate(input);
    assert.equal(logDetailResponseSchema.safeParse(input).success, false);
  });
}

test('API: 목록 쿼리·GET·no-store·signal을 유지하고 요청 한 번으로 검증 결과를 반환한다', async (t) => {
  const controller = new AbortController();
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.origin, 'https://logs.example.test');
    assert.equal(url.pathname, '/api/logs');
    assert.equal(url.searchParams.get('q'), '검색어');
    assert.equal(url.searchParams.get('tag'), '개발');
    assert.equal(url.searchParams.get('view'), 'recommended');
    assert.equal(options.method, 'GET');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.signal, controller.signal);
    return jsonResponse({ ...list(), futureField: '허용' });
  });
  assert.deepEqual(await listPortfolioLogs({ query: '검색어', tag: '개발', view: 'recommended' }, controller.signal), list());
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('API: 상세 slug 인코딩과 응답 본문을 유지한다', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url.pathname, '/api/logs/%ED%95%9C%EA%B8%80%2F%EA%B8%B0%EB%A1%9D');
    return jsonResponse(detail());
  });
  assert.deepEqual(await getPortfolioLog('한글/기록'), detail());
});

test('API: 목록 형식 오류는 고정 안내로 바꾸고 Zod 필드 진단은 cause에만 보관한다', async (t) => {
  const payload = list();
  payload.posts[0].tags = null;
  payload.message = 'SERVER_PAYLOAD_MUST_NOT_APPEAR';
  t.mock.method(globalThis, 'fetch', async () => jsonResponse(payload));
  await assert.rejects(listPortfolioLogs(), (error) => {
    assert.ok(error instanceof LogApiError);
    assert.equal(error.message, '기록 서버 응답 형식이 올바르지 않습니다.');
    assert.doesNotMatch(error.message, /SERVER_PAYLOAD|posts|tags/);
    assert.ok(error.cause instanceof $ZodError);
    assert.ok(error.cause.issues.some((issue) => issue.path.join('.') === 'posts.0.tags'));
    return true;
  });
});

test('API: 상세 형식 오류도 화면에 넘기기 전에 LogApiError로 거부한다', async (t) => {
  const payload = detail();
  delete payload.post.content;
  t.mock.method(globalThis, 'fetch', async () => jsonResponse(payload));
  await assert.rejects(getPortfolioLog('test-log'), (error) => {
    assert.ok(error instanceof LogApiError);
    assert.ok(error.cause.issues.some((issue) => issue.path.join('.') === 'post.content'));
    return true;
  });
});

for (const [label, payload] of [['null', null], ['배열', []], ['문자열', 'not-an-object'], ['숫자', 42]]) {
  test(`API: HTTP 200의 ${label} 응답을 형식 오류로 처리한다`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => jsonResponse(payload));
    await assert.rejects(listPortfolioLogs(), LogApiError);
  });
}

test('API: HTTP 200의 JSON 파싱 실패와 빈 204 응답을 형식 오류로 처리한다', async (t) => {
  const responses = [new Response('<html>not JSON</html>'), new Response(null, { status: 204 })];
  t.mock.method(globalThis, 'fetch', async () => responses.shift());
  for (let index = 0; index < 2; index += 1) {
    await assert.rejects(listPortfolioLogs(), { name: 'LogApiError', message: '기록 서버 응답 형식이 올바르지 않습니다.' });
  }
});

test('API: HTTP 오류의 서버 안내와 JSON이 아닌 오류의 상태 코드 안내를 유지한다', async (t) => {
  const responses = [
    jsonResponse({ message: '기록을 찾을 수 없습니다.' }, 404),
    new Response('<html>upstream error</html>', { status: 502 }),
    jsonResponse({ message: 7 }, 503),
  ];
  t.mock.method(globalThis, 'fetch', async () => responses.shift());
  await assert.rejects(getPortfolioLog('missing'), { name: 'LogApiError', message: '기록을 찾을 수 없습니다.' });
  await assert.rejects(listPortfolioLogs(), { name: 'LogApiError', message: '기록 요청을 처리하지 못했습니다. (502)' });
  await assert.rejects(listPortfolioLogs(), { name: 'LogApiError', message: '기록 요청을 처리하지 못했습니다. (503)' });
});

test('API: 네트워크 실패는 기존 연결 오류 안내로 처리한다', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('internal network detail'); });
  await assert.rejects(listPortfolioLogs(), { name: 'LogApiError', message: '기록 서버에 연결하지 못했습니다.' });
});

test('API: fetch와 JSON 본문 읽기의 AbortError는 오류 UI용 예외로 감싸지 않는다', async (t) => {
  const abort = new DOMException('aborted', 'AbortError');
  let bodyPhase = false;
  t.mock.method(globalThis, 'fetch', async () => {
    if (!bodyPhase) throw abort;
    return { ok: true, json: async () => { throw abort; } };
  });
  await assert.rejects(listPortfolioLogs(), (error) => error === abort);
  bodyPhase = true;
  await assert.rejects(getPortfolioLog('test-log'), (error) => error === abort);
});

test('API: 서버 주소 누락은 요청하지 않고 기존 설정 오류로 처리한다', (t) => {
  const current = process.env.NEXT_PUBLIC_RAG_API_BASE_URL;
  delete process.env.NEXT_PUBLIC_RAG_API_BASE_URL;
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => jsonResponse(list()));
  try {
    assert.throws(() => listPortfolioLogs(), { name: 'LogApiError', message: '기록 서버 주소가 설정되지 않았습니다.' });
    assert.equal(fetchMock.mock.callCount(), 0);
  } finally { process.env.NEXT_PUBLIC_RAG_API_BASE_URL = current; }
});

test('API: 이번 범위 밖 검색·목차·이동·연관 조회와 링크 계약을 유지한다', async (t) => {
  const payload = { unchangedContract: true };
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url) => { requests.push(url); return jsonResponse(payload); });
  assert.deepEqual(await searchPortfolioLogs({ query: ' 검색 ', tags: ['개발', 'AI'], limit: 3 }), payload);
  assert.deepEqual(await getPortfolioLogOutline('test-log'), payload);
  assert.deepEqual(await resolvePortfolioLogTarget('test-log', 'log-section-1'), payload);
  assert.deepEqual(await findRelatedPortfolioLogs('test-log', 2), payload);
  assert.equal(requests[0].searchParams.get('q'), '검색');
  assert.deepEqual(requests[0].searchParams.getAll('tag'), ['개발', 'AI']);
  assert.equal(requests[0].searchParams.get('limit'), '3');
  assert.equal(requests[1].pathname, '/api/logs/test-log/outline');
  assert.equal(requests[2].searchParams.get('sectionId'), 'log-section-1');
  assert.equal(requests[3].searchParams.get('limit'), '2');
  assert.equal(portfolioLogHref('한글/기록', 'log-section-1'), '/about-me/log/view/?slug=%ED%95%9C%EA%B8%80%2F%EA%B8%B0%EB%A1%9D#log-section-1');
});

test('Zod 직접 의존성·lockfile 버전·공개 MIT 고지를 함께 고정한다', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
  const lock = JSON.parse(await readFile(new URL('../../../package-lock.json', import.meta.url), 'utf8'));
  assert.equal(manifest.dependencies.zod, '4.6.5');
  assert.equal(lock.packages.web.dependencies.zod, '4.6.5');
  assert.equal(lock.packages['node_modules/zod'].version, '4.6.5');
  const schemas = await readFile(new URL('./logResponseSchemas.ts', import.meta.url), 'utf8');
  assert.match(schemas, /from "zod\/mini"/);
  assert.doesNotMatch(schemas, /from "zod"/);
  const notice = await readFile(new URL('../../public/licenses/zod-LICENSE.txt', import.meta.url), 'utf8');
  assert.match(notice, /MIT License/);
  assert.match(notice, /Copyright/);
});
