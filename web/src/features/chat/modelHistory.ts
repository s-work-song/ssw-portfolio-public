import { PORTFOLIO_UI_TOOL_NAMES, isRecord } from "../portfolio-tools/schema.ts";
import type { ChatHistoryItem } from "./types";

const PUBLIC_HISTORY_TOOLS = new Set<string>(PORTFOLIO_UI_TOOL_NAMES.flatMap((name) =>
  [name, name.replaceAll("_", "-")]));
const onlyKeys = (value: Record<string, unknown>, allowed: readonly string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));
const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_.:-]{1,128}$/u.test(value);

/**
 * 이력은 실행 명령이 아니다. 공개 역할과 완결된 호출/결과 쌍만 받아 원문을
 * 보존한다. 알 수 없는 필드나 사설 도구가 섞이면 선택 필드 전체를 버린다.
 */
export function parseModelHistory(value: unknown): ChatHistoryItem[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > 25) return undefined;
  const pending = new Set<string>();
  const seen = new Set<string>();
  let finalSeen = false;
  for (const item of value) {
    if (!isRecord(item) || finalSeen) return undefined;
    if (item.role === "assistant") {
      if (pending.size || !onlyKeys(item, ["role", "content", "tool_calls"]) ||
        !(typeof item.content === "string" || item.content === null)) return undefined;
      if (item.tool_calls !== undefined) {
        if (typeof item.content === "string" && item.content.trim()) return undefined;
        if (!Array.isArray(item.tool_calls) || !item.tool_calls.length) return undefined;
        for (const call of item.tool_calls) {
          if (!isRecord(call) || !onlyKeys(call, ["id", "type", "function"]) ||
            !validId(call.id) || seen.has(call.id) || call.type !== "function" ||
            !isRecord(call.function) || !onlyKeys(call.function, ["name", "arguments"]) ||
            typeof call.function.name !== "string" || !PUBLIC_HISTORY_TOOLS.has(call.function.name) ||
            typeof call.function.arguments !== "string" || call.function.arguments.length > 2_000) {
            return undefined;
          }
          try {
            const argumentsValue: unknown = JSON.parse(call.function.arguments);
            if (!isRecord(argumentsValue) || Array.isArray(argumentsValue)) return undefined;
          } catch { return undefined; }
          seen.add(call.id);
          pending.add(call.id);
        }
      } else {
        if (typeof item.content !== "string" || !item.content.trim()) return undefined;
        finalSeen = true;
      }
    } else if (item.role === "tool") {
      if (!onlyKeys(item, ["role", "tool_call_id", "content"]) ||
        !validId(item.tool_call_id) || !pending.delete(item.tool_call_id) ||
        typeof item.content !== "string" || !item.content.trim()) return undefined;
    } else return undefined;
  }
  if (pending.size) return undefined;
  const history = value as ChatHistoryItem[];
  if (modelHistoryCharacters(history) > 20_000) return undefined;
  return history;
}

/** 백엔드와 동일하게 모든 본문·호출 ID·이름·원문 인수를 문자 예산에 포함한다. */
export function modelHistoryCharacters(history: readonly ChatHistoryItem[]): number {
  return history.reduce((total, item) => total + (item.content?.length ?? 0) +
    (item.role === "tool" ? item.tool_call_id.length : 0) +
    (item.role === "assistant" ? (item.tool_calls ?? []).reduce((calls, call) =>
      calls + call.id.length + call.function.name.length + call.function.arguments.length, 0) : 0), 0);
}

/** 확인 전 체인에는 임시 답변이 없고, 완료 이력에는 공개 최종 답변이 한 번만 있다. */
export function responseModelHistory(
  value: unknown, answer: string, awaitingBrowser = false,
): ChatHistoryItem[] | undefined {
  const history = parseModelHistory(value);
  if (!history) return undefined;
  const last = history[history.length - 1];
  const hasFinal = last.role === "assistant" && !last.tool_calls;
  if (awaitingBrowser ? hasFinal : !hasFinal || last.content !== answer) return undefined;
  return history;
}
