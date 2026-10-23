import { ChatApiError } from "./parse.ts";
import { parseModelHistory } from "./modelHistory.ts";
import type { ChatHistoryItem } from "./types";

export type ChatRetryFailureKind = "transient" | "capacity";

const TRANSIENT_ERRORS = new Set([
  "network", "timeout", "upstream_timeout", "request_timeout", "upstream_unavailable",
]);
const CAPACITY_ERRORS = new Set([
  "context_length_exceeded", "request_too_large", "payload_too_large",
]);

/** 오류 문구는 추측하지 않는다. 허용한 코드와 HTTP 상태만 복구에 사용한다. */
export function chatRetryFailureKind(error: unknown): ChatRetryFailureKind | undefined {
  if (!(error instanceof ChatApiError) || !error.code) return undefined;
  if ([401, 403, 409, 429].includes(error.httpStatus ?? 0)) return undefined;
  if (CAPACITY_ERRORS.has(error.code)) {
    if (error.httpStatus && error.httpStatus >= 400 && error.httpStatus < 500 &&
      ![400, 413, 422].includes(error.httpStatus)) return undefined;
    return "capacity";
  }
  if (error.httpStatus && error.httpStatus >= 400 && error.httpStatus < 500) return undefined;
  return TRANSIENT_ERRORS.has(error.code) ? "transient" : undefined;
}

/**
 * 용량 실패에서만 오래된 완결 USER 턴 앞부분을 덜어 낸 새 요청 이력이다.
 * 최신 한 턴은 보호하고, 제거 가능한 연속 앞부분의 절반(올림)만 제외한다.
 * 원본·native 호출/결과·각 항목의 원문은 수정하지 않는다. 선행 안내나
 * 미완결/잘못된 체인이 앞에 있으면 안전한 경계를 추측해 건너뛰지 않는다.
 */
export function historyForCapacityRetry(
  history: readonly ChatHistoryItem[],
): ChatHistoryItem[] | undefined {
  if (history[0]?.role !== "user") return undefined;
  const starts = history.flatMap((item, index) => item.role === "user" ? [index] : []);
  if (starts.length < 2) return undefined;
  const removableEnds: number[] = [];
  for (let index = 0; index < starts.length - 1; index += 1) {
    const start = starts[index];
    const end = starts[index + 1];
    const question = history[start];
    if (typeof question.content !== "string" || !question.content.trim() ||
      !parseModelHistory(history.slice(start + 1, end))) break;
    removableEnds.push(end);
  }
  if (!removableEnds.length) return undefined;
  return history.slice(removableEnds[Math.ceil(removableEnds.length / 2) - 1]);
}
