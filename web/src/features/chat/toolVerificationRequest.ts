import type {
  ChatRequest, ChatResponse, ChatToolVerificationResult,
} from "./types";
import { ChatApiError } from "./parse.ts";

type BrowserSnapshot = Pick<ChatRequest,
  "pageContext" | "uiSettings" | "uiSettingChanges" | "viewState">;

/** 실행 큐 완료 뒤에만 현재 브라우저 상태를 읽어 같은 질문의 최종 답변을 받는다. */
export async function requestVerifiedToolResponse(
  toolCompletion: Promise<void>,
  request: ChatRequest,
  results: ChatToolVerificationResult[],
  readLatestBrowserState: () => BrowserSnapshot,
  send: (verifiedRequest: ChatRequest) => Promise<ChatResponse>,
  signal: AbortSignal,
): Promise<ChatResponse> {
  await toolCompletion;
  if (signal.aborted) throw new DOMException("The operation was aborted.", "AbortError");
  const latest = readLatestBrowserState();
  const response = await send({
    ...request,
    ...latest,
    history: request.history,
    reasoningEnabled: false,
    toolVerification: { results },
  });
  if (response.toolExecutions.length > 0) {
    throw new ChatApiError("화면 확인 응답에 예상하지 않은 도구 실행이 포함됐어요.");
  }
  return response;
}
