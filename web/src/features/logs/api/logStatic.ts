/**
 * 빌드할 때 공개 기록 API에서 목록과 본문을 받아 정적 HTML을 만드는 진입점이다.
 *
 * 기록 원문은 이 저장소에 두지 않으므로 빌드 시점에 API로 받아 배포 산출물에만 넣는다.
 * API에 닿지 못해도 빌드는 실패시키지 않는다. 그때는 예전처럼 브라우저가 API로 그린다.
 * 브라우저용 조회는 no-store라 정적 생성 중에 쓸 수 없어 여기서 따로 요청한다.
 */
import type { ZodMiniType } from "zod/mini";
import { LEGACY_LOG_SLUGS } from "../navigation/legacyLogSlugs.ts";
import { logDetailResponseSchema, logListResponseSchema } from "./logResponseSchemas.ts";
import type { LogDetailResponse, LogListResponse } from "./logResponseSchemas.ts";

const ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

async function fetchLog<T>(path: string, schema: ZodMiniType<T>): Promise<T | null> {
  const baseUrl = process.env.NEXT_PUBLIC_RAG_API_BASE_URL?.trim();
  if (!baseUrl) return null;
  let failure: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const response = await fetch(`${baseUrl.replace(/\/+$/u, "")}${path}`, { cache: "force-cache" });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return schema.parse(await response.json());
    } catch (error) {
      failure = error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }
  console.warn(`기록을 빌드에 넣지 못했습니다(${path}):`, failure instanceof Error ? failure.message : failure);
  return null;
}

let listRequest: Promise<LogListResponse | null> | undefined;
const detailRequests = new Map<string, Promise<LogDetailResponse | null>>();

export function loadStaticLogList(): Promise<LogListResponse | null> {
  listRequest ??= fetchLog("/api/logs", logListResponseSchema);
  return listRequest;
}

export function loadStaticLogDetail(slug: string): Promise<LogDetailResponse | null> {
  let request = detailRequests.get(slug);
  if (!request) {
    request = fetchLog(`/api/logs/${encodeURIComponent(slug)}`, logDetailResponseSchema);
    detailRequests.set(slug, request);
  }
  return request;
}

/** 예전 공개 주소가 깨지지 않도록 지금 목록에 없는 옛 slug도 함께 생성한다. */
export async function loadStaticLogSlugs(): Promise<string[]> {
  const list = await loadStaticLogList();
  return [...new Set([...LEGACY_LOG_SLUGS, ...(list?.posts.map((post) => post.slug) ?? [])])];
}
