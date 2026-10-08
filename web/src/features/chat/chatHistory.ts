import { modelHistoryCharacters, responseModelHistory } from "./modelHistory.ts";
import type { ChatHistoryItem, ChatMessage } from "./types";

// 최대 native 24개 + 공개 final + USER 한 턴을 최근 다섯 턴까지 보존한다.
const MAX_HISTORY_ITEMS = 130;
const MAX_HISTORY_TURNS = 5;
const MAX_HISTORY_CHARACTERS = 12_000;

/**
 * 완료된 네이티브 체인은 사용자 질문과 한 덩어리로 보존한다. 오래된 턴부터
 * 통째로 버려 호출과 결과가 분리되지 않게 한다. 실패 질문·답변은 제외하고
 * 기존 계약대로 중단된 답변만 제외한다(중단한 사용자 질문은 유지).
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
    const native = responseModelHistory(message.modelHistory, message.content);
    const items: ChatHistoryItem[] = native ?? [{ role: "assistant", content: message.content }];
    // 첫 USER 앞의 연속 레거시 안내도 백엔드와 같이 하나의 선행 그룹이다.
    turn.push(...items);
  }
  finishTurn();
  const kept: ChatHistoryItem[][] = [];
  let items = 0;
  let characters = 0;
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const candidate = turns[index];
    const size = modelHistoryCharacters(candidate);
    if (kept.length >= MAX_HISTORY_TURNS) break;
    // 자체 상한을 넘는 턴도 부분 보존하지 않는다.
    if (candidate.length > MAX_HISTORY_ITEMS || size > MAX_HISTORY_CHARACTERS) break;
    if (items + candidate.length > MAX_HISTORY_ITEMS || characters + size > MAX_HISTORY_CHARACTERS) break;
    kept.unshift(candidate);
    items += candidate.length;
    characters += size;
  }
  return kept.flat();
}
