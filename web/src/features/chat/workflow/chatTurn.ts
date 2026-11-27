/**
 * 사용자 질문 한 번(턴)을 끝까지 진행한다.
 *
 * 서버가 tool_request로 멈추면 브라우저에서 도구를 실행하고 tool-results로 이어 간다.
 * done이 올 때까지 반복한다. 대화 이력은 서버가 보관하므로 여기서는 질문 원문과
 * 현재 화면 상태만 보낸다. React와 DOM을 모르는 순수 흐름이라 의존성을 주입받는다.
 */
import type { BrowserToolCall, ChatTurnEvent } from "../transport/sse.ts";
import { ChatApiError } from "../transport/sse.ts";
import type {
  BrowserToolResult,
  ChatClientState,
  ChatSession,
  ChatTurnOutcome,
} from "../transport/api.ts";

export interface ChatTurnApi {
  createSession(signal: AbortSignal): Promise<ChatSession>;
  streamTurn(session: ChatSession, body: { message: string; clientState: ChatClientState },
    signal: AbortSignal, onEvent: (event: ChatTurnEvent) => void): Promise<ChatTurnOutcome>;
  streamToolResults(session: ChatSession,
    body: { turnId: string; results: BrowserToolResult[]; clientState: ChatClientState },
    signal: AbortSignal, onEvent: (event: ChatTurnEvent) => void): Promise<ChatTurnOutcome>;
}

export interface ChatTurnOptions {
  api: ChatTurnApi;
  message: string;
  signal: AbortSignal;
  /** 지금 쓰는 채팅. 없으면 새로 만든다. */
  getSession(): ChatSession | null;
  setSession(session: ChatSession | null): void;
  /** 요청을 보내는 순간의 화면 상태를 읽는다. 도구 실행 뒤에는 바뀐 상태가 실린다. */
  clientState(): ChatClientState;
  onEvent(event: ChatTurnEvent): void;
  /** 서버가 요청한 브라우저 도구를 순서대로 실행하고 결과를 돌려준다. */
  runTools(calls: BrowserToolCall[], signal: AbortSignal): Promise<BrowserToolResult[]>;
  /** 기존 채팅이 만료돼 새 채팅으로 이어 갈 때 알린다. */
  onSessionRenewed(): void;
}

export interface ChatTurnResult {
  answer: string;
  /** 답변 아래 띄울 후속 질문(서버가 고른다). 없으면 빈 배열이다. */
  suggestedQuestions: string[];
}

/** 이 턴에서 브라우저 도구를 한 번이라도 실행했는지 실패 오류에 함께 싣는다. */
export class ChatTurnError extends ChatApiError {
  readonly toolsExecuted: boolean;
  constructor(cause: ChatApiError, toolsExecuted: boolean) {
    super(cause.message, {
      code: cause.code, httpStatus: cause.httpStatus, retryable: cause.retryable, retryAfterMs: cause.retryAfterMs,
    });
    this.name = "ChatTurnError";
    this.toolsExecuted = toolsExecuted;
  }
}

function isSessionMissing(error: unknown): boolean {
  return error instanceof ChatApiError && error.httpStatus === 404 && error.code === "session_not_found";
}

export async function runChatTurn(options: ChatTurnOptions): Promise<ChatTurnResult> {
  const { api, message, signal } = options;
  let toolsExecuted = false;
  try {
    let session = options.getSession();
    let outcome: ChatTurnOutcome;
    if (!session) {
      session = await api.createSession(signal);
      options.setSession(session);
      outcome = await api.streamTurn(session, { message, clientState: options.clientState() }, signal, options.onEvent);
    } else {
      try {
        outcome = await api.streamTurn(session, { message, clientState: options.clientState() }, signal, options.onEvent);
      } catch (error) {
        // 서버 재시작·만료로 채팅이 사라졌다. 턴 시작 시점에만 새 채팅으로 한 번 다시 보낸다.
        if (!isSessionMissing(error)) throw error;
        options.setSession(null);
        session = await api.createSession(signal);
        options.setSession(session);
        options.onSessionRenewed();
        outcome = await api.streamTurn(session, { message, clientState: options.clientState() }, signal, options.onEvent);
      }
    }
    while (outcome.type === "tool_request") {
      toolsExecuted = true;
      const results = await options.runTools(outcome.calls, signal);
      if (signal.aborted) throw new DOMException("The operation was aborted.", "AbortError");
      outcome = await api.streamToolResults(session, {
        turnId: outcome.turnId, results, clientState: options.clientState(),
      }, signal, options.onEvent);
    }
    return { answer: outcome.answer, suggestedQuestions: outcome.suggestedQuestions ?? [] };
  } catch (error) {
    if (error instanceof ChatApiError) {
      if (isSessionMissing(error)) options.setSession(null);
      throw new ChatTurnError(error, toolsExecuted);
    }
    throw error;
  }
}
