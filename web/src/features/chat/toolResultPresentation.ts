import type { ToolResult } from "./types";

/** 이동·설정·상세 제어를 같은 배지로 표시하되 진행 중·실패는 구분한다. */
export function toolResultText(result: ToolResult): string {
  switch (result.status) {
    case "started":
      return "도구 호출 중…";
    case "arrived":
    case "applied":
      return `도구 호출 · ${result.label}`;
    case "failed":
      return result.detail
        ? `도구 호출 실패 · ${result.label}: ${result.detail}`
        : `도구 호출 실패 · ${result.label}`;
  }
}
