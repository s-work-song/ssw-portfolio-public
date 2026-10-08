import type {
  ChatHistoryItem, ChatRequest, ChatResponse, ChatToolVerificationResult,
} from "./types";
import { ChatApiError } from "./parse.ts";
import { modelHistoryCharacters, parseModelHistory } from "./modelHistory.ts";
import { normalizePortfolioToolName } from "../portfolio-tools/schema.ts";

type BrowserSnapshot = Pick<ChatRequest,
  "pageContext" | "uiSettings" | "uiSettingChanges" | "viewState">;

/** 호출 원문은 보존하고 대응하는 결과 본문만 실제 브라우저 관측값으로 교체한다. */
export function verifiedToolHistory(
  history: ChatHistoryItem[] | undefined,
  results: ChatToolVerificationResult[],
  latest: BrowserSnapshot,
): ChatHistoryItem[] | undefined {
  const native = parseModelHistory(history);
  if (!native || native.length > 24 || native.at(-1)?.role !== "tool") return undefined;
  const calls = new Map(native.flatMap((item) => item.role === "assistant"
    ? (item.tool_calls ?? []).map((call) => [call.id, call] as const) : []));
  const observations = new Map(results.map((result) => [result.toolCallId, result]));
  if (observations.size !== results.length || results.some((result) =>
    normalizePortfolioToolName(calls.get(result.toolCallId)?.function.name) !== result.toolName)) return undefined;
  const verified = native.map((item): ChatHistoryItem => {
    if (item.role !== "tool") return item;
    const observation = observations.get(item.tool_call_id);
    return observation ? { ...item, content: JSON.stringify({ ...observation, ...latest }) } : item;
  });
  return modelHistoryCharacters(verified) <= 12_000 ? verified : undefined;
}

/** 실행 큐 완료 뒤에만 현재 브라우저 상태를 읽어 같은 질문의 최종 답변을 받는다. */
export async function requestVerifiedToolResponse(
  toolCompletion: Promise<void>,
  request: ChatRequest,
  results: ChatToolVerificationResult[],
  readLatestBrowserState: () => BrowserSnapshot,
  send: (verifiedRequest: ChatRequest) => Promise<ChatResponse>,
  signal: AbortSignal,
  modelHistory?: ChatHistoryItem[],
): Promise<ChatResponse> {
  await toolCompletion;
  if (signal.aborted) throw new DOMException("The operation was aborted.", "AbortError");
  const latest = readLatestBrowserState();
  const toolHistory = verifiedToolHistory(modelHistory, results, latest);
  const response = await send({
    ...request,
    ...latest,
    history: request.history,
    ...(toolHistory ? { toolHistory } : {}),
    reasoningEnabled: false,
    toolVerification: { results },
  });
  if (response.toolExecutions.length > 0) {
    throw new ChatApiError("화면 확인 응답에 예상하지 않은 도구 실행이 포함됐어요.");
  }
  return response;
}
