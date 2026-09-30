import type { ChatHistoryItem, ChatMessage } from "./types";

const MAX_HISTORY_ITEMS = 10;
const MAX_HISTORY_CHARACTERS = 12_000;

/**
 * 실패한 질문·답변과 완료되지 않은 답변은 모델 이력에 넣지 않는다.
 * 최신 순으로 턴 수·문자 상한을 적용하며 사용자 중단 질문은 기존대로 보존한다.
 */
export function historyFromMessages(messages: ChatMessage[]): ChatHistoryItem[] {
  const history: ChatHistoryItem[] = [];
  let characters = 0;
  let dropPairedUserTurn = false;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.kind === "greeting" || message.kind === "failure_explanation") continue;
    if (message.generationState && message.generationState !== "complete") {
      dropPairedUserTurn = message.generationState === "failed";
      continue;
    }
    if (dropPairedUserTurn) {
      dropPairedUserTurn = false;
      if (message.role === "user") continue;
    }
    if (history.length >= MAX_HISTORY_ITEMS) break;
    if (characters + message.content.length > MAX_HISTORY_CHARACTERS) break;
    characters += message.content.length;
    history.unshift({ role: message.role, content: message.content });
  }
  return history;
}
