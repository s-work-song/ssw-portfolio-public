import type { ToolResult } from "./types";

/** 모델 문장 대신 브라우저가 확인한 도구 결과로 최종 답변을 만든다. */
export function verifiedToolReply(results: readonly ToolResult[]): string {
  const applied = results.filter((result) =>
    result.status === "applied" || result.status === "arrived");
  const failed = results.filter((result) =>
    result.status !== "applied" && result.status !== "arrived");
  if (results.length === 0) return "화면 조작 결과를 확인하지 못했습니다.";
  const names = (items: readonly ToolResult[]) =>
    [...new Set(items.map((item) => item.label))].join(", ");
  if (failed.length === 0) {
    return `${names(applied)}: 화면에서 반영을 확인했습니다.`;
  }
  if (applied.length === 0) {
    return `${names(failed)}: 화면에서 반영을 확인하지 못했습니다.`;
  }
  return `반영 확인: ${names(applied)}. 확인 실패: ${names(failed)}.`;
}
