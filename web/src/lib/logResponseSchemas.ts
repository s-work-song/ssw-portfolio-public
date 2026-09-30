import { array, int, nonnegative, number, object, optional, string } from "zod/mini";
import type { infer as Infer } from "zod/mini";

/**
 * 목록·상세 응답의 실행 시 검증 규칙과 화면 타입을 한 정의에서 관리한다.
 * 문자열은 변환하지 않고, 선택 날짜·정렬값의 기존 계약을 유지한다.
 * 서버가 추가한 필드는 허용하되 검증 결과에서는 선언된 필드만 남긴다.
 */
const logSummaryShape = {
  slug: string(),
  title: string(),
  date: optional(string()),
  order: optional(number()),
  recommendedOrder: optional(number()),
  tags: array(string()),
  summary: string(),
};

export const logSummarySchema = object(logSummaryShape);

export const logPostSchema = object({
  ...logSummaryShape,
  content: string(),
});

export const logListResponseSchema = object({
  posts: array(logSummarySchema),
  total: int().check(nonnegative()),
  availableTags: array(string()),
});

export const logDetailResponseSchema = object({
  post: logPostSchema,
  relatedPosts: array(logSummarySchema),
});

export type LogSummary = Infer<typeof logSummarySchema>;
export type LogPost = Infer<typeof logPostSchema>;
export type LogListResponse = Infer<typeof logListResponseSchema>;
export type LogDetailResponse = Infer<typeof logDetailResponseSchema>;
