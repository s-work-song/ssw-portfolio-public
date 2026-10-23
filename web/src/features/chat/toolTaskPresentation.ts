import type { ChatToolTaskProgress } from "./types";

export function toolTaskSummary(task: ChatToolTaskProgress): string {
  const writes = task.steps.filter((step) => step.dispatchStatus === "accepted");
  const verified = writes.filter((step) => step.state === "arrived" || step.state === "applied").length;
  const count = task.dispatchComplete ? `${verified}/${writes.length}단계 확인` : `${verified}단계 확인 · 지시 수신 중`;
  switch (task.status) {
    case "running": return `도구 작업 · ${count}`;
    case "awaiting_verification": return `메인 답변 확인 중 · ${count}`;
    case "completed": return writes.length ? `도구 작업 완료 · ${count}` : "도구 보고 수신 완료";
    case "failed": return task.dispatchComplete ? `도구 작업 확인 실패 · ${count}` : "도구 작업 미완료 · 전체 지시 미확정";
    case "cancelled": return "도구 작업 취소 · 이미 반영된 결과는 유지";
  }
}

const TOOL_NAMES: Record<string, string> = {
  set_portfolio_theme: "화면 모드", set_portfolio_accent: "포인트 색상",
  cycle_portfolio_accent: "색상 순회", set_portfolio_chat_layout: "채팅 배치",
  set_portfolio_chat_font: "글꼴", set_portfolio_chat_font_size: "글자 크기",
  set_portfolio_stream_animation: "텍스트 연출", control_portfolio_view: "화면 이동",
  control_portfolio_research_details: "연구 상세", open_portfolio_settings: "설정 화면",
  get_portfolio_ui_settings: "설정 보고", get_portfolio_view_state: "화면 상태 보고",
};
const STATES = {
  accepted: "접수됨 · 실행 대기", running: "실행·화면 확인 중", reported: "서버 보고 수신 · 브라우저 확인 아님",
  arrived: "실제 도착 확인", applied: "실제 반영 확인", failed: "완료 확인 실패", cancelled: "취소됨",
};
export function toolTaskStepText(step: ChatToolTaskProgress["steps"][number]): string {
  return `${step.stepIndex + 1}. ${TOOL_NAMES[step.toolName] ?? "화면 도구"} · ${STATES[step.state]}`;
}
