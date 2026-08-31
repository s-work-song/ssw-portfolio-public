import {
  ACTION_IDS,
  ACTION_LABELS,
  CHAT_STREAM_ANIMATIONS,
  TONES,
} from "./constants";
import type {
  ActionId,
  ApiAudience,
  ChatAction,
  ChatPortfolioViewState,
  ChatPortfolioViewAction,
  ChatPortfolioResearchYear,
  ChatRequest,
  ChatResponse,
  ChatSegment,
  ChatStatusResponse,
  ChatToolExecution,
  PageContext,
} from "./types";

const API_AUDIENCES: readonly ApiAudience[] = [
  "default",
  "hiring",
  "developer",
  "collaboration",
  "casual",
];

const PAGE_CONTEXTS: readonly PageContext[] = [
  "default",
  "overview",
  "resume",
  "cover_letter",
  "research",
  "log",
];

const PORTFOLIO_VIEW_ACTIONS: readonly ChatPortfolioViewAction[] = [
  "main",
  "overview",
  "resume",
  "cover-letter",
  "research",
  "research-2022",
  "research-2023",
  "research-2024",
  "research-2025",
  "research-2026",
  "log",
  "expand-research-details",
  "collapse-research-details",
  "expand-research-year-details",
  "collapse-research-year-details",
];

const PORTFOLIO_RESEARCH_YEARS: readonly ChatPortfolioResearchYear[] = [
  "2022",
  "2023",
  "2024",
  "2025",
  "2026",
];

const PORTFOLIO_YEAR_DETAIL_ACTIONS: readonly ChatPortfolioViewAction[] = [
  "expand-research-year-details",
  "collapse-research-year-details",
];

const PORTFOLIO_PAGE_IDS: readonly ChatPortfolioViewState["page"][] = [
  "landing",
  "main",
  "overview",
  "resume",
  "cover-letter",
  "research",
  "log",
  "settings",
  "unknown",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isAllowed<T extends string>(
  value: unknown,
  allowlist: readonly T[],
): value is T {
  return isString(value) && allowlist.includes(value as T);
}

function parseAction(value: unknown): ChatAction | null {
  if (!isRecord(value) || !isAllowed(value.id, ACTION_IDS)) return null;
  if (!isString(value.label) || value.label !== ACTION_LABELS[value.id as ActionId]) {
    return null;
  }
  return { id: value.id as ActionId, label: value.label };
}

function parseSegment(value: unknown): ChatSegment | null {
  if (
    !isRecord(value) ||
    !isString(value.markdown) ||
    !Array.isArray(value.actions)
  ) {
    return null;
  }
  return {
    markdown: value.markdown,
    actions: value.actions
      .map(parseAction)
      .filter((action): action is ChatAction => action !== null)
      .slice(0, 2),
  };
}

function parseSuggestedQuestions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const questions: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isString(item)) continue;
    const question = item.trim();
    const key = question.normalize("NFKC").toLowerCase();
    if (
      question.length < 4 ||
      question.length > 120 ||
      seen.has(key)
    ) {
      continue;
    }
    seen.add(key);
    questions.push(question);
    if (questions.length >= 4) break;
  }
  return questions;
}

function parsePortfolioViewState(value: unknown): ChatPortfolioViewState | null {
  if (
    !isRecord(value) ||
    !isAllowed(value.page, PORTFOLIO_PAGE_IDS) ||
    !(value.anchor === null || isString(value.anchor)) ||
    !(value.researchYear === null || isAllowed(value.researchYear, PORTFOLIO_RESEARCH_YEARS))
  ) {
    return null;
  }
  let researchDetails: ChatPortfolioViewState["researchDetails"] = null;
  if (value.researchDetails !== null) {
    const details = value.researchDetails;
    if (
      !isRecord(details) ||
      typeof details.expanded !== "number" ||
      typeof details.total !== "number" ||
      !Number.isInteger(details.expanded) ||
      !Number.isInteger(details.total) ||
      details.expanded < 0 ||
      details.total < details.expanded ||
      !Array.isArray(details.expandedYears)
    ) {
      return null;
    }
    const expandedYears = details.expandedYears.filter((year) =>
      isAllowed(year, PORTFOLIO_RESEARCH_YEARS),
    );
    if (expandedYears.length !== details.expandedYears.length) return null;
    researchDetails = {
      expanded: details.expanded,
      total: details.total,
      expandedYears,
    };
  }
  return {
    page: value.page,
    anchor: value.anchor,
    researchYear: value.researchYear,
    researchDetails,
  };
}

function parseToolExecution(value: unknown): ChatToolExecution | null {
  if (
    isRecord(value) &&
    value.type === "report_portfolio_view_state" &&
    value.toolName === "get-portfolio-view-state" &&
    isString(value.toolCallId) &&
    value.toolCallId.length >= 1 &&
    value.toolCallId.length <= 128 &&
    typeof value.available === "boolean"
  ) {
    const viewState = value.viewState === null
      ? null
      : parsePortfolioViewState(value.viewState);
    if (value.available !== Boolean(viewState)) return null;
    return {
      type: "report_portfolio_view_state",
      toolCallId: value.toolCallId,
      toolName: "get-portfolio-view-state",
      available: value.available,
      viewState,
    };
  }
  if (
    isRecord(value) &&
    value.type === "control_portfolio_view" &&
    value.toolName === "control-portfolio-view" &&
    isString(value.toolCallId) &&
    value.toolCallId.length >= 1 &&
    value.toolCallId.length <= 128 &&
    isString(value.action) &&
    (PORTFOLIO_VIEW_ACTIONS as readonly string[]).includes(value.action)
  ) {
    const action = value.action as ChatPortfolioViewAction;
    const requiresYear = PORTFOLIO_YEAR_DETAIL_ACTIONS.includes(action);
    const year = isAllowed(value.year, PORTFOLIO_RESEARCH_YEARS)
      ? value.year
      : undefined;
    if ((requiresYear && !year) || (!requiresYear && value.year !== undefined)) {
      return null;
    }
    return {
      type: "control_portfolio_view",
      toolCallId: value.toolCallId,
      toolName: "control-portfolio-view",
      action,
      ...(year ? { year } : {}),
    };
  }
  if (
    isRecord(value) &&
    value.type === "open_portfolio_settings" &&
    value.toolName === "open-portfolio-settings" &&
    isString(value.toolCallId) &&
    value.toolCallId.length >= 1 &&
    value.toolCallId.length <= 128
  ) {
    return {
      type: "open_portfolio_settings",
      toolCallId: value.toolCallId,
      toolName: "open-portfolio-settings",
    };
  }
  if (
    isRecord(value) &&
    value.type === "report_portfolio_ui_settings" &&
    value.toolName === "get-portfolio-ui-settings" &&
    isString(value.toolCallId) &&
    value.toolCallId.length >= 1 &&
    value.toolCallId.length <= 128 &&
    typeof value.available === "boolean" &&
    (value.uiSettings === null ||
      (isRecord(value.uiSettings) &&
        ["light", "dark", "system"].includes(String(value.uiSettings.theme)) &&
        ["indigo", "emerald", "amber", "rose", "violet"].includes(
          String(value.uiSettings.accent),
        ) &&
        ["floating", "dock"].includes(String(value.uiSettings.chatLayout)) &&
        ["pretendard", "noto-sans-kr", "system"].includes(
          String(value.uiSettings.chatFont),
        ) &&
        ["small", "medium", "large", "xlarge"].includes(
          String(value.uiSettings.chatFontSize),
        )))
  ) {
    const uiSettings = value.uiSettings as Record<string, unknown> | null;
    return {
      type: "report_portfolio_ui_settings",
      toolCallId: value.toolCallId,
      toolName: "get-portfolio-ui-settings",
      available: value.available,
      uiSettings: uiSettings
        ? {
            theme: uiSettings.theme as "light" | "dark" | "system",
            accent: uiSettings.accent as
              | "indigo"
              | "emerald"
              | "amber"
              | "rose"
              | "violet",
            chatLayout: uiSettings.chatLayout as "floating" | "dock",
            chatFont: uiSettings.chatFont as
              | "pretendard"
              | "noto-sans-kr"
              | "system",
            chatFontSize: uiSettings.chatFontSize as
              | "small"
              | "medium"
              | "large"
              | "xlarge",
          }
        : null,
    };
  }
  if (
    isRecord(value) &&
    value.type === "set_portfolio_theme" &&
    value.toolName === "set-portfolio-theme" &&
    isString(value.toolCallId) &&
    value.toolCallId.length >= 1 &&
    value.toolCallId.length <= 128 &&
    (value.theme === "light" || value.theme === "dark")
  ) {
    return {
      type: "set_portfolio_theme",
      toolCallId: value.toolCallId,
      toolName: "set-portfolio-theme",
      theme: value.theme,
    };
  }
  if (
    isRecord(value) &&
    value.type === "set_portfolio_accent" &&
    value.toolName === "set-portfolio-accent" &&
    isString(value.toolCallId) &&
    value.toolCallId.length >= 1 &&
    value.toolCallId.length <= 128 &&
    ["indigo", "emerald", "amber", "rose", "violet"].includes(
      String(value.accent),
    )
  ) {
    return {
      type: "set_portfolio_accent",
      toolCallId: value.toolCallId,
      toolName: "set-portfolio-accent",
      accent: value.accent as
        | "indigo"
        | "emerald"
        | "amber"
        | "rose"
        | "violet",
    };
  }
  if (
    isRecord(value) &&
    value.type === "set_portfolio_chat_layout" &&
    value.toolName === "set-portfolio-chat-layout" &&
    isString(value.toolCallId) &&
    value.toolCallId.length >= 1 &&
    value.toolCallId.length <= 128 &&
    (value.layout === "floating" || value.layout === "dock")
  ) {
    return {
      type: "set_portfolio_chat_layout",
      toolCallId: value.toolCallId,
      toolName: "set-portfolio-chat-layout",
      layout: value.layout,
    };
  }
  if (
    isRecord(value) &&
    value.type === "set_portfolio_chat_font" &&
    value.toolName === "set-portfolio-chat-font" &&
    isString(value.toolCallId) &&
    value.toolCallId.length >= 1 &&
    value.toolCallId.length <= 128 &&
    ["pretendard", "noto-sans-kr", "system"].includes(String(value.font))
  ) {
    return {
      type: "set_portfolio_chat_font",
      toolCallId: value.toolCallId,
      toolName: "set-portfolio-chat-font",
      font: value.font as "pretendard" | "noto-sans-kr" | "system",
    };
  }
  if (
    isRecord(value) &&
    value.type === "set_portfolio_chat_font_size" &&
    value.toolName === "set-portfolio-chat-font-size" &&
    isString(value.toolCallId) &&
    value.toolCallId.length >= 1 &&
    value.toolCallId.length <= 128 &&
    ["small", "medium", "large", "xlarge"].includes(String(value.size))
  ) {
    return {
      type: "set_portfolio_chat_font_size",
      toolCallId: value.toolCallId,
      toolName: "set-portfolio-chat-font-size",
      size: value.size as "small" | "medium" | "large" | "xlarge",
    };
  }
  if (
    isRecord(value) &&
    value.type === "set_portfolio_stream_animation" &&
    value.toolName === "set-portfolio-stream-animation" &&
    isString(value.toolCallId) &&
    value.toolCallId.length >= 1 &&
    value.toolCallId.length <= 128 &&
    isAllowed(value.animation, CHAT_STREAM_ANIMATIONS)
  ) {
    return {
      type: "set_portfolio_stream_animation",
      toolCallId: value.toolCallId,
      toolName: "set-portfolio-stream-animation",
      animation: value.animation,
    };
  }
  if (
    !isRecord(value) ||
    value.type !== "show_portfolio_log_results" ||
    value.toolName !== "search-portfolio-logs" ||
    !isString(value.toolCallId) ||
    value.toolCallId.length < 1 ||
    value.toolCallId.length > 128 ||
    !isString(value.query) ||
    value.query.length < 1 ||
    value.query.length > 200 ||
    !Array.isArray(value.matchedSlugs)
  ) {
    return null;
  }
  const matchedSlugs = [...new Set(value.matchedSlugs)]
    .filter((slug): slug is string =>
      isString(slug) && /^[a-z0-9-]{1,120}$/u.test(slug),
    )
    .slice(0, 5);
  return {
    type: "show_portfolio_log_results",
    toolCallId: value.toolCallId,
    toolName: "search-portfolio-logs",
    query: value.query,
    matchedSlugs,
  };
}

function parseToolExecutions(value: unknown): ChatToolExecution[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseToolExecution)
    .filter((execution): execution is ChatToolExecution => execution !== null)
    .slice(0, 1);
}

function parseChatResponse(value: unknown): ChatResponse {
  if (!isRecord(value)) {
    throw new ChatApiError("서버 응답 형식을 확인할 수 없습니다.");
  }

  const {
    mode,
    status,
    generated,
    answer,
    segments,
    audience,
    tone,
    pageContext,
    sources,
    actions,
    suggestedQuestions,
    toolExecutions,
    cached,
  } = value;

  const validMode =
    mode === "model" || mode === "retrieval_fallback" ? mode : null;
  const validStatus =
    status === "online" || status === "upstream_offline" ? status : null;

  if (
    !validMode ||
    !validStatus ||
    typeof generated !== "boolean" ||
    !isString(answer) ||
    !Array.isArray(segments) ||
    !isAllowed(audience, API_AUDIENCES) ||
    !isAllowed(tone, TONES) ||
    !isAllowed(pageContext, PAGE_CONTEXTS) ||
    !Array.isArray(sources) ||
    !Array.isArray(actions) ||
    typeof cached !== "boolean" ||
    (validMode === "model" && generated !== true) ||
    (validMode === "retrieval_fallback" && generated !== false)
  ) {
    throw new ChatApiError("서버 응답 형식을 확인할 수 없습니다.");
  }

  return {
    mode: validMode,
    status: validStatus,
    generated,
    answer,
    segments: segments
      .map(parseSegment)
      .filter((segment): segment is ChatSegment => segment !== null),
    audience,
    tone,
    pageContext,
    // 공개 UI는 debug source exposure 설정과 무관하게 source를 보관하지 않는다.
    sources: [],
    actions: actions
      .map(parseAction)
      .filter((action): action is ChatAction => action !== null)
      .slice(0, 2),
    // 백엔드와 프론트의 순차 배포 중에도 기존 응답을 계속 읽는다.
    suggestedQuestions: parseSuggestedQuestions(suggestedQuestions),
    toolExecutions: parseToolExecutions(toolExecutions),
    cached,
  };
}

function apiUrl(path = "/api/chat"): string {
  const baseUrl = process.env.NEXT_PUBLIC_RAG_API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new ChatApiError(
      "채팅 서버 주소가 설정되지 않았습니다. 잠시 후 다시 이용해 주세요.",
    );
  }
  return `${baseUrl.replace(/\/+$/u, "")}${path}`;
}

function inferenceGatewayUrl(): string | null {
  const configured =
    process.env.NEXT_PUBLIC_INFERENCE_GATEWAY_URL?.trim();
  if (!configured) return null;
  const normalized = configured.replace(/\/+$/u, "");
  const endpoint = normalized.endsWith("/api/inference/stream")
    ? normalized
    : `${normalized}/api/inference/stream`;
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export class ChatApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatApiError";
  }
}

export async function requestChatStatus(
  signal: AbortSignal,
): Promise<ChatStatusResponse> {
  const endpoint = apiUrl("/api/chat/status");
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "GET",
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ChatApiError("챗봇 상태를 확인하지 못했습니다.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ChatApiError("챗봇 상태 응답을 읽지 못했습니다.");
  }

  if (
    !response.ok ||
    !isRecord(payload) ||
    (payload.status !== "online" && payload.status !== "offline") ||
    !isString(payload.checkedAt)
  ) {
    throw new ChatApiError("챗봇 상태를 확인하지 못했습니다.");
  }

  return {
    status: payload.status,
    checkedAt: payload.checkedAt,
  };
}

export async function requestChat(
  request: ChatRequest,
  signal: AbortSignal,
): Promise<ChatResponse> {
  const endpoint = apiUrl();
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ChatApiError(
      "채팅 서버에 연결하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.",
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ChatApiError("채팅 서버의 응답을 읽지 못했습니다.");
  }

  if (!response.ok) {
    const message =
      isRecord(payload) && isString(payload.message)
        ? payload.message
        : "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    throw new ChatApiError(message);
  }

  return parseChatResponse(payload);
}

export interface ChatStreamHandlers {
  onDelta: (text: string) => void;
  onMeta?: (meta: Readonly<Record<string, unknown>>) => void;
  onTool?: (execution: ChatToolExecution) => void;
}

interface SseEvent {
  event: string;
  data: string;
}

function parseSseBlock(block: string): SseEvent | null {
  let event = "";
  const data: string[] = [];

  for (const rawLine of block.replace(/^\uFEFF/u, "").split(/\r\n|\n|\r/u)) {
    if (!rawLine || rawLine.startsWith(":")) continue;
    const separator = rawLine.indexOf(":");
    const field = separator >= 0 ? rawLine.slice(0, separator) : rawLine;
    let value = separator >= 0 ? rawLine.slice(separator + 1) : "";
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    if (field === "data") data.push(value);
  }

  if (!event && data.length === 0) return null;
  if (!event || data.length === 0) {
    throw new ChatApiError("스트리밍 응답 형식을 확인할 수 없습니다.");
  }
  return { event, data: data.join("\n") };
}

function nextSseBlock(
  buffer: string,
): { block: string; rest: string } | null {
  const boundary = /\r\n\r\n|\n\n|\r\r/u.exec(buffer);
  if (!boundary || boundary.index === undefined) return null;
  return {
    block: buffer.slice(0, boundary.index),
    rest: buffer.slice(boundary.index + boundary[0].length),
  };
}

function parseEventData(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    throw new ChatApiError("스트리밍 응답 데이터를 읽지 못했습니다.");
  }
}

async function errorMessageFromResponse(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (isRecord(payload) && isString(payload.message)) return payload.message;
  } catch {
    // JSON 오류 응답이 아니면 공개용 고정 문구를 사용한다.
  }
  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

async function consumeSseResponse(
  response: Response,
  signal: AbortSignal,
  dispatch: (event: string, payload: unknown) => void,
): Promise<void> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("text/event-stream")) {
    throw new ChatApiError("채팅 서버가 스트리밍 응답을 반환하지 않았습니다.");
  }
  if (!response.body) {
    throw new ChatApiError("채팅 서버의 스트리밍 응답을 읽지 못했습니다.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatchBlock = (block: string) => {
    const parsed = parseSseBlock(block);
    if (!parsed) return;
    dispatch(parsed.event, parseEventData(parsed.data));
    if (signal.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
  };

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let next = nextSseBlock(buffer);
      while (next) {
        dispatchBlock(next.block);
        buffer = next.rest;
        next = nextSseBlock(buffer);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) dispatchBlock(buffer);
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

async function requestSitesChatStream(
  request: ChatRequest,
  signal: AbortSignal,
  handlers: ChatStreamHandlers,
): Promise<ChatResponse> {
  let response: Response;
  try {
    response = await fetch(apiUrl("/api/chat/stream"), {
      method: "POST",
      headers: {
        accept: "text/event-stream",
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ChatApiError(
      "채팅 서버에 연결하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.",
    );
  }

  if (!response.ok) {
    throw new ChatApiError(await errorMessageFromResponse(response));
  }
  let doneResponse: ChatResponse | null = null;

  await consumeSseResponse(response, signal, (event, payload) => {
    if (!["meta", "tool", "delta", "done", "error"].includes(event)) {
      throw new ChatApiError("지원하지 않는 스트리밍 이벤트를 받았습니다.");
    }
    if (doneResponse) {
      throw new ChatApiError("완료 이후 잘못된 스트리밍 이벤트를 받았습니다.");
    }
    if (event === "meta") {
      if (!isRecord(payload)) {
        throw new ChatApiError("스트리밍 메타데이터 형식을 확인할 수 없습니다.");
      }
      handlers.onMeta?.(payload);
      return;
    }
    if (event === "delta") {
      if (!isRecord(payload) || !isString(payload.text)) {
        throw new ChatApiError("스트리밍 본문 형식을 확인할 수 없습니다.");
      }
      // 화면 재생 속도와 무관하게 다음 SSE 이벤트를 즉시 읽는다.
      handlers.onDelta(payload.text);
      return;
    }
    if (event === "tool") {
      const execution = parseToolExecution(payload);
      if (!execution) {
        throw new ChatApiError("모델 도구 실행 형식을 확인할 수 없습니다.");
      }
      handlers.onTool?.(execution);
      return;
    }
    if (event === "error") {
      if (!isRecord(payload)) {
        throw new ChatApiError("스트리밍 오류 형식을 확인할 수 없습니다.");
      }
      throw new ChatApiError(
        isString(payload.message)
          ? payload.message
          : "응답 생성 중 오류가 발생했습니다.",
      );
    }
    doneResponse = parseChatResponse(payload);
  });
  if (!doneResponse) {
    throw new ChatApiError("완료되지 않은 스트리밍 응답을 받았습니다.");
  }
  return doneResponse;
}

async function finalizeDirectStream(
  body: Readonly<Record<string, string>>,
  signal: AbortSignal,
): Promise<ChatResponse> {
  let response: Response;
  try {
    response = await fetch(apiUrl("/api/chat/finalize"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ChatApiError("채팅 응답을 최종 확인하지 못했습니다.");
  }
  if (!response.ok) {
    throw new ChatApiError(await errorMessageFromResponse(response));
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ChatApiError("채팅 서버의 최종 응답을 읽지 못했습니다.");
  }
  return parseChatResponse(payload);
}

async function continueDirectToolCall(
  toolTicket: string,
  signal: AbortSignal,
): Promise<{
  ticket: string;
  requestId: string;
  toolExecution: ChatToolExecution;
}> {
  let response: Response;
  try {
    response = await fetch(apiUrl("/api/chat/tool"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toolTicket }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ChatApiError("모델 도구 실행 결과를 확인하지 못했습니다.");
  }
  if (!response.ok) {
    throw new ChatApiError(await errorMessageFromResponse(response));
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ChatApiError("모델 도구 실행 응답을 읽지 못했습니다.");
  }
  if (
    !isRecord(payload) ||
    !isString(payload.ticket) ||
    !isString(payload.requestId)
  ) {
    throw new ChatApiError("모델 도구 실행 응답 형식을 확인할 수 없습니다.");
  }
  const toolExecution = parseToolExecution(payload.toolExecution);
  if (!toolExecution) {
    throw new ChatApiError("모델 도구 실행 결과 형식을 확인할 수 없습니다.");
  }
  return {
    ticket: payload.ticket,
    requestId: payload.requestId,
    toolExecution,
  };
}

async function requestGatewayChatStream(
  gatewayEndpoint: string,
  request: ChatRequest,
  signal: AbortSignal,
  handlers: ChatStreamHandlers,
): Promise<ChatResponse> {
  let prepareResponse: Response;
  try {
    prepareResponse = await fetch(apiUrl("/api/chat/prepare"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ChatApiError("채팅 준비 요청을 전송하지 못했습니다.");
  }
  if (prepareResponse.status === 404 || prepareResponse.status === 503) {
    return requestSitesChatStream(request, signal, handlers);
  }
  if (!prepareResponse.ok) {
    throw new ChatApiError(await errorMessageFromResponse(prepareResponse));
  }

  let prepared: unknown;
  try {
    prepared = await prepareResponse.json();
  } catch {
    throw new ChatApiError("채팅 준비 응답을 읽지 못했습니다.");
  }
  if (
    !isRecord(prepared) ||
    !isString(prepared.ticket) ||
    !isString(prepared.requestId)
  ) {
    throw new ChatApiError("채팅 준비 응답 형식을 확인할 수 없습니다.");
  }

  handlers.onMeta?.({
    requestId: prepared.requestId,
    transport: "direct-inference-gateway",
  });
  let currentPrepareTicket = prepared.ticket;
  let resultTicket = "";
  let gatewayError: "upstream_unavailable" | "upstream_timeout" =
    "upstream_unavailable";

  try {
    for (let round = 0; round < 2; round += 1) {
      let toolTicket = "";
      const gatewayResponse = await fetch(gatewayEndpoint, {
        method: "POST",
        headers: {
          accept: "text/event-stream",
          "content-type": "application/json",
        },
        body: JSON.stringify({ ticket: currentPrepareTicket }),
        signal,
      });
      if (!gatewayResponse.ok) {
        throw new ChatApiError(await errorMessageFromResponse(gatewayResponse));
      }
      await consumeSseResponse(gatewayResponse, signal, (event, payload) => {
        if (event === "delta") {
          if (!isRecord(payload) || !isString(payload.text)) {
            throw new ChatApiError("추론 스트림 형식을 확인할 수 없습니다.");
          }
          handlers.onDelta(payload.text);
          return;
        }
        if (event === "tool_call") {
          if (round > 0 || !isRecord(payload) || !isString(payload.toolTicket)) {
            throw new ChatApiError("추론 도구 호출 형식을 확인할 수 없습니다.");
          }
          toolTicket = payload.toolTicket;
          return;
        }
        if (event === "done") {
          if (!isRecord(payload) || !isString(payload.resultTicket)) {
            throw new ChatApiError("추론 완료 응답 형식을 확인할 수 없습니다.");
          }
          resultTicket = payload.resultTicket;
          return;
        }
        if (event === "error") {
          if (isRecord(payload) && payload.error === "upstream_timeout") {
            gatewayError = "upstream_timeout";
          }
          throw new ChatApiError("추론 서버가 응답을 완료하지 못했습니다.");
        }
        throw new ChatApiError("지원하지 않는 추론 스트림 이벤트를 받았습니다.");
      });
      if (resultTicket) break;
      if (!toolTicket) {
        throw new ChatApiError("완료되지 않은 추론 응답을 받았습니다.");
      }
      const continuation = await continueDirectToolCall(toolTicket, signal);
      currentPrepareTicket = continuation.ticket;
      handlers.onTool?.(continuation.toolExecution);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
  }

  return resultTicket
    ? finalizeDirectStream({ resultTicket }, signal)
    : finalizeDirectStream(
        { prepareTicket: currentPrepareTicket, error: gatewayError },
        signal,
      );
}

export async function requestChatStream(
  request: ChatRequest,
  signal: AbortSignal,
  handlers: ChatStreamHandlers,
): Promise<ChatResponse> {
  const gatewayEndpoint = inferenceGatewayUrl();
  return gatewayEndpoint
    ? requestGatewayChatStream(gatewayEndpoint, request, signal, handlers)
    : requestSitesChatStream(request, signal, handlers);
}
