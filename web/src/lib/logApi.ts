export type LogSummary = {
  slug: string;
  title: string;
  date?: string;
  order?: number;
  recommendedOrder?: number;
  tags: string[];
  summary: string;
};

export type LogPost = LogSummary & {
  content: string;
};

export type LogSectionSummary = {
  id: string;
  title: string;
  level: number;
  route: string;
};

export type LogListResponse = {
  posts: LogSummary[];
  total: number;
  availableTags: string[];
};

export type LogDetailResponse = {
  post: LogPost;
  relatedPosts: LogSummary[];
};

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

export type LogSearchResponse = {
  query: string;
  tags: string[];
  total: number;
  matches: LogSearchMatch[];
};

export type LogOutlineResponse = LogSummary & {
  route: string;
  sections: LogSectionSummary[];
};

export type LogTargetResponse = {
  slug: string;
  title: string;
  route: string;
  section: { id: string; title: string } | null;
};

export type RelatedLogsResponse = {
  source: { slug: string; title: string };
  matches: Array<LogSummary & {
    commonTags: string[];
    commonKeywords: string[];
    route: string;
  }>;
};

export class LogApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LogApiError";
  }
}

function apiUrl(path: string): URL {
  const baseUrl = process.env.NEXT_PUBLIC_RAG_API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new LogApiError("기록 서버 주소가 설정되지 않았습니다.");
  }
  return new URL(`${baseUrl.replace(/\/+$/u, "")}${path}`);
}

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

export function portfolioLogHref(slug: string, sectionId?: string): string {
  const query = new URLSearchParams({ slug });
  return `/about-me/log/view/?${query.toString()}${sectionId ? `#${sectionId}` : ""}`;
}

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

export function getPortfolioLog(slug: string, signal?: AbortSignal): Promise<LogDetailResponse> {
  return requestJson(apiUrl(`/api/logs/${encodeURIComponent(slug)}`), signal);
}

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

export function getPortfolioLogOutline(
  slug: string,
  signal?: AbortSignal,
): Promise<LogOutlineResponse> {
  return requestJson(apiUrl(`/api/logs/${encodeURIComponent(slug)}/outline`), signal);
}

export function resolvePortfolioLogTarget(
  slug: string,
  sectionId?: string,
  signal?: AbortSignal,
): Promise<LogTargetResponse> {
  const url = apiUrl(`/api/logs/${encodeURIComponent(slug)}/resolve`);
  if (sectionId) url.searchParams.set("sectionId", sectionId);
  return requestJson(url, signal);
}

export function findRelatedPortfolioLogs(
  slug: string,
  limit?: unknown,
  signal?: AbortSignal,
): Promise<RelatedLogsResponse> {
  const url = apiUrl(`/api/logs/${encodeURIComponent(slug)}/related`);
  if (limit !== undefined) url.searchParams.set("limit", String(limit));
  return requestJson(url, signal);
}
