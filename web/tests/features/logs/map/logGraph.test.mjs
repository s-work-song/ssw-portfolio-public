import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLogGraph,
  buildLogTagGroups,
  describeLogConnection,
  layoutLogGraph,
  layoutTagBranches,
} from '../../../../src/features/logs/map/logGraph.ts';

const post = (slug, tags = [], title = slug, summary = '') => ({ slug, tags, title, summary });

test('태그 묶음은 기록·태그 중복을 제거하고 다중 소속과 태그 없는 글을 보존한다', () => {
  const posts = [post('a', ['AI', 'ai', ' 개발 ']), post('b', ['개발']), post('c', [' '])];
  const before = JSON.stringify(posts);
  const groups = buildLogTagGroups([...posts, posts[0]]);
  assert.deepEqual(groups.map(({ tag, posts }) => [tag, posts.map(({ slug }) => slug)]), [
    ['개발', ['a', 'b']], ['AI', ['a']], [null, ['c']],
  ]);
  assert.deepEqual(buildLogTagGroups(posts.toReversed()), groups);
  assert.equal(JSON.stringify(posts), before);
  assert.deepEqual(buildLogTagGroups([]), []);
  assert.deepEqual(buildLogTagGroups([posts[1]]).map(({ tag, posts }) => [tag, posts.length]), [['개발', 1]]);
});

test('태그 지도는 중앙과 양쪽 카드를 겹치지 않게 배치한다', () => {
  for (const count of [0, 1, 4, 10, 12, 28]) {
    const { center, branches } = layoutTagBranches(count);
    assert.equal(branches.length, count);
    const points = [center, ...branches.map(({ position }) => position)];
    assert.ok(points.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0));
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        assert.ok(Math.abs(points[i].x - points[j].x) >= 196 || Math.abs(points[i].y - points[j].y) >= 104);
      }
    }
  }
});

test('자동 연결은 각 글 상위 두 후보의 합집합이고 중복·자기 연결·외부 endpoint가 없다', () => {
  const posts = Array.from({ length: 8 }, (_, index) => post(`post-${index}`, ['공통']));
  const { edges } = buildLogGraph(posts);
  assert.equal(edges.length, 13, '동점 후보의 slug 순서에 따른 상위 2개 union');
  assert.equal(new Set(edges.map((edge) => edge.id)).size, edges.length);
  const slugs = new Set(posts.map((item) => item.slug));
  for (const edge of edges) {
    assert.notEqual(edge.source, edge.target);
    assert.ok(slugs.has(edge.source) && slugs.has(edge.target));
    assert.equal(edge.kind, 'related');
    assert.ok(Number.isFinite(edge.score));
  }
  assert.deepEqual(buildLogGraph([]), { edges: [] });
  assert.deepEqual(buildLogGraph([post('alone')]), { edges: [] });
});

test('희소한 공통 태그를 우선하며 단어 하나만 겹치는 기록은 연결하지 않는다', () => {
  const posts = [post('a', ['전체', '희소']), post('b', ['전체', '희소']),
    post('c', ['전체']), post('d', ['전체']), post('e', ['전체'])];
  const { edges } = buildLogGraph(posts);
  const rare = edges.find((edge) => edge.source === 'a' && edge.target === 'b');
  const common = edges.find((edge) => edge.source === 'a' && edge.target === 'c');
  assert.ok(rare.score > common.score);
  assert.deepEqual(rare.commonTags, ['전체', '희소']);
  assert.equal(buildLogGraph([post('a', [], '테스트 첫째'), post('b', [], '테스트 둘째')]).edges.length, 0);
  const keyword = buildLogGraph([post('a', [], '설계 패턴'), post('b', [], '설계 패턴 실험')]).edges[0];
  assert.match(keyword.reason, /공통 단어/);
});

test('요약 상투어만 겹치는 서로 다른 주제의 기록은 연결하지 않는다', () => {
  const posts = [
    post(
      'why-object-oriented-design-matters-more-in-the-ai-era',
      ['AI', '설계', '개발'],
      'AI 시대에 객체지향 설계가 더 중요해진 이유',
      '책임과 계약이 불분명한 코드가 탐색 비용을 키우는 이유를 정리합니다.',
    ),
    post(
      'health-as-the-most-important-long-term-asset',
      ['건강', '가치관', '업무'],
      '건강을 가장 중요한 장기 자산으로 보는 이유',
      '건강을 기반 자산으로 보고 개인적인 기준이 필요한 이유를 정리합니다.',
    ),
  ];

  assert.deepEqual(buildLogGraph(posts), { edges: [] });
  assert.equal(
    buildLogGraph([
      post('design-a', [], '설계 패턴을 선택하는 기준'),
      post('design-b', [], '설계 패턴을 적용하는 방법'),
    ]).edges.length,
    1,
    '의미 있는 기술 단어 두 개가 겹치는 연결은 유지한다',
  );
});

test('경험과 기록 종결어만 겹치는 서로 다른 주제의 기록은 연결하지 않는다', () => {
  const posts = [
    post(
      'tool-adoption-retrospective',
      ['AI'],
      '도구 도입 회고',
      '새 환경에서 시행착오를 겪은 경험을 기록합니다.',
    ),
    post(
      'long-term-recovery-process',
      ['건강'],
      '장기 회복 과정',
      '일정을 조절하며 회복한 경험을 기록합니다.',
    ),
  ];

  assert.deepEqual(buildLogGraph(posts), { edges: [] });
});

test('네 공개 본문 참조는 양쪽 기록이 있을 때만 보존하고 자동 관계와 중복되면 참조로 승격한다', () => {
  const pairs = [
    ['consider-human-hallucination-before-ai-hallucination', 'do-not-call-restful-and-rpc-the-same'],
    ['good-tools-do-not-automatically-improve-collaboration', 'rules-need-both-compliance-and-enforceable-structure'],
    ['why-object-oriented-design-and-patterns-should-be-understood-together', 'why-i-started-software-development'],
    ['why-object-oriented-design-matters-more-in-the-ai-era', 'why-i-started-software-development'],
  ];
  const posts = [...new Set(pairs.flat())].map((slug) => post(slug, ['공통']));
  const { edges } = buildLogGraph(posts);
  assert.equal(edges.filter((edge) => edge.kind === 'reference').length, 4);
  for (const [source, target] of pairs) {
    const matches = edges.filter((edge) => [edge.source, edge.target].includes(source) && [edge.source, edge.target].includes(target));
    assert.equal(matches.length, 1);
    assert.equal(matches[0].source, source);
    assert.equal(matches[0].kind, 'reference');
  }
  assert.equal(buildLogGraph([posts[0]]).edges.length, 0);
});

test('직접 참조 설명은 선택한 기록을 기준으로 방향을 구분한다', () => {
  const edge = {
    id: '["source","target"]',
    source: 'source',
    target: 'target',
    kind: 'reference',
    commonTags: [],
    reason: '공개 본문에서 직접 참조한 기록',
    score: 0,
  };
  assert.equal(describeLogConnection(edge, 'source'), '이 글에서 참조한 기록');
  assert.equal(describeLogConnection(edge, 'target'), '이 글을 참조하는 기록');
  assert.equal(describeLogConnection(edge, 'unrelated'), edge.reason);

  const related = { ...edge, kind: 'related', reason: '공통 태그: 설계' };
  assert.equal(describeLogConnection(related, 'source'), related.reason);
});

test('입력 순서·태그 순서·중복 slug가 결과를 흔들거나 원본을 바꾸지 않는다', () => {
  const posts = [post('z', ['설계', 'AI']), post('b', ['AI']), post('a', ['설계', 'AI']), post('c', [])];
  const before = JSON.stringify(posts);
  const first = buildLogGraph(posts);
  const reverse = posts.toReversed().map((item) => ({ ...item, tags: item.tags.toReversed() }));
  assert.deepEqual(buildLogGraph(reverse), first);
  assert.deepEqual(buildLogGraph([...posts, posts[0]]), first);
  const positions = layoutLogGraph(posts, first.edges);
  assert.deepEqual(layoutLogGraph(reverse, first.edges.toReversed()), positions);
  assert.equal(JSON.stringify(posts), before);
});

test('28개 군집·고립 카드 배치는 유한한 좌표이며 196×104 사각형이 겹치지 않는다', () => {
  const posts = Array.from({ length: 28 }, (_, index) => post(`post-${String(index).padStart(2, '0')}`, index < 20 ? ['설계'] : []));
  for (const edges of [buildLogGraph(posts).edges, []]) {
    const positions = layoutLogGraph(posts, edges);
    assert.equal(Object.keys(positions).length, posts.length);
    const points = Object.values(positions);
    assert.ok(points.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y) && x >= 32 && y >= 32));
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        assert.ok(Math.abs(points[i].x - points[j].x) >= 196 || Math.abs(points[i].y - points[j].y) >= 104,
          `카드 ${i}와 ${j}가 겹치지 않아야 한다`);
      }
    }
    assert.ok(Math.max(...points.map(({ x }) => x)) + 196 < 1300, '28개 전체를 볼 수 있는 제한된 가로 폭');
    assert.ok(Math.max(...points.map(({ y }) => y)) + 104 < 1000, '끝없이 늘어나는 세로 배치 방지');
  }
  assert.deepEqual(layoutLogGraph([], []), {});
  assert.deepEqual(layoutLogGraph([post('one')], [{ id: 'invalid', source: 'one', target: 'missing' }]), { one: { x: 32, y: 32 } });
});
