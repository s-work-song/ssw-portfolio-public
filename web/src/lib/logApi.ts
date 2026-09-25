/**
 * 기록(로그) 백엔드와 주고받는 타입과 조회 함수를 모아 둔 모듈이다.
 *
 * 기록 원문은 이 저장소에 없고 비공개 백엔드에 있어, 화면은 이 모듈을 통해서만
 * 내용을 가져온다. 모든 함수는 브라우저에서 부르는 것을 전제로 하며, 조회만 하고
 * 쓰기는 없다. 실패는 예외 하나(LogApiError)로 모아 화면이 사유를 그대로
 * 보여 줄 수 있게 했다.
 */

/** 목록에 그려지는 기록 한 건의 요약이다. */
export type LogSummary = {
  slug: string;
  title: string;
  date?: string;
  order?: number;
  recommendedOrder?: number;
  tags: string[];
  summary: string;
};

/** 본문까지 담은 기록 한 건이다. */
export type LogPost = LogSummary & {
  content: string;
};

/** 기록 본문의 소제목 하나다. level은 제목 깊이이고 route는 그 소제목으로 바로 가는 경로다. */
export type LogSectionSummary = {
  id: string;
  title: string;
  level: number;
  route: string;
};

/** 목록 조회 응답이다. availableTags는 태그 필터 UI가 그대로 쓴다. */
export type LogListResponse = {
  posts: LogSummary[];
  total: number;
  availableTags: string[];
};

/** 상세 조회 응답이다. 본문과 함께 이어 읽을 만한 글을 딸려 보낸다. */
export type LogDetailResponse = {
  post: LogPost;
  relatedPosts: LogSummary[];
};

/** 검색에 걸린 기록 한 건이다. matchedTokens는 실제로 맞은 낱말이라 결과를 좁히는 근거가 된다. */
export type LogSearchMatch = LogSummary & {
  matchedTokens: string[];
  route: string;
  matchingSections: Array<{
    id: string;
    title: string;
    excerpt: string;
    route: string;
  }>;
};

/** 검색 응답이다. query·tags에는 서버가 해석한 조건이 그대로 담겨 돌아온다. */
export type LogSearchResponse = {
  query: string;
  tags: string[];
  total: number;
  matches: LogSearchMatch[];
};

/** 기록 하나의 목차 응답이다. 요약에 소제목 목록을 더한 형태다. */
export type LogOutlineResponse = LogSummary & {
  route: string;
  sections: LogSectionSummary[];
};

/** slug·소제목을 실제 이동 경로로 푼 결과다. section이 null이면 글 첫머리를 가리킨다. */
export type LogTargetResponse = {
  slug: string;
  title: string;
  route: string;
  section: { id: string; title: string } | null;
};

/** 관련 기록 응답이다. 어떤 태그와 낱말이 겹쳐서 골랐는지를 함께 돌려준다. */
export type RelatedLogsResponse = {
  source: { slug: string; title: string };
  matches: Array<LogSummary & {
    commonTags: string[];
    commonKeywords: string[];
    route: string;
  }>;
};

/**
 * 기록 조회가 실패했음을 알리는 예외다.
 *
 * message에는 화면에 그대로 띄울 수 있는 한국어 문구만 담는다. 호출부가 상태
 * 코드나 네트워크 오류를 저마다 해석하지 않게 하려는 의도다. 요청 취소
 * (AbortError)는 실패가 아니므로 이 타입으로 감싸지 않는다.
 */
export class LogApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LogApiError";
  }
}

/**
 * 백엔드 주소와 경로를 합쳐 요청할 URL을 만든다.
 *
 * 주소는 빌드 시점에 박히는 환경 변수라, 값이 없다는 것은 이 배포에 기록 기능이
 * 없다는 뜻이다. 그 경우 요청을 보내지 않고 곧바로 LogApiError를 던진다.
 * 주소 끝 슬래시는 떼어 내 경로와 이어 붙일 때 //가 생기지 않게 한다.
 */
function apiUrl(path: string): URL {
  const baseUrl = process.env.NEXT_PUBLIC_RAG_API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new LogApiError("기록 서버 주소가 설정되지 않았습니다.");
  }
  return new URL(`${baseUrl.replace(/\/+$/u, "")}${path}`);
}

/**
 * GET 요청을 보내고 JSON 본문을 돌려준다. 모든 조회 함수가 거치는 단일 통로다.
 *
 * 요청 취소는 실패가 아니라 정상적인 흐름이라, AbortError만 원래 예외 그대로
 * 다시 던져 호출부가 화면에 오류를 띄우지 않고 조용히 넘어갈 수 있게 한다.
 * 나머지 네트워크 오류는 사유가 제각각이므로 한 문장으로 뭉쳐 LogApiError로 바꾼다.
 *
 * 본문 파싱은 실패해도 예외로 만들지 않고 null로 둔다. 오류 응답이 JSON이
 * 아닐 수 있어서인데, 그 덕에 상태 코드만이라도 문구에 담을 수 있다. 서버가
 * message를 내려 줬으면 그쪽을 우선한다.
 *
 * 응답 형태는 검증하지 않고 T로 단언한다. 계약이 어긋나면 사용하는 쪽에서
 * 드러난다. cache는 no-store라 목록이 갱신돼도 옛 응답이 남지 않는다.
 */
async function requestJson<T>(url: URL, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new LogApiError("기록 서버에 연결하지 못했습니다.");
  }
  const payload = await response.json().catch(() => null) as {
    message?: unknown;
  } | null;
  if (!response.ok) {
    throw new LogApiError(
      typeof payload?.message === "string"
        ? payload.message
        : `기록 요청을 처리하지 못했습니다. (${response.status})`,
    );
  }
  return payload as T;
}

/**
 * 기록 상세 화면으로 가는 내부 링크를 만든다.
 *
 * 정적 배포라 글마다 페이지가 있는 것이 아니라 하나의 뷰어 페이지가 slug를
 * 질의 문자열로 받는다. 경로 끝에 슬래시를 두는 것도 정적 내보내기 규칙에
 * 맞추기 위해서다. slug는 URLSearchParams가 인코딩하지만 sectionId는 그대로
 * 붙으므로, 특수문자가 섞인 id를 넘길 때는 호출부가 처리해야 한다.
 */
export function portfolioLogHref(slug: string, sectionId?: string): string {
  const query = new URLSearchParams({ slug });
  return `/about-me/log/view/?${query.toString()}${sectionId ? `#${sectionId}` : ""}`;
}

/**
 * 기록 목록을 가져온다. 검색어·태그·보기 방식으로 좁힐 수 있다.
 *
 * 빈 값은 아예 질의에 싣지 않아 "조건 없음"과 "빈 문자열로 거르기"가 섞이지
 * 않게 한다. view는 `recommended`일 때만 실어 보내고 기본값은 서버에 맡긴다.
 * signal을 주면 입력 도중 앞선 요청을 취소할 수 있다.
 */
export function listPortfolioLogs(
  input: { query?: string; tag?: string | null; view?: "all" | "recommended" } = {},
  signal?: AbortSignal,
): Promise<LogListResponse> {
  const url = apiUrl("/api/logs");
  if (input.query) url.searchParams.set("q", input.query);
  if (input.tag) url.searchParams.set("tag", input.tag);
  if (input.view === "recommended") url.searchParams.set("view", "recommended");
  return requestJson(url, signal);
}

/** 기록 한 건의 본문과 관련 글을 가져온다. slug는 경로에 들어가므로 인코딩해서 보낸다. */
export function getPortfolioLog(slug: string, signal?: AbortSignal): Promise<LogDetailResponse> {
  return requestJson(apiUrl(`/api/logs/${encodeURIComponent(slug)}`), signal);
}

/**
 * 기록을 검색한다. 입력을 unknown으로 받는 이유는 호출부가 도구 실행 결과이기 때문이다.
 *
 * WebMCP 클라이언트나 서버 모델이 넘긴 값은 타입을 보장할 수 없어, 여기서
 * 문자열로 강제하고 공백만 남는 값은 조건에서 뺀다. tags는 배열일 때만 받아
 * 항목마다 append하므로 태그 여러 개로 좁힐 수 있고, 배열이 아니면 조용히 무시한다.
 * limit은 값이 있기만 하면 문자열로 바꿔 그대로 넘기고 범위 판단은 서버에 맡긴다.
 */
export function searchPortfolioLogs(
  input: { query?: unknown; tags?: unknown; limit?: unknown },
  signal?: AbortSignal,
): Promise<LogSearchResponse> {
  const url = apiUrl("/api/logs/search");
  const query = String(input.query ?? "").trim();
  if (query) url.searchParams.set("q", query);
  if (Array.isArray(input.tags)) {
    input.tags.forEach((tag) => {
      const normalized = String(tag).trim();
      if (normalized) url.searchParams.append("tag", normalized);
    });
  }
  if (input.limit !== undefined) url.searchParams.set("limit", String(input.limit));
  return requestJson(url, signal);
}

/** 기록 하나의 소제목 목록을 가져온다. 본문 전체를 받지 않고 어디로 보낼지 정할 때 쓴다. */
export function getPortfolioLogOutline(
  slug: string,
  signal?: AbortSignal,
): Promise<LogOutlineResponse> {
  return requestJson(apiUrl(`/api/logs/${encodeURIComponent(slug)}/outline`), signal);
}

/**
 * slug와 소제목 id를 실제 이동 경로로 푼다.
 *
 * 경로 규칙을 프런트가 짐작하지 않고 서버가 확인해 준 값을 쓰기 위한 조회다.
 * sectionId를 생략하면 글 첫머리를 가리키는 결과가 돌아온다.
 */
export function resolvePortfolioLogTarget(
  slug: string,
  sectionId?: string,
  signal?: AbortSignal,
): Promise<LogTargetResponse> {
  const url = apiUrl(`/api/logs/${encodeURIComponent(slug)}/resolve`);
  if (sectionId) url.searchParams.set("sectionId", sectionId);
  return requestJson(url, signal);
}

/**
 * 어떤 기록과 이어 읽을 만한 글을 찾는다.
 *
 * limit도 도구에서 넘어올 수 있어 unknown으로 받고, 값이 있을 때만 문자열로
 * 바꿔 실어 보낸다. 판단은 서버가 한다.
 */
export function findRelatedPortfolioLogs(
  slug: string,
  limit?: unknown,
  signal?: AbortSignal,
): Promise<RelatedLogsResponse> {
  const url = apiUrl(`/api/logs/${encodeURIComponent(slug)}/related`);
  if (limit !== undefined) url.searchParams.set("limit", String(limit));
  return requestJson(url, signal);
}
