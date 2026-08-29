const SEARCH_STOP_WORDS = new Set([
  'webmcp',
  'webmcp로',
  '소개',
  '페이지',
  '페이지의',
  '무엇을',
  '설명',
  '설명하고',
  '지원하는지',
  '관련',
  '관한',
  '기록',
  '기록에서',
  '기록을',
  '내용',
  '대한',
  '로그',
  '검색',
  '검색해줘',
  '검색해서',
  '검색해주세요',
  '목록',
  '목록으로',
  '보여줘',
  '보여주세요',
  '뭐였지',
  '어떤',
  '어디였지',
  '있던',
  '있는',
  '찾아줘',
  '찾아주세요',
]);

const SEARCH_SYNONYMS = new Map([
  ['글쓰기', ['편집']],
]);

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/[^\p{L}\p{N}#]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
}

function searchTokens(query) {
  const allTokens = normalizeText(query).split(' ').filter(Boolean);
  const meaningfulTokens = allTokens.filter((token) => !SEARCH_STOP_WORDS.has(token));
  return meaningfulTokens.length > 0 ? meaningfulTokens : allTokens;
}

function tokenVariants(token) {
  const variants = [token, ...(SEARCH_SYNONYMS.get(token) ?? [])];
  if (token.length >= 4) variants.push(token.slice(0, -1));
  if (token.length >= 5) variants.push(token.slice(0, -2));
  return [...new Set(variants.filter((candidate) => candidate.length >= 2))];
}

function includesToken(text, token) {
  return tokenVariants(token).some((variant) => text.includes(variant));
}

function matchingTokens(text, tokens) {
  return tokens.filter((token) => includesToken(text, token));
}

function snippetAroundMatch(text, tokens, maximumLength = 220) {
  const compact = String(text ?? '').replace(/\s+/gu, ' ').trim();
  if (compact.length <= maximumLength) return compact;

  const normalized = normalizeText(compact);
  let matchIndex = -1;
  for (const token of tokens) {
    for (const variant of tokenVariants(token)) {
      const index = normalized.indexOf(variant);
      if (index >= 0 && (matchIndex < 0 || index < matchIndex)) matchIndex = index;
    }
  }

  const start = Math.max(0, matchIndex < 0 ? 0 : matchIndex - 70);
  const end = Math.min(compact.length, start + maximumLength);
  return `${start > 0 ? '…' : ''}${compact.slice(start, end).trim()}${end < compact.length ? '…' : ''}`;
}

function assertLogIndex(index) {
  if (!index || index.version !== 1 || !Array.isArray(index.posts)) {
    throw new TypeError('지원하지 않는 로그 검색 인덱스 형식입니다.');
  }
  return index;
}

function findPost(index, slug) {
  const normalizedSlug = String(slug ?? '').trim();
  const post = assertLogIndex(index).posts.find((candidate) => candidate.slug === normalizedSlug);
  if (!post) throw new RangeError(`로그를 찾을 수 없습니다: ${normalizedSlug || '(빈 slug)'}`);
  return post;
}

function postRoute(slug, sectionId) {
  return `/about-me/log/${encodeURIComponent(slug)}${sectionId ? `#${sectionId}` : ''}`;
}

function scoreSection(section, tokens, normalizedQuery) {
  const sectionSearchText = normalizeText(`${section.title} ${section.text}`);
  const titleMatches = matchingTokens(normalizeText(section.title), tokens).length;
  const bodyMatches = matchingTokens(sectionSearchText, tokens).length;
  const exactBonus = normalizedQuery && sectionSearchText.includes(normalizedQuery) ? 18 : 0;
  return titleMatches * 8 + bodyMatches * 3 + exactBonus;
}

function postSearchText(post) {
  return normalizeText([
    post.title,
    post.summary,
    ...post.tags,
    ...post.sections.flatMap((section) => [section.title, section.text]),
  ].join(' '));
}

export function searchPortfolioLogs(index, input = {}) {
  const query = String(input.query ?? '').trim();
  const requestedTags = Array.isArray(input.tags)
    ? input.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : [];
  if (query.length > 200) throw new RangeError('query는 200자 이하여야 합니다.');
  if (requestedTags.length > 5) throw new RangeError('tags는 최대 5개까지 사용할 수 있습니다.');
  if (requestedTags.some((tag) => tag.length > 40)) {
    throw new RangeError('각 tag는 40자 이하여야 합니다.');
  }
  if (!query && requestedTags.length === 0) {
    throw new TypeError('query 또는 tags 중 하나는 입력해야 합니다.');
  }

  const limit = boundedInteger(input.limit, 5, 1, 10);
  const normalizedQuery = normalizeText(query);
  const tokens = searchTokens(query);
  const matches = assertLogIndex(index).posts
    .filter((post) => requestedTags.every((tag) => post.tags.includes(tag)))
    .map((post) => {
      const titleText = normalizeText(post.title);
      const summaryText = normalizeText(post.summary);
      const tagText = normalizeText(post.tags.join(' '));
      const searchableText = postSearchText(post);
      const matchedTokens = matchingTokens(searchableText, tokens);
      const matchingSections = post.sections
        .map((section) => ({ section, score: scoreSection(section, tokens, normalizedQuery) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(({ section }) => ({
          id: section.id,
          title: section.title,
          excerpt: snippetAroundMatch(section.text, tokens),
          route: postRoute(post.slug, section.id),
        }));
      const sectionMatchCount = matchingSections.length;

      if (tokens.length > 0 && matchingSections.length === 0 && post.sections[0]) {
        const section = post.sections[0];
        matchingSections.push({
          id: section.id,
          title: section.title,
          excerpt: snippetAroundMatch(section.text, tokens),
          route: postRoute(post.slug, section.id),
        });
      }

      const score = matchingTokens(titleText, tokens).length * 14
        + matchingTokens(tagText, tokens).length * 10
        + matchingTokens(summaryText, tokens).length * 7
        + matchedTokens.length * 2
        + sectionMatchCount * 3
        + (normalizedQuery && titleText.includes(normalizedQuery) ? 30 : 0)
        + (normalizedQuery && searchableText.includes(normalizedQuery) ? 12 : 0);

      return {
        post,
        score: query ? score : requestedTags.length * 10,
        matchedTokens,
        matchingSections,
      };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.post.title.localeCompare(b.post.title, 'ko-KR'));

  return {
    query,
    tags: requestedTags,
    total: matches.length,
    matches: matches.slice(0, limit).map(({ post, matchedTokens, matchingSections }) => ({
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      tags: post.tags,
      matchedTokens,
      route: postRoute(post.slug),
      matchingSections,
    })),
  };
}

function explicitTagFromQuery(index, query, requestedTags) {
  if (requestedTags.length === 1) return requestedTags[0];
  if (requestedTags.length > 1) return null;

  const queryTokens = new Set(
    normalizeText(query)
      .split(' ')
      .map((token) => token.replace(/^#/u, ''))
      .filter(Boolean),
  );
  const tags = [...new Set(assertLogIndex(index).posts.flatMap((post) => post.tags))];
  return tags.find((tag) => queryTokens.has(normalizeText(tag).replace(/^#/u, ''))) ?? null;
}

/**
 * 검색 결과와 기록 목록 UI에 표시할 최소 상태를 함께 만든다.
 * matchedSlugs를 별도로 전달하므로 자연어 요청 전체를 검색창에 다시 넣어도
 * 조사나 명령 표현 때문에 결과가 사라지지 않는다.
 */
export function createPortfolioLogListView(index, input = {}) {
  const result = searchPortfolioLogs(index, {
    ...input,
    limit: input.limit ?? 10,
  });
  const selectedTag = explicitTagFromQuery(index, result.query, result.tags);
  const maximumMatchedTokens = Math.max(
    0,
    ...result.matches.map(({ matchedTokens }) => matchedTokens.length),
  );
  const focusedMatches = maximumMatchedTokens > 1
    ? result.matches.filter(({ matchedTokens }) => matchedTokens.length === maximumMatchedTokens)
    : result.matches;
  const matchedTokens = [...new Set(focusedMatches.flatMap((match) => match.matchedTokens))]
    .filter((token) => !SEARCH_STOP_WORDS.has(token))
    .filter((token) => normalizeText(token) !== normalizeText(selectedTag ?? ''));

  return {
    ...result,
    view: {
      route: '/about-me/log#log-entries-heading',
      query: matchedTokens.join(' ') || (selectedTag ? '' : result.query),
      tag: selectedTag,
      matchedSlugs: focusedMatches.map(({ slug }) => slug),
    },
  };
}

export function getPortfolioLogOutline(index, slug) {
  const post = findPost(index, slug);
  return {
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    tags: post.tags,
    route: postRoute(post.slug),
    sections: post.sections.map((section) => ({
      id: section.id,
      title: section.title,
      level: section.level,
      route: postRoute(post.slug, section.id),
    })),
  };
}

export function resolvePortfolioLogTarget(index, slug, sectionId) {
  const post = findPost(index, slug);
  const normalizedSectionId = String(sectionId ?? '').trim();
  const section = normalizedSectionId
    ? post.sections.find((candidate) => candidate.id === normalizedSectionId)
    : null;
  if (normalizedSectionId && !section) {
    throw new RangeError(`로그 ${post.slug}에서 소제목을 찾을 수 없습니다: ${normalizedSectionId}`);
  }
  return {
    slug: post.slug,
    title: post.title,
    route: postRoute(post.slug, section?.id),
    section: section ? { id: section.id, title: section.title } : null,
  };
}

export function findRelatedPortfolioLogs(index, slug, input = {}) {
  const source = findPost(index, slug);
  const limit = boundedInteger(input.limit, 5, 1, 10);
  const sourceTokens = searchTokens(`${source.title} ${source.summary}`);

  const matches = assertLogIndex(index).posts
    .filter((post) => post.slug !== source.slug)
    .map((post) => {
      const commonTags = source.tags.filter((tag) => post.tags.includes(tag));
      const commonKeywords = matchingTokens(postSearchText(post), sourceTokens);
      return {
        post,
        commonTags,
        commonKeywords,
        score: commonTags.length * 12 + commonKeywords.length * 2,
      };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.post.title.localeCompare(b.post.title, 'ko-KR'))
    .slice(0, limit);

  return {
    source: { slug: source.slug, title: source.title },
    matches: matches.map(({ post, commonTags, commonKeywords }) => ({
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      tags: post.tags,
      commonTags,
      commonKeywords,
      route: postRoute(post.slug),
    })),
  };
}
