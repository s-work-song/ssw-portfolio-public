import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  createPortfolioLogListView,
  findRelatedPortfolioLogs,
  getPortfolioLogOutline,
  resolvePortfolioLogTarget,
  searchPortfolioLogs,
} from './logTools.mjs';

const index = {
  version: 1,
  posts: [
    {
      slug: 'ambiguous-ai-support',
      title: 'AI 지원이 실제 활용으로 이어지기 위한 조건',
      summary: '애매한 지원이 부정적인 경험과 반감으로 이어질 수 있습니다.',
      tags: ['AI', '업무'],
      sections: [
        {
          id: 'log-section-1',
          title: '지원했다는 사실과 실제로 사용할 수 있다는 것은 다릅니다',
          level: 1,
          text: '낮은 사용량만 제공하면 상위 모델을 충분히 경험하기 어렵습니다.',
        },
      ],
    },
    {
      slug: 'ai-model-evaluation',
      title: '모델 등급을 구분하지 못한 AI 평가',
      summary: '모델과 요금제 조건을 확인한 범위 안에서 평가해야 합니다.',
      tags: ['AI', '가치관'],
      sections: [
        {
          id: 'log-section-1',
          title: '모델마다 맡길 수 있는 역할이 다릅니다',
          level: 1,
          text: '상위 모델과 작은 모델은 맡길 수 있는 작업이 다릅니다.',
        },
      ],
    },
  ],
};

test('자연어 단서로 제목과 본문을 검색하고 소제목 경로를 반환한다', () => {
  const result = searchPortfolioLogs(index, { query: 'AI 지원이 애매하면 반감', limit: 3 });
  assert.ok(result.total >= 1);
  assert.equal(result.matches[0].slug, 'ambiguous-ai-support');
  assert.equal(
    result.matches[0].matchingSections[0].route,
    '/about-me/log/ambiguous-ai-support#log-section-1',
  );
});

test('태그만으로도 기록을 찾을 수 있다', () => {
  const result = searchPortfolioLogs(index, { tags: ['가치관'] });
  assert.deepEqual(result.matches.map(({ slug }) => slug), ['ai-model-evaluation']);
});

test('WebMCP 자연어 요청을 기록 목록의 검색어와 태그 상태로 변환한다', () => {
  const result = createPortfolioLogListView(index, {
    query: 'WebMCP로 기록에서 AI 지원 관련 내용을 검색해서 목록으로 보여줘',
  });
  assert.equal(result.view.route, '/about-me/log#log-entries-heading');
  assert.equal(result.view.tag, 'AI');
  assert.equal(result.view.query, '지원');
  assert.deepEqual(result.view.matchedSlugs, ['ambiguous-ai-support']);
});

test('목차와 이동 대상은 같은 section id를 사용한다', () => {
  const outline = getPortfolioLogOutline(index, 'ambiguous-ai-support');
  const target = resolvePortfolioLogTarget(index, 'ambiguous-ai-support', 'log-section-1');
  assert.equal(outline.sections[0].route, target.route);
  assert.equal(target.section.title, '지원했다는 사실과 실제로 사용할 수 있다는 것은 다릅니다');
});

test('공통 태그와 키워드로 연관 기록을 찾는다', () => {
  const result = findRelatedPortfolioLogs(index, 'ambiguous-ai-support');
  assert.equal(result.matches[0].slug, 'ai-model-evaluation');
  assert.deepEqual(result.matches[0].commonTags, ['AI']);
});

test('존재하지 않는 로그나 소제목은 이동하지 않는다', () => {
  assert.throws(() => resolvePortfolioLogTarget(index, 'missing-log'), /로그를 찾을 수 없습니다/u);
  assert.throws(
    () => resolvePortfolioLogTarget(index, 'ambiguous-ai-support', 'missing-section'),
    /소제목을 찾을 수 없습니다/u,
  );
});

test('과도하게 큰 검색 입력은 실행 전에 거부한다', () => {
  assert.throws(
    () => searchPortfolioLogs(index, { query: '가'.repeat(201) }),
    /200자 이하여야 합니다/u,
  );
  assert.throws(
    () => searchPortfolioLogs(index, { tags: ['1', '2', '3', '4', '5', '6'] }),
    /최대 5개/u,
  );
});

test('실제 공개 로그 인덱스가 자연어 단서와 소제목 anchor를 연결한다', async () => {
  const rawIndex = await readFile(
    new URL('../../../public/data/log-search-index.json', import.meta.url),
    'utf8',
  );
  const realIndex = JSON.parse(rawIndex);
  assert.equal(realIndex.version, 1);
  assert.equal(realIndex.posts.length, 23);
  assert.equal(new Set(realIndex.posts.map(({ slug }) => slug)).size, 23);

  for (const post of realIndex.posts) {
    assert.ok(post.sections.length > 0, `${post.slug}에 소제목이 필요합니다.`);
    assert.deepEqual(
      post.sections.map(({ id }) => id),
      post.sections.map((_, index) => `log-section-${index + 1}`),
    );
  }

  const result = searchPortfolioLogs(realIndex, {
    query: 'AI 지원이 애매하면 반감이 생긴다는 내용',
    limit: 3,
  });
  assert.equal(result.matches[0].slug, 'ambiguous-support-leaves-negative-experiences');
  assert.match(result.matches[0].matchingSections[0].route, /#log-section-\d+$/u);
});
