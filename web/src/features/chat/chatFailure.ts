import { ChatApiError } from "./parse.ts";
import type { ChatMessage } from "./types";

const DIAGNOSTIC_CODES = new Set([
  "timeout", "empty_answer", "rate_limited", "tool_call_failed",
  "invalid_response", "upstream_offline", "internal_error",
]);

/** 실패는 답변이 아니라 상태다. 서버의 오류 문구는 대화 화면에 넣지 않는다. */
export const CHAT_FAILURE_NOTICE = "응답 생성을 완료하지 못했어요. 다시 시도해 주세요.";

/** LAN 주소나 localhost의 하위 도메인은 로컬 진단 대상이 아니다. */
export function isLocalChatDiagnosticHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" ||
    hostname === "[::1]" || hostname === "::1";
}

/** 실패한 요청에서 검증 전 도구 안내는 버리고, 정상 부분 답변만 실패 상태로 남긴다. */
export function failedChatMessage(
  message: ChatMessage,
  hasUnverifiedContent: boolean,
): ChatMessage {
  return {
    ...message,
    content: hasUnverifiedContent ? "" : message.content,
    generationState: "failed",
    errorMessage: undefined,
    segments: undefined,
    actions: undefined,
    suggestedQuestions: undefined,
  };
}

/** 구형 세션의 원인 설명 말풍선도 렌더하지 않는다. */
export function visibleChatMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((message) => message.kind !== "failure_explanation");
}

/** 재시도는 실패 답변만 교체하고 질문과 이전 완료 답변은 보존한다. */
export function messagesForChatRetry(messages: ChatMessage[], failedMessageId: string): ChatMessage[] {
  return visibleChatMessages(messages).filter((message) => message.id !== failedMessageId);
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
