import type { ChatMessage, ToolResult } from "../types";

/** 중단 표시는 메시지 문맥에서만 계산하고 원본 도구 결과는 바꾸지 않는다. */
export function toolResultDisplayStatus(
  result: ToolResult,
  generationState?: ChatMessage["generationState"],
): ToolResult["status"] | "stopped" | "unverified" {
  return result.status === "started" && generationState === "stopped" ? "stopped"
    : result.status === "started" && generationState === "complete" ? "unverified" : result.status;
}

/** 이동·설정·상세 제어를 같은 배지로 표시하되 진행 중·중단·실패는 구분한다. */
export function toolResultText(result: ToolResult, generationState?: ChatMessage["generationState"]): string {
  switch (toolResultDisplayStatus(result, generationState)) {
    case "started":
      return `도구 호출 중… · ${result.label}`;
    case "stopped":
      return `도구 호출 중단 · ${result.label}`;
    case "unverified":
      return `도구 호출 완료 미확인 · ${result.label}`;
    case "arrived":
    case "applied":
      return `도구 호출 · ${result.label}`;
    case "failed":
      return result.detail
        ? `도구 호출 실패 · ${result.label}: ${result.detail}`
        : `도구 호출 실패 · ${result.label}`;
  }
}
