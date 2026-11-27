import { ChatApiError } from "./sse.ts";
import type { ChatMessage } from "../types";

const DIAGNOSTIC_CODES = new Set([
  "timeout", "network", "rate_limited", "invalid_response", "session_not_found", "session_busy",
  "upstream_not_configured", "upstream_unreachable", "upstream_unavailable", "upstream_busy",
  "upstream_rate_limited", "upstream_timeout", "upstream_idle_timeout", "upstream_stream_failed",
  "upstream_empty_response", "upstream_context_overflow", "upstream_auth", "upstream_rejected",
  "step_limit", "internal_error",
]);

/** 실패는 답변이 아니라 상태다. 서버가 공개용 안내를 주지 않았을 때 쓰는 기본 문구다. */
export const CHAT_FAILURE_NOTICE = "응답 생성을 완료하지 못했어요. 다시 시도해 주세요.";

/** LAN 주소나 localhost의 하위 도메인은 로컬 진단 대상이 아니다. */
export function isLocalChatDiagnosticHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" ||
    hostname === "[::1]" || hostname === "::1";
}

/** 실패한 답변을 실패 상태로 바꾼다. 받은 부분 글은 버릴지 고를 수 있다. */
export function failedChatMessage(
  message: ChatMessage,
  hasUnverifiedContent: boolean,
): ChatMessage {
  return {
    ...message,
    content: hasUnverifiedContent ? "" : message.content,
    generationState: "failed",
    segments: undefined,
    actions: undefined,
    suggestedQuestions: undefined,
  };
}

type DiagnosticStage = "request" | "tool" | "navigation";
type DiagnosticLogger = (label: string, detail: Record<string, string | number>) => void;

/**
 * 오류 객체·본문·요청값을 콘솔로 넘기지 않는다. 코드와 재시도 대기만 남긴다.
 * 서버가 보낸 message/explanation에는 질문이나 비밀값이 섞일 수 있다.
 */
export function logChatFailureLocally(
  stage: DiagnosticStage,
  error: unknown,
  hostname = typeof window === "undefined" ? "" : window.location.hostname,
  logger: DiagnosticLogger = console.warn,
): void {
  if (!isLocalChatDiagnosticHost(hostname)) return;
  const detail: Record<string, string | number> = { stage };
  if (error instanceof ChatApiError) {
    detail.type = "ChatApiError";
    if (error.code) {
      detail.code = DIAGNOSTIC_CODES.has(error.code) ? error.code : "unknown";
    }
    if (Number.isFinite(error.retryAfterMs) && (error.retryAfterMs ?? 0) > 0) {
      detail.retryAfterMs = error.retryAfterMs as number;
    }
  } else {
    detail.type = "unknown";
  }
  logger("채팅 진단", detail);
}

/** 오류 문구와 무관하게 재시도 타이밍만 보존한다. */
export function chatFailureRetryAfterMs(error: unknown): number {
  return error instanceof ChatApiError && Number.isFinite(error.retryAfterMs)
    ? Math.max(0, error.retryAfterMs ?? 0)
    : 0;
}

/** UI와 요청 가드가 함께 쓰는 남은 재시도 대기 시간이다. */
export function chatRetryWaitSeconds(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1_000));
}
