/**
 * 챗봇 백엔드와 실제로 통신하는 계층이다.
 *
 * 요청 조립, 시간 상한(전체·유휴), SSE 스트림 소비만 맡고, "받은 것이
 * 계약대로인가"는 순수 파서(`parse.ts`)에 위임한다. 두 관심사를 나눠 두면
 * 파서는 네트워크 없이 테스트할 수 있고, 이 파일은 취소·타임아웃처럼
 * 브라우저 API가 필요한 부분에만 집중할 수 있다.
 */
import {
  ChatApiError,
  isRecord,
  isString,
  parseChatResponse,
  parseEventData,
  parseSseBlock,
  parseToolExecution,
  nextSseBlock,
  retryAfterMsFromHeader,
  RATE_LIMITED_MESSAGE,
} from "./parse";
import type {
  ChatRequest,
  ChatResponse,
  ChatStatusResponse,
  ChatToolExecution,
} from "./types";

export { ChatApiError };
export type { ChatApiErrorOptions } from "./parse";

/** 요청 전체 상한. 도구 재시도까지 감안한 최악의 정상 응답보다 넉넉하다. */
const CHAT_STREAM_TOTAL_TIMEOUT_MS = 8 * 60 * 1_000;
/** 마지막으로 바이트를 받은 뒤 이만큼 조용하면 끊긴 것으로 본다. */
const CHAT_STREAM_IDLE_TIMEOUT_MS = 60 * 1_000;
const CHAT_STREAM_TIMEOUT_MESSAGE =
  "응답이 너무 오래 걸려 중단했어요. 다시 시도해 주세요.";

/**
 * 공개 RAG API의 절대 주소를 만든다.
 *
 * 주소는 빌드 시점 환경변수로만 들어오며, 비어 있으면 요청을 시도하지 않고
 * 사용자에게 보여 줄 수 있는 문구로 즉시 실패한다. 끝의 슬래시는 지워
 * `//api/chat` 같은 경로가 생기지 않게 한다.
 */
function apiUrl(path = "/api/chat"): string {
  const baseUrl = process.env.NEXT_PUBLIC_RAG_API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new ChatApiError(
      "채팅 서버 주소가 설정되지 않았습니다. 잠시 후 다시 이용해 주세요.",
    );
  }
  return `${baseUrl.replace(/\/+$/u, "")}${path}`;
}

/**
 * 429 응답을 재시도 대기 시간이 담긴 오류로 바꾼다.
 *
 * 화면은 code `rate_limited`로 분기해 남은 초를 세고 버튼을 잠근다.
 */
function rateLimitedError(response: Response): ChatApiError {
  return new ChatApiError(RATE_LIMITED_MESSAGE, {
    code: "rate_limited",
    retryAfterMs: retryAfterMsFromHeader(response.headers.get("retry-after")),
  });
}

/**
 * 추론 서버가 살아 있는지 확인한다.
 *
 * 호출한 쪽이 5초 타임아웃을 걸어 주고, 이 함수는 네트워크 실패·JSON 파싱
 * 실패·형식 불일치를 모두 같은 ChatApiError로 정규화한다. 사용자 중단
 * (AbortError)만 그대로 통과시켜 호출한 쪽이 상태를 덮어쓰지 않게 한다.
 */
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

/**
 * 스트리밍을 쓰지 않을 때의 단발 질문 요청이다.
 *
 * 응답 본문은 반드시 `parseChatResponse`를 통과해야 화면으로 나간다.
 * 429는 재시도 대기 정보를 담은 오류로, 그 밖의 실패는 서버가 준 message가
 * 있으면 그대로, 없으면 고정 문구로 바꿔 던진다.
 */
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
    if (response.status === 429) throw rateLimitedError(response);
    const message =
      isRecord(payload) && isString(payload.message)
        ? payload.message
        : "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    throw new ChatApiError(message);
  }

  return parseChatResponse(payload);
}

/** 스트리밍 도중 화면에 알려야 하는 사건들이다. */
export interface ChatStreamHandlers {
  onDelta: (text: string) => void;
  onMeta?: (meta: Readonly<Record<string, unknown>>) => void;
  onTool?: (execution: ChatToolExecution) => void;
}

/**
 * 오류 응답에서 사용자에게 보여 줄 문구를 뽑는다.
 *
 * JSON 오류가 아니거나 message가 없으면 내부 사정이 드러나지 않는 고정
 * 문구로 되돌린다.
 */
async function errorMessageFromResponse(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (isRecord(payload) && isString(payload.message)) return payload.message;
  } catch {
    // JSON 오류 응답이 아니면 공개용 고정 문구를 사용한다.
  }
  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

/**
 * 스트리밍 요청의 시간 상한을 관리한다.
 * 전체 상한과 유휴 상한을 하나의 신호로 합치고, 어떤 바이트든 도착하면
 * touch()로 유휴 타이머를 되감는다.
 */
interface StreamDeadline {
  readonly signal: AbortSignal;
  touch: () => void;
  /** 사용자 중단이 아니라 시간 초과로 끊겼는지 알려준다. */
  expired: () => boolean;
  dispose: () => void;
}

/**
 * 사용자 중단 신호에 전체·유휴 타임아웃을 합친 마감 신호를 만든다.
 *
 * 전체 상한(8분)은 처음부터 흐르고, 유휴 상한(60초)은 바이트가 도착할
 * 때마다 `touch()`로 되감긴다. keep-alive 주석처럼 내용 없는 수신도
 * "살아 있음"의 증거라 유휴 타이머를 되감는다.
 *
 * `expired()`는 사용자가 중단 버튼을 눌러 끊긴 경우와 시간이 다 되어 끊긴
 * 경우를 구분해 준다. 두 경우의 안내 문구가 달라야 하기 때문이다.
 * 다 쓰면 반드시 `dispose()`로 남은 타이머를 정리한다.
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
    expired: () => idleExpired || totalSignal.aborted,
    dispose: () => {
      if (idleTimer !== null) clearTimeout(idleTimer);
      idleTimer = null;
    },
  };
}

/** done 이벤트를 받으면 "stop"을 돌려 읽기 루프를 즉시 끝낸다. */
type SseDispatch = (event: string, payload: unknown) => "stop" | void;

/**
 * SSE 응답 본문을 끝까지 읽으며 블록 단위로 디스패치한다.
 *
 * content-type이 text/event-stream이 아니거나 body가 없으면 시작하지 않는다.
 * 네트워크 청크는 블록 한가운데를 자를 수 있으므로 버퍼에 이어 붙여
 * 완결된 블록만 넘긴다. 청크를 하나 읽을 때마다 `onActivity`를 불러 유휴
 * 타이머를 되감는다.
 *
 * done을 받으면 서버가 스트림을 닫기를 기다리지 않고 reader를 취소해
 * 대기를 끝낸다. 중간에 사용자 중단이 오면 AbortError를 던지고, 어떤
 * 경로로 끝나든 reader lock은 반드시 해제한다.
 */
async function consumeSseResponse(
  response: Response,
  signal: AbortSignal,
  dispatch: SseDispatch,
  onActivity?: () => void,
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
  let stopped = false;

  const dispatchBlock = (block: string): boolean => {
    const parsed = parseSseBlock(block);
    // 주석(keep-alive)과 event 없는 블록은 무시한다. 수신 자체가 생존 신호다.
    if (!parsed) return false;
    const stop = dispatch(parsed.event, parseEventData(parsed.data)) === "stop";
    if (signal.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    return stop;
  };

  try {
    while (!stopped) {
      const chunk = await reader.read();
      if (chunk.done) break;
      onActivity?.();
      buffer += decoder.decode(chunk.value, { stream: true });
      let next = nextSseBlock(buffer);
      while (next) {
        const stop = dispatchBlock(next.block);
        buffer = next.rest;
        if (stop) {
          stopped = true;
          break;
        }
        next = nextSseBlock(buffer);
      }
    }
    if (stopped) {
      // 완료 이벤트를 받았으면 서버가 스트림을 닫기를 기다리지 않는다.
      await reader.cancel().catch(() => undefined);
    } else {
      buffer += decoder.decode();
      if (buffer.trim()) dispatchBlock(buffer);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

/**
 * 스트리밍 질문 요청이다. delta를 흘려보내다 done에서 최종 응답을 돌려준다.
 *
 * 이벤트는 meta·tool·delta·done·error 다섯 가지만 받아들이고, 모르는
 * 이벤트가 오면 계약 위반으로 실패시킨다. delta는 화면 재생 속도와 무관하게
 * 즉시 핸들러로 넘겨 다음 이벤트를 계속 읽는다(재생 속도 조절은 화면 쪽
 * 렌더 큐가 맡는다).
 *
 * done 없이 스트림이 끝나면 "완료되지 않은 응답"으로 실패한다. 시간 초과로
 * 끊긴 경우에는 사용자 중단과 구분해 code `timeout`으로 알린다.
 */
export async function requestChatStream(
  request: ChatRequest,
  signal: AbortSignal,
  handlers: ChatStreamHandlers,
): Promise<ChatResponse> {
  const endpoint = apiUrl("/api/chat/stream");
  const deadline = createStreamDeadline(signal);

  try {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          accept: "text/event-stream",
          "content-type": "application/json",
        },
        body: JSON.stringify(request),
        signal: deadline.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      throw new ChatApiError(
        "채팅 서버에 연결하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.",
      );
    }
    deadline.touch();

    if (!response.ok) {
      // 400·413·429는 SSE를 열기 전이라 여전히 JSON으로 온다.
      if (response.status === 429) throw rateLimitedError(response);
      throw new ChatApiError(await errorMessageFromResponse(response));
    }
    let doneResponse: ChatResponse | null = null;

    await consumeSseResponse(
      response,
      signal,
      (event, payload) => {
        if (!["meta", "tool", "delta", "done", "error"].includes(event)) {
          throw new ChatApiError("지원하지 않는 스트리밍 이벤트를 받았습니다.");
        }
        if (event === "meta") {
          if (!isRecord(payload)) {
            throw new ChatApiError(
              "스트리밍 메타데이터 형식을 확인할 수 없습니다.",
            );
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
        return "stop";
      },
      deadline.touch,
    );
    if (!doneResponse) {
      throw new ChatApiError("완료되지 않은 스트리밍 응답을 받았습니다.");
    }
    return doneResponse;
  } catch (error) {
    // 사용자 중단이 아니라 시간 초과로 끊긴 경우를 구분해 알린다.
    if (deadline.expired() && !signal.aborted) {
      throw new ChatApiError(CHAT_STREAM_TIMEOUT_MESSAGE, { code: "timeout" });
    }
    throw error;
  } finally {
    deadline.dispose();
  }
}
