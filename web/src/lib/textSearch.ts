/**
 * 브라우저와 빌드 단계에서 동일한 규칙으로 검색 문자열을 비교한다.
 * NFKC 정규화로 전각 문자 등의 표현 차이를 줄이고, 대소문자와 연속 공백은 무시한다.
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * 여러 검색어는 순서와 인접 여부에 상관없이 모두 포함되어야 한다.
 * 예: "AI 책임"은 본문 어딘가에 AI와 책임이 각각 있는 기록을 찾는다.
 */
export function getSearchTokens(query: string): string[] {
  return normalizeSearchText(query).split(" ").filter(Boolean);
}
