import assert from 'node:assert/strict';
import test from 'node:test';
import { createLogListView } from './logViewContract.mjs';

function match(slug, matchedTokens, tags = ['AI']) {
  return {
    slug,
    title: slug,
    tags,
    summary: '',
    matchedTokens,
    route: `/about-me/log/view/?slug=${slug}`,
    matchingSections: [],
  };
}

test('명시한 단일 태그를 목록 상태에 보존한다', () => {
  const result = createLogListView({
    query: '',
    tags: ['AI'],
    total: 1,
    matches: [match('one', [], ['AI'])],
  });
  assert.equal(result.view.tag, 'AI');
  assert.equal(result.view.query, '');
  assert.deepEqual(result.view.matchedSlugs, ['one']);
});

test('가장 많은 핵심 토큰이 일치한 후보만 화면에 집중한다', () => {
  const result = createLogListView({
    query: 'AI 설계',
    tags: [],
    total: 2,
    matches: [
      match('focused', ['ai', '설계']),
      match('broad', ['ai']),
    ],
  });
  assert.deepEqual(result.view.matchedSlugs, ['focused']);
  assert.equal(result.view.query, '설계');
});
