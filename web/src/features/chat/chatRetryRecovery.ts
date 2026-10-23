import { ChatApiError } from "./parse.ts";
import { parseModelHistory } from "./modelHistory.ts";
import type { ChatHistoryItem } from "./types";

export type ChatRetryFailureKind = "transient" | "capacity" | "rate_limited" | "empty_answer";
export type ChatRetryPhase = "request" | "report";

/** 수동 재시도에서도 유지되는 한 사용자 턴의 자동 복구 예산이다. */
export interface ChatRecoveryBudget {
  requestAttempts: number;
  requestReplays: number;
  reportAttempts: number;
  totalAttempts: number;
  requestExhausted: boolean;
  reportExhausted: boolean;
}

export function initialChatRecoveryBudget(): ChatRecoveryBudget {
  return { requestAttempts: 0, requestReplays: 0, reportAttempts: 0, totalAttempts: 0,
    requestExhausted: false, reportExhausted: false };
}

export function exhaustChatRecoveryPhase(budget: ChatRecoveryBudget, phase: ChatRetryPhase): ChatRecoveryBudget {
  return { ...budget, [phase === "request" ? "requestExhausted" : "reportExhausted"]: true };
}

const TRANSIENT_ERRORS = new Set([
  "network", "timeout", "upstream_timeout", "request_timeout", "upstream_unavailable", "upstream_busy",
]);
const CAPACITY_ERRORS = new Set([
  "context_length_exceeded", "request_too_large", "payload_too_large",
]);

/** 오류 문구는 추측하지 않는다. 허용한 코드와 HTTP 상태만 복구에 사용한다. */
export function chatRetryFailureKind(error: unknown): ChatRetryFailureKind | undefined {
  if (!(error instanceof ChatApiError)) return undefined;
  if ([401, 403, 409].includes(error.httpStatus ?? 0)) return undefined;
  if (error.code === "rate_limited" && (!error.httpStatus || error.httpStatus === 429)) return "rate_limited";
  if (error.code === "empty_answer" && (!error.httpStatus || error.httpStatus >= 500)) return "empty_answer";
  if (!error.code) return [502, 503, 504].includes(error.httpStatus ?? 0) ? "transient" : undefined;
  if (CAPACITY_ERRORS.has(error.code)) {
    if (error.httpStatus && error.httpStatus >= 400 && error.httpStatus < 500 &&
      ![400, 413, 422].includes(error.httpStatus)) return undefined;
    return "capacity";
  }
  if (error.httpStatus && error.httpStatus >= 400 && error.httpStatus < 500) return undefined;
  return TRANSIENT_ERRORS.has(error.code) ? "transient" : undefined;
}

/** 서버의 not-before를 축소하지 않는다. 무응답 기본값은 오류 종류별로만 정한다. */
export function chatRecoveryDelayMs(error: unknown, kind = chatRetryFailureKind(error)): number {
  if (error instanceof ChatApiError && Number.isFinite(error.retryAfterMs) && (error.retryAfterMs ?? -1) >= 0) {
    return Math.ceil(error.retryAfterMs!);
  }
  return kind === "rate_limited" ? 10_000 : kind === "transient" || kind === "empty_answer" ? 1_000 : 0;
}

export interface ChatRecoveryPlan {
  phase: ChatRetryPhase;
  kind: ChatRetryFailureKind;
  /** 60초보다 긴 서버 대기는 자동 전송하지 않고 수동 재시도로 넘긴다. */
  automatic: boolean;
  retryAt: number;
  history?: ChatHistoryItem[];
  budget: ChatRecoveryBudget;
}

/** 오류 분류·단계별 예산·안전한 문맥 경계만 결정하며 상태나 원본 요청을 바꾸지 않는다. */
export function planChatRecovery({ phase, budget, error, history, now }: {
  phase: ChatRetryPhase; budget: ChatRecoveryBudget; error: unknown;
  history: readonly ChatHistoryItem[]; now: number;
}): ChatRecoveryPlan | undefined {
  const kind = chatRetryFailureKind(error);
  if (!kind || (error instanceof ChatApiError && error.retryExhausted) || budget.totalAttempts >= 3 || (phase === "request"
    ? budget.requestExhausted || budget.requestAttempts >= 2 || (kind !== "capacity" && budget.requestReplays >= 1)
    : budget.reportExhausted || budget.reportAttempts >= 1)) return undefined;
  const reduced = kind === "capacity" ? historyForCapacityRetry(history) : undefined;
  if (kind === "capacity" && !reduced) return undefined;
  const delay = chatRecoveryDelayMs(error, kind);
  const automatic = delay <= 60_000;
  const nextBudget = !automatic ? budget : {
    ...budget, totalAttempts: budget.totalAttempts + 1,
    ...(phase === "request" ? { requestAttempts: budget.requestAttempts + 1,
      requestReplays: budget.requestReplays + Number(kind !== "capacity") }
      : { reportAttempts: budget.reportAttempts + 1 }),
  };
  return { phase, kind, automatic, retryAt: now + delay, budget: nextBudget,
    ...(reduced ? { history: reduced } : {}) };
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
