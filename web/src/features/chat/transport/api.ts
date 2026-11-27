/**
 * 챗봇 백엔드와 실제로 통신하는 계층이다.
 *
 * 서버의 채팅 하나는 메인·작업 두 세션을 갖고, 대화 이력은 서버가 보관한다.
 * 브라우저는 질문 원문과 현재 화면 상태(clientState)만 보내고, 서버가 브라우저 도구를
 * 요청하면 실행 결과를 tool-results로 돌려준다. 이 파일은 요청 조립, 시간 상한, SSE
 * 소비만 맡고 이벤트의 계약 검사는 `sse.ts`에 위임한다.
 */
import {
  ChatApiError,
  RATE_LIMITED_MESSAGE,
  isRecord,
  isString,
  nextSseBlock,
  parseSseBlock,
  parseTurnEvent,
  retryAfterMsFromHeader,
  type BrowserToolCall,
  type ChatTurnEvent,
} from "./sse";
import type { ChatPortfolioViewState, ChatStatusResponse, ChatUiSettings } from "../types";

export { ChatApiError };

/** 요청 한 구간의 전체 상한. 도구 대기·여러 모델 호출을 감안해 넉넉하다. */
const CHAT_STREAM_TOTAL_TIMEOUT_MS = 8 * 60 * 1_000;
/** 마지막으로 바이트를 받은 뒤 이만큼 조용하면 끊긴 것으로 본다(서버 heartbeat는 10초). */
const CHAT_STREAM_IDLE_TIMEOUT_MS = 60 * 1_000;

/** 서버가 발급한 채팅 접근 권한이다. 브라우저 메모리에만 둔다. */
export interface ChatSession {
  sessionId: string;
  token: string;
}

/** 요청마다 함께 보내는 현재 화면 상태다. 작업 세션의 조회 도구가 이 값으로 답한다. */
export interface ChatClientState {
  uiSettings: ChatUiSettings | null;
  viewState: ChatPortfolioViewState | null;
}

export interface BrowserToolResult {
  callId: string;
  ok: boolean;
  output: Record<string, unknown>;
}

/** 한 구간이 끝난 방식이다. tool_request면 브라우저가 실행한 뒤 이어 간다. */
export type ChatTurnOutcome =
  | Extract<ChatTurnEvent, { type: "done" }>
  | { type: "tool_request"; turnId: string; calls: BrowserToolCall[] };

/** 공개 API의 절대 주소를 만든다. 주소는 빌드 시점 환경변수로만 들어온다. */
function apiUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_RAG_API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new ChatApiError("채팅 서버 주소가 설정되지 않았습니다. 잠시 후 다시 이용해 주세요.");
  }
  return `${baseUrl.replace(/\/+$/u, "")}${path}`;
}

function sessionPath(session: ChatSession, action: "turns" | "tool-results" | "close"): string {
  return `/api/chat/sessions/${encodeURIComponent(session.sessionId)}/${action}`;
}

/** JSON/SSE를 열기 전의 HTTP 실패를 같은 오류 형식으로 바꾼다. */
async function errorFromHttpResponse(response: Response): Promise<ChatApiError> {
  let payload: unknown;
  try { payload = await response.json(); } catch { /* HTML 오류에도 실제 HTTP 상태는 보존한다. */ }
  const code = isRecord(payload) && isString(payload.error) && /^[a-z][a-z0-9_]{0,63}$/u.test(payload.error)
    ? payload.error : response.status === 429 ? "rate_limited" : undefined;
  const message = response.status === 429 ? RATE_LIMITED_MESSAGE
    : isRecord(payload) && isString(payload.message) ? payload.message.slice(0, 300)
    : "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  return new ChatApiError(message, {
    code,
    httpStatus: response.status,
    retryable: response.status === 429 || response.status >= 500,
    ...(response.status === 429 ? { retryAfterMs: retryAfterMsFromHeader(response.headers.get("retry-after")) } : {}),
  });
}

async function postJson(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(apiUrl(path), {
      method: "POST", credentials: "omit", redirect: "error", cache: "no-store", ...init,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    if (error instanceof ChatApiError) throw error;
    throw new ChatApiError("채팅 서버에 연결하지 못했습니다.", { code: "network", retryable: true });
  }
}

/**
 * 추론 서버가 살아 있는지 확인한다. 역할 모델이 빠진 `degraded`는 오프라인으로 본다.
 * 사용자 중단(AbortError)만 그대로 통과시킨다.
 */
export async function requestChatStatus(signal: AbortSignal): Promise<ChatStatusResponse> {
  let response: Response;
  try {
    response = await fetch(apiUrl("/api/chat/status"), { method: "GET", cache: "no-store", signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ChatApiError("챗봇 상태를 확인하지 못했습니다.");
  }
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new ChatApiError("챗봇 상태 응답을 읽지 못했습니다."); }
  if (!response.ok || !isRecord(payload) || !isString(payload.checkedAt)
    || !["online", "offline", "degraded"].includes(payload.status as string)) {
    throw new ChatApiError("챗봇 상태를 확인하지 못했습니다.");
  }
  return { status: payload.status === "online" ? "online" : "offline", checkedAt: payload.checkedAt };
}

/** 새 채팅(메인·작업 세션)을 만든다. */
export async function createChatSession(signal: AbortSignal): Promise<ChatSession> {
  const response = await postJson("/api/chat/sessions", { signal });
  if (!response.ok) throw await errorFromHttpResponse(response);
  let payload: unknown;
  try { payload = await response.json(); } catch { payload = null; }
  if (!isRecord(payload) || !isString(payload.sessionId) || !/^[0-9a-f]{32}$/u.test(payload.sessionId)
    || !isString(payload.token) || !payload.token) {
    throw new ChatApiError("대화를 시작하지 못했습니다.", { code: "invalid_response" });
  }
  return { sessionId: payload.sessionId, token: payload.token };
}

/**
 * 채팅을 닫는다. 페이지를 떠날 때도 보내지도록 keepalive로 보낸다.
 * 토큰을 본문(text/plain)에 실어 CORS 사전 요청 없이 전송하며, 실패해도 서버 TTL이 정리한다.
 */
export function closeChatSession(session: ChatSession): void {
  try {
    void fetch(apiUrl(sessionPath(session, "close")), {
      method: "POST", credentials: "omit", cache: "no-store", keepalive: true,
      headers: { "content-type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ token: session.token }),
    }).catch(() => undefined);
  } catch { /* 주소 미설정 등은 무시한다. */ }
}

/** 사용자 질문으로 새 턴을 시작한다. */
export function streamChatTurn(
  session: ChatSession,
  body: { message: string; clientState: ChatClientState },
  signal: AbortSignal,
  onEvent: (event: ChatTurnEvent) => void,
): Promise<ChatTurnOutcome> {
  return postSse(sessionPath(session, "turns"), session, body, signal, onEvent);
}

/** 브라우저 도구 실행 결과를 보내고 같은 턴을 이어 간다. */
export function streamChatToolResults(
  session: ChatSession,
  body: { turnId: string; results: BrowserToolResult[]; clientState: ChatClientState },
  signal: AbortSignal,
  onEvent: (event: ChatTurnEvent) => void,
): Promise<ChatTurnOutcome> {
  return postSse(sessionPath(session, "tool-results"), session, body, signal, onEvent);
}

/**
 * SSE 구간 하나를 읽는다. delta·status·turn은 onEvent로 흘려보내고, done이나
 * tool_request가 오면 그 값으로 끝난다. error 이벤트는 ChatApiError로 던진다.
 */
async function postSse(
  path: string,
  session: ChatSession,
  body: unknown,
  signal: AbortSignal,
  onEvent: (event: ChatTurnEvent) => void,
): Promise<ChatTurnOutcome> {
  const deadline = createStreamDeadline(signal);
  try {
    const response = await postJson(path, {
      headers: { "content-type": "application/json", accept: "text/event-stream", authorization: `Bearer ${session.token}` },
      body: JSON.stringify(body),
      signal: deadline.signal,
    });
    if (!response.ok) throw await errorFromHttpResponse(response);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("text/event-stream") || !response.body) {
      throw new ChatApiError("채팅 서버가 스트리밍 응답을 반환하지 않았습니다.", { code: "invalid_response" });
    }
    return await consumeTurnStream(response.body, deadline, onEvent);
  } catch (error) {
    if (deadline.expired()) {
      throw new ChatApiError("응답이 너무 오래 걸려 중단했어요. 다시 시도해 주세요.", { code: "timeout", retryable: true });
    }
    throw error;
  } finally {
    deadline.dispose();
  }
}

async function consumeTurnStream(
  body: ReadableStream<Uint8Array>,
  deadline: StreamDeadline,
  onEvent: (event: ChatTurnEvent) => void,
): Promise<ChatTurnOutcome> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const handle = (block: string): ChatTurnOutcome | null => {
    if (deadline.signal.aborted) throw new DOMException("The operation was aborted.", "AbortError");
    const sse = parseSseBlock(block);
    const event = sse ? parseTurnEvent(sse) : null;
    if (!event) return null;
    if (event.type === "done" || event.type === "tool_request") return event;
    if (event.type === "error") {
      throw new ChatApiError(event.message, { code: event.code, retryable: event.retryable });
    }
    onEvent(event);
    return null;
  };
  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try { chunk = await reader.read(); } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        if (deadline.signal.aborted) throw new DOMException("The operation was aborted.", "AbortError");
        throw new ChatApiError("채팅 스트림 연결이 끊겼습니다.", { code: "network", retryable: true });
      }
      if (chunk.done) break;
      deadline.touch();
      buffer += decoder.decode(chunk.value, { stream: true });
      let next = nextSseBlock(buffer);
      while (next) {
        buffer = next.rest;
        const outcome = handle(next.block);
        if (outcome) return outcome;
        next = nextSseBlock(buffer);
      }
    }
    buffer += decoder.decode();
    const outcome = buffer.trim() ? handle(buffer) : null;
    if (outcome) return outcome;
    throw new ChatApiError("응답이 완료되지 않았습니다.", { code: "stream_incomplete", retryable: true });
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

interface StreamDeadline {
  signal: AbortSignal;
  touch: () => void;
  expired: () => boolean;
  dispose: () => void;
}

/**
 * 사용자 중단 신호에 전체·유휴 타임아웃을 합친 마감 신호를 만든다.
 * 유휴 상한은 바이트가 도착할 때마다(heartbeat 주석 포함) 되감긴다.
 */
function createStreamDeadline(signal: AbortSignal): StreamDeadline {
  const totalSignal = AbortSignal.timeout(CHAT_STREAM_TOTAL_TIMEOUT_MS);
  const idleController = new AbortController();
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let idleExpired = false;
  const touch = () => {
    if (idleTimer !== null) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleTimer = null;
      idleExpired = true;
      idleController.abort();
    }, CHAT_STREAM_IDLE_TIMEOUT_MS);
  };
  touch();
  return {
    signal: AbortSignal.any([signal, totalSignal, idleController.signal]),
    touch,
    expired: () => !signal.aborted && (idleExpired || totalSignal.aborted),
    dispose: () => {
      if (idleTimer !== null) clearTimeout(idleTimer);
      idleTimer = null;
    },
  };
}
