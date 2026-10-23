import { ChatApiError } from "./parse.ts";
import { ToolTaskProtocolError } from "./toolTaskRuntime.ts";
import type { ChatMessage, ChatToolReportFailure, ChatToolReportState, ChatToolTaskProgress } from "./types";

type PreparationFailure = "history_invalid" | "history_budget" | "manifest_mismatch";

/** 전송 전 준비 실패를 실행 실패나 응답 계약 실패와 혼동하지 않는다. */
export class ToolReportPreparationError extends ToolTaskProtocolError {
  readonly reportFailure: PreparationFailure;
  constructor(reason: PreparationFailure) {
    super();
    this.name = "ToolReportPreparationError";
    this.reportFailure = reason;
  }
}

/** 메시지·요청·스택을 노출하지 않는 고정 진단 코드다. */
export function toolReportFailureCode(error: unknown): ChatToolReportFailure {
  if (error instanceof ToolReportPreparationError) return error.reportFailure;
  if (error instanceof ToolTaskProtocolError) return "response_contract";
  if (error instanceof ChatApiError) {
    if (error.code === "timeout") return "timeout";
    if (error.code === "empty_answer") return "empty_answer";
    if (error.code === "invalid_response") return "response_contract";
  }
  return "request_failed";
}

/** 구형 메시지도 완결 지시와 모든 실제 관측이 있어야만 실행 완료로 표시한다. */
export function hasVerifiedToolCompletion(task: ChatToolTaskProgress | undefined): boolean {
  return !!task && task.status === "completed" && task.dispatchComplete === true
    && task.steps.some((step) => step.dispatchStatus === "accepted")
    && task.steps.every((step, index) => step.stepIndex === index && (step.dispatchStatus === "accepted"
      ? step.state === "arrived" || step.state === "applied"
      : step.dispatchStatus === "reported" && step.state === "reported"));
}

export function messageToolReportState(message: ChatMessage): ChatToolReportState | undefined {
  if (message.toolReportState) return message.toolReportState;
  if (!hasVerifiedToolCompletion(message.toolTaskProgress)) return undefined;
  if (message.generationState === "failed") return "failed";
  if (message.generationState === "stopped") return "stopped";
  return undefined;
}

/** 도구 완료를 부정하지 않고 실패한 마지막 보고와 재시도 범위만 설명한다. */
export function toolReportFailureNotice(message: ChatMessage): string {
  const result = hasVerifiedToolCompletion(message.toolTaskProgress)
    ? "요청한 화면 변경은 모두 확인됐어요."
    : "도구 실행 결과는 위 내역에 남아 있지만, 일부 작업은 완료를 확인하지 못했어요.";
  const preparation = ["history_invalid", "history_budget", "manifest_mismatch"].includes(message.toolReportFailure ?? "");
  const report = preparation
    ? "완료된 실행 기록을 마지막 보고용으로 준비하지 못했습니다."
    : "마지막 결과 보고를 만들지 못했습니다.";
  const retry = message.retryAllowed === true ? " 결과 보고만 다시 시도할 수 있어요." : "";
  return `${result} ${report} 이미 반영된 변경은 다시 실행하지 않습니다.${retry}`;
}
