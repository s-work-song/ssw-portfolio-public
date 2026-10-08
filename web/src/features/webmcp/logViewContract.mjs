/**
 * 검색 결과를 기록 목록 화면이 그대로 쓸 수 있는 상태로 좁히는 계약 모듈이다.
 *
 * 순수 함수만 두고 브라우저 API를 쓰지 않아, 화면 코드와 도구 실행 경로가
 * 같은 규칙으로 결과를 해석하도록 한다. 타입 선언은 옆의 .d.mts가 맡는다.
 */

/**
 * 태그를 비교 가능한 형태로 맞춘다.
 *
 * 전각·반각 차이를 NFKC로 통일하고 한국어 규칙으로 소문자화한 뒤 앞의 #을 뗀다.
 * null·undefined도 빈 문자열로 받아 주므로 태그가 없을 때 따로 확인하지 않아도 된다.
 */
function normalizedTag(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/^#/u, '');
}

/**
 * 백엔드 검색 결과를 기록 목록 UI 상태로 좁히는 브라우저 전용 계약이다.
 *
 * 원본 결과를 그대로 두고 view 하나를 덧붙여 돌려준다. 도구 호출자는 원본을,
 * 화면은 view를 본다.
 *
 * 세 가지를 판단한다. 첫째, 태그 필터로 볼 값이 있는지 — 요청에 태그가 하나만
 * 있으면 그것을 쓰고, 없으면 검색어에 섞여 들어온 낱말 중 실제 태그와 겹치는
 * 것을 찾아 태그로 승격한다. 둘째, 어떤 항목을 강조할지 — 가장 많은 낱말이
 * 걸린 항목이 둘 이상의 낱말을 맞혔다면 그 항목들만 남겨 결과를 좁히고,
 * 아니면 전부 남긴다. 한 낱말만 걸린 결과까지 좁히면 남는 게 거의 없기 때문이다.
 * 셋째, 검색창에 되돌려 넣을 문구 — 실제로 걸린 낱말을 쓰되 태그로 승격된
 * 낱말은 빼서 같은 조건이 태그와 검색어에 겹쳐 보이지 않게 한다.
 *
 * 걸린 낱말이 하나도 없고 태그만 있으면 검색어를 비워 태그 필터만 남기고,
 * 태그도 없으면 사용자가 입력한 원래 검색어를 그대로 돌려준다.
 */
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
  // 결과가 비어 있으면 Math.max의 초기값 0이 그대로 남아 좁히기 단계를 건너뛴다.
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
