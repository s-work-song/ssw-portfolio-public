import { responseModelHistory } from "./modelHistory.ts";
import { compactRepeatedSupportedOptions } from "./historyCompaction.ts";
import type { ChatHistoryItem, ChatMessage } from "./types";

/**
 * 완료된 네이티브 체인과 사용자 질문을 순서대로 모두 보존한다.
 * 실패 질문·답변은 제외하고 기존 계약대로 중단된 답변만 제외한다
 * (중단한 사용자 질문은 유지). 요청 크기는 서버의 HTTP 바이트 상한으로,
 * 모델 문맥 예산은 런처의 실제 토큰 수로 판단한다.
 */
export function historyFromMessages(messages: ChatMessage[]): ChatHistoryItem[] {
  const turns: ChatHistoryItem[][] = [];
  let turn: ChatHistoryItem[] = [];
  let failed = false;
  const finishTurn = () => {
    if (!failed && turn.length) turns.push(turn);
    turn = [];
    failed = false;
  };
  for (const message of messages) {
    if (message.kind === "greeting" || message.kind === "failure_explanation") continue;
    if (message.role === "user") {
      finishTurn();
      turn.push({ role: "user", content: message.content });
      continue;
    }
    if (message.generationState && message.generationState !== "complete") {
      if (message.generationState === "failed") failed = true;
      continue;
    }
    const native = responseModelHistory(message.modelHistory, message.content,
      message.kind === "tool_status");
    // 칩만 완료한 턴에는 합성 문장도 빈 assistant 본문도 추가하지 않는다.
    if (message.kind === "tool_status" && !native) continue;
    const items: ChatHistoryItem[] = native ?? [{ role: "assistant", content: message.content }];
    // 첫 USER 앞의 연속 레거시 안내도 백엔드와 같이 하나의 선행 그룹이다.
    turn.push(...items);
  }
  finishTurn();
  return compactRepeatedSupportedOptions(turns.flat());
}
