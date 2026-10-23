import type {
  ChatHistoryItem, ChatRequest, ChatResponse, ChatToolFollowup,
  ChatToolVerification, ChatToolVerificationResult,
} from "./types";
import { ChatApiError } from "./parse.ts";
import { modelHistoryCharacters, parseModelHistory } from "./modelHistory.ts";
import { normalizePortfolioToolName } from "../portfolio-tools/schema.ts";
import { expectedToolTaskScope, parseToolTaskResponse, parseToolTaskSteps, ToolTaskProtocolError } from "./toolTaskRuntime.ts";
import { ToolReportPreparationError } from "./toolReport.ts";

type BrowserSnapshot = Pick<ChatRequest,
  "pageContext" | "uiSettings" | "uiSettingChanges" | "viewState">;

const BROWSER_VERIFICATION_TOOL_NAMES = new Set<ChatToolVerificationResult["toolName"]>([
  "set_portfolio_theme",
  "set_portfolio_accent",
  "cycle_portfolio_accent",
  "set_portfolio_chat_layout",
  "set_portfolio_chat_font",
  "set_portfolio_chat_font_size",
  "set_portfolio_stream_animation",
  "control_portfolio_view",
  "control_portfolio_research_details",
  "open_portfolio_settings",
]);

/** 새 서버 계획을 우선하고, 계획을 보내지 않는 옛 서버에서만 uiOnly를 해석한다. */
export function toolFollowupForVerification(
  response: Pick<ChatResponse, "toolFollowup" | "uiOnly">,
): boolean | ChatToolFollowup {
  return response.toolFollowup ?? (response.uiOnly === false);
}

/** 호출 원문은 보존하고 대응하는 결과 본문만 실제 브라우저 관측값으로 교체한다. */
export function verifiedToolHistory(
  history: ChatHistoryItem[] | undefined,
  results: ChatToolVerificationResult[],
  latest: BrowserSnapshot,
): ChatHistoryItem[] | undefined {
  return buildVerifiedToolHistory(history, results, latest).history;
}

function buildVerifiedToolHistory(
  history: ChatHistoryItem[] | undefined,
  results: ChatToolVerificationResult[],
  latest: BrowserSnapshot,
): { history: ChatHistoryItem[]; failure?: never } | { history?: never; failure: "history_invalid" | "history_budget" } {
  const native = parseModelHistory(history);
  if (!native || native.length > 24 || native.at(-1)?.role !== "tool") return { failure: "history_invalid" };
  const calls = new Map(native.flatMap((item) => item.role === "assistant"
    ? (item.tool_calls ?? []).map((call) => [call.id, call] as const) : []));
  const observations = new Map(results.map((result) => [result.toolCallId, result]));
  const expected = new Map([...calls].flatMap(([id, call]) => {
    const toolName = normalizePortfolioToolName(call.function.name);
    return toolName && BROWSER_VERIFICATION_TOOL_NAMES.has(
      toolName as ChatToolVerificationResult["toolName"],
    ) ? [[id, toolName] as const] : [];
  }));
  if (observations.size !== results.length || expected.size !== observations.size ||
    results.some((result) => expected.get(result.toolCallId) !== result.toolName)) return { failure: "history_invalid" };
  // 최종 상태는 요청 최상위에도 있다. 이력에는 마지막 관측 결과에 한 번만
  // 보존해 설정 변경 기록 20개가 도구 수만큼 복제되어 12k를 넘지 않게 한다.
  const finalObservationIndex = native.findLastIndex((item) => item.role === "tool" && observations.has(item.tool_call_id));
  const verified = native.map((item, index): ChatHistoryItem => {
    if (item.role !== "tool") return item;
    const observation = observations.get(item.tool_call_id);
    return observation ? { ...item, content: JSON.stringify({
      ...observation, ...(index === finalObservationIndex ? latest : {}),
    }) } : item;
  });
  return modelHistoryCharacters(verified) <= 12_000 ? { history: verified } : { failure: "history_budget" };
}

/** 준비가 끝난 보고 요청은 재시도 때 최신 화면으로 덮어쓰지 않는 불변 스냅숏이다. */
function immutableReportRequest(request: ChatRequest): ChatRequest {
  const snapshot = structuredClone(request);
  const freeze = (value: unknown): void => {
    if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  };
  freeze(snapshot);
  return snapshot;
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
  followup: boolean | ChatToolFollowup = false,
): Promise<ChatResponse> {
  await toolCompletion;
  if (signal.aborted) throw new DOMException("The operation was aborted.", "AbortError");
  const latest = readLatestBrowserState();
  const preparedHistory = buildVerifiedToolHistory(modelHistory, results, latest);
  const toolHistory = preparedHistory.history;
  if (request.toolTask?.dispatchComplete) {
    if (!toolHistory) throw new ToolReportPreparationError(preparedHistory.failure ?? "history_invalid");
    if (!request.toolTask.steps) throw new ToolReportPreparationError("manifest_mismatch");
    let nativeSteps;
    try {
      nativeSteps = parseToolTaskSteps(request.toolTask.steps).filter((step) => step.source === "native");
    } catch (error) {
      if (error instanceof ToolTaskProtocolError) throw new ToolReportPreparationError("manifest_mismatch");
      throw error;
    }
    const nativeCalls = toolHistory.flatMap((item) => item.role === "assistant" ? item.tool_calls ?? [] : [])
      .filter((call) => {
        const name = normalizePortfolioToolName(call.function.name);
        return name && (BROWSER_VERIFICATION_TOOL_NAMES.has(name as ChatToolVerificationResult["toolName"])
          || name === "get_portfolio_ui_settings" || name === "get_portfolio_view_state");
      });
    if (nativeCalls.length !== nativeSteps.length || nativeCalls.some((call, index) =>
      call.id !== nativeSteps[index].toolCallId
      || normalizePortfolioToolName(call.function.name) !== nativeSteps[index].toolName)) {
      throw new ToolReportPreparationError("manifest_mismatch");
    }
    for (const result of results) {
      if (result.toolName !== "control_portfolio_view" && result.toolName !== "control_portfolio_research_details") continue;
      const call = nativeCalls.find((candidate) => candidate.id === result.toolCallId);
      const args = call ? JSON.parse(call.function.arguments) as Record<string, unknown> : undefined;
      if (!args || args.action !== result.action
        || (result.toolName === "control_portfolio_research_details" && args.target !== result.target)) {
        throw new ToolReportPreparationError("manifest_mismatch");
      }
    }
  }
  const toolVerification: ChatToolVerification = typeof followup === "boolean"
    ? { results, explanationRequested: followup }
    : { results, ...followup };
  const preparedRequest: ChatRequest = {
    ...request,
    ...latest,
    history: request.history,
    ...(toolHistory ? { toolHistory } : {}),
    reasoningEnabled: false,
    toolVerification,
  };
  if (preparedRequest.toolTask) {
    // 전송 전에 manifest/관측 대응을 검증한다. 서버 응답을 성공으로 대체하는
    // 것이 아니라, 같은 검증 규칙으로 재시도할 요청 재료만 검사한다.
    try {
      const scope = expectedToolTaskScope(preparedRequest);
      parseToolTaskResponse({ ...scope,
        steps: preparedRequest.toolTask!.steps,
        dispatchComplete: preparedRequest.toolTask!.dispatchComplete,
        status: results.some((result) => result.status === "failed") ? "failed" : "completed",
      }, preparedRequest, []);
    } catch (error) {
      if (error instanceof ToolTaskProtocolError) throw new ToolReportPreparationError("manifest_mismatch");
      throw error;
    }
  }
  const verifiedRequest = immutableReportRequest(preparedRequest);
  const response = await send(verifiedRequest);
  if (signal.aborted) throw new DOMException("The operation was aborted.", "AbortError");
  if (expectedToolTaskScope(verifiedRequest)) {
    parseToolTaskResponse(response.toolTask, verifiedRequest, response.toolExecutions);
  }
  if (response.toolExecutions.length > 0) {
    throw new ChatApiError("화면 확인 응답에 예상하지 않은 도구 실행이 포함됐어요.", { code: "invalid_response" });
  }
  return response;
}
