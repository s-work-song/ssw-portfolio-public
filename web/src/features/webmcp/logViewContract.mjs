function normalizedTag(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/^#/u, '');
}

/** 백엔드 검색 결과를 기록 목록 UI 상태로 좁히는 브라우저 전용 계약이다. */
export function createLogListView(result) {
  const queryTokens = new Set(
    String(result.query ?? '')
      .normalize('NFKC')
      .toLocaleLowerCase('ko-KR')
      .split(/\s+/u)
      .map((token) => token.replace(/^#/u, ''))
      .filter(Boolean),
  );
  const selectedTag = result.tags.length === 1
    ? result.tags[0]
    : [...new Set(result.matches.flatMap(({ tags }) => tags))]
      .find((tag) => queryTokens.has(normalizedTag(tag))) ?? null;
  const maximumMatchedTokens = Math.max(
    0,
    ...result.matches.map(({ matchedTokens }) => matchedTokens.length),
  );
  const focusedMatches = maximumMatchedTokens > 1
    ? result.matches.filter(({ matchedTokens }) => matchedTokens.length === maximumMatchedTokens)
    : result.matches;
  const matchedTokens = [...new Set(focusedMatches.flatMap(({ matchedTokens }) => matchedTokens))]
    .filter((token) => normalizedTag(token) !== normalizedTag(selectedTag));

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
