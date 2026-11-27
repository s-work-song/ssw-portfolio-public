/**
 * 채팅 API의 오류 타입과 SSE 이벤트 파서다.
 *
 * 브라우저 API도 React도 쓰지 않는 순수 모듈이라 `node --test`가 그대로 불러 검증한다.
 * 값 import에 `.ts` 확장자를 붙이는 이유도 같다(Node ESM 해석기는 확장자를 추측하지 않는다).
 */
import {
  PORTFOLIO_CHAT_TOOL_NAMES,
  isRecord,
  isString,
  type PortfolioChatToolName,
} from "../../portfolio-tools/schema.ts";

export { isRecord, isString };

/** 429 응답에서 사용자에게 보여줄 고정 문구다. */
export const RATE_LIMITED_MESSAGE = "요청이 많아 잠시 후 다시 시도해 주세요.";

/** 서버가 retry-after를 주지 않았을 때 쓰는 대기 시간이다. */
export const DEFAULT_RETRY_AFTER_MS = 10_000;

export interface ChatApiErrorOptions {
  /** 화면이 문구 대신 상황으로 분기할 때 쓰는 식별자다. 서버 오류 코드를 그대로 담는다. */
  code?: string;
  /** 429처럼 재시도까지 기다려야 하는 시간이다. */
  retryAfterMs?: number;
  /** HTTP 오류의 실제 상태다. SSE error 이벤트에는 없다. */
  httpStatus?: number;
  /** 같은 요청을 다시 보내도 되는 일시적 실패인지다. */
  retryable?: boolean;
}

/**
 * 챗봇 API 경로에서 사용자에게 보여줄 수 있는 실패를 표현하는 오류다.
 * message는 화면에 노출될 수 있으니 내부 사정이 드러나는 문구를 넣지 않는다.
 */
export class ChatApiError extends Error {
  readonly code?: string;
  readonly retryAfterMs?: number;
  readonly httpStatus?: number;
  readonly retryable: boolean;

  constructor(message: string, options: ChatApiErrorOptions = {}) {
    super(message);
    this.name = "ChatApiError";
    this.code = options.code;
    this.retryAfterMs = options.retryAfterMs;
    this.httpStatus = options.httpStatus;
    this.retryable = options.retryable === true;
  }
}

/**
 * retry-after 헤더 값을 재시도 대기 밀리초로 바꾼다.
 * 초 단위와 HTTP-date를 읽고 0도 보존한다.
 */
export function retryAfterMsFromHeader(
  header: string | null, now = Date.now(), fallback = DEFAULT_RETRY_AFTER_MS,
): number {
  const value = header?.trim();
  if (!value) return fallback;
  if (/^\d+(?:\.\d+)?$/u.test(value)) {
    const delay = Number(value) * 1_000;
    return Number.isFinite(delay) ? Math.ceil(delay) : fallback;
  }
  const date = /^[a-z]{3,9}[, ]/iu.test(value) ? Date.parse(value) : Number.NaN;
  return Number.isFinite(date) ? Math.max(0, date - now) : fallback;
}

/** SSE 블록 하나에서 뽑아낸 이벤트 이름과 데이터다. */
export interface SseEvent {
  event: string;
  data: string;
}

/**
 * SSE 블록(빈 줄로 구분된 한 덩어리)을 이벤트 이름과 데이터로 나눈다.
 * 주석(`:`)만 있는 블록과 event가 없는 블록은 null이다. keep-alive 주석이 여기에 해당한다.
 */
export function parseSseBlock(block: string): SseEvent | null {
  let event = "";
  const data: string[] = [];
  for (const rawLine of block.replace(/^﻿/u, "").split(/\r\n|\n|\r/u)) {
    if (!rawLine || rawLine.startsWith(":")) continue;
    const separator = rawLine.indexOf(":");
    const field = separator >= 0 ? rawLine.slice(0, separator) : rawLine;
    let value = separator >= 0 ? rawLine.slice(separator + 1) : "";
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    if (field === "data") data.push(value);
  }
  if (!event || data.length === 0) return null;
  return { event, data: data.join("\n") };
}

/** 버퍼 앞에서 완결된 SSE 블록 하나를 떼어낸다. 구분자가 아직 없으면 null이다. */
export function nextSseBlock(buffer: string): { block: string; rest: string } | null {
  const boundary = /\r\n\r\n|\n\n|\r\r/u.exec(buffer);
  if (!boundary) return null;
  return {
    block: buffer.slice(0, boundary.index),
    rest: buffer.slice(boundary.index + boundary[0].length),
  };
}

/** 브라우저가 실행할 도구 호출 하나다(UI 도구와 채팅 전용 선택지 도구). arguments는 실행기가 다시 엄격하게 검증한다. */
export interface BrowserToolCall {
  callId: string;
  name: PortfolioChatToolName;
  arguments: Record<string, unknown>;
}

export type ChatTurnStage = "answering" | "searching" | "working";

/** 서버 SSE 이벤트를 화면이 쓰는 형태로 정리한 값이다. */
export type ChatTurnEvent =
  | { type: "turn"; turnId: string }
  | { type: "status"; stage: ChatTurnStage }
  | { type: "delta"; text: string }
  | { type: "tool_request"; turnId: string; calls: BrowserToolCall[] }
  // 후속 질문은 부가 정보다. 파서는 늘 채우지만 이 필드를 모르는 서버·대역(테스트)도 받는다.
  | { type: "done"; turnId: string; answer: string; suggestedQuestions?: string[] }
  | { type: "error"; code: string; message: string; retryable: boolean };

const STAGES: readonly ChatTurnStage[] = ["answering", "searching", "working"];
const TURN_EVENTS: ReadonlySet<string> = new Set(["turn", "status", "delta", "tool_request", "done", "error"]);
const MAX_TOOL_CALLS = 20;
const MAX_SUGGESTED_QUESTIONS = 3;
const MAX_SUGGESTED_QUESTION_LENGTH = 120;

/** 답변 아래 띄울 후속 질문이다. 부가 정보라 형식이 어긋나면 답변을 실패시키지 않고 빈 목록으로 본다. */
function parseSuggestedQuestions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((question): question is string => isString(question) && question.trim().length > 0
      && question.length <= MAX_SUGGESTED_QUESTION_LENGTH)
    .map(question => question.trim())
    .slice(0, MAX_SUGGESTED_QUESTIONS);
}

function invalid(): ChatApiError {
  return new ChatApiError("채팅 서버 응답 형식이 올바르지 않습니다.", { code: "invalid_response" });
}

function parseToolCall(value: unknown): BrowserToolCall {
  if (!isRecord(value) || !isString(value.callId) || !value.callId || value.callId.length > 200
    || !isString(value.name) || !(PORTFOLIO_CHAT_TOOL_NAMES as readonly string[]).includes(value.name)
    || !isRecord(value.arguments) || Array.isArray(value.arguments)) {
    throw invalid();
  }
  return { callId: value.callId, name: value.name as PortfolioChatToolName, arguments: { ...value.arguments } };
}

/**
 * SSE 블록 하나를 이벤트로 읽는다. 모르는 이벤트 이름은 null로 건너뛰고,
 * 아는 이벤트의 데이터가 계약과 다르면 실패로 끝낸다.
 */
export function parseTurnEvent(sse: SseEvent): ChatTurnEvent | null {
  // 서버가 나중에 더할 이벤트는 데이터 형식과 무관하게 건너뛴다.
  if (!TURN_EVENTS.has(sse.event)) return null;
  let data: unknown;
  try { data = JSON.parse(sse.data); } catch { throw invalid(); }
  if (!isRecord(data)) throw invalid();
  switch (sse.event) {
    case "turn":
      if (!isString(data.turnId)) throw invalid();
      return { type: "turn", turnId: data.turnId };
    case "status":
      if (!STAGES.includes(data.stage as ChatTurnStage)) throw invalid();
      return { type: "status", stage: data.stage as ChatTurnStage };
    case "delta":
      if (!isString(data.text)) throw invalid();
      return { type: "delta", text: data.text };
    case "tool_request":
      if (!isString(data.turnId) || !Array.isArray(data.calls) || !data.calls.length
        || data.calls.length > MAX_TOOL_CALLS) throw invalid();
      return { type: "tool_request", turnId: data.turnId, calls: data.calls.map(parseToolCall) };
    case "done":
      if (!isString(data.turnId) || !isString(data.answer)) throw invalid();
      return {
        type: "done", turnId: data.turnId, answer: data.answer,
        suggestedQuestions: parseSuggestedQuestions(data.suggestedQuestions),
      };
    case "error":
      return {
        type: "error",
        code: isString(data.code) && /^[a-z][a-z0-9_]{0,63}$/u.test(data.code) ? data.code : "internal_error",
        message: isString(data.message) && data.message ? data.message.slice(0, 300) : "응답을 완료하지 못했습니다.",
        retryable: data.retryable === true,
      };
    default:
      return null;
  }
}
