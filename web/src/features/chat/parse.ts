/**
 * 챗봇 서버가 보낸 바이트를 화면이 쓰는 값으로 바꾸는 순수 파서 모듈이다.
 *
 * `api.ts`가 네트워크·타임아웃·SSE 소비를 맡고, 이 파일은 "받은 것이
 * 계약대로인가"만 판정한다. 브라우저 API도 React도 쓰지 않아 `node --test`가
 * 그대로 불러 검증할 수 있고, 그래서 파서에 회귀가 생기면 빌드 없이 잡힌다.
 *
 * 값 import에 `.ts` 확장자를 붙인 이유: 이 파일을 테스트가 Node로 직접 불러
 * 실행하는데, Node의 ESM 해석기는 확장자 없는 상대 경로를 찾지 못한다.
 * (tsconfig의 `allowImportingTsExtensions`가 이 표기를 허용한다.)
 */
import {
  ACTION_IDS,
  ACTION_LABELS,
  DEFAULT_CHAT_STREAM_ANIMATION,
  TONES,
} from "./constants.ts";
import {
  ACCENTS,
  CHAT_FONTS,
  CHAT_FONT_SIZES,
  CHAT_LAYOUTS,
  CHAT_STREAM_ANIMATIONS,
  PORTFOLIO_PAGE_IDS,
  PORTFOLIO_RESEARCH_TABS,
  PORTFOLIO_RESEARCH_YEARS,
  PORTFOLIO_VIEW_ACTIONS,
  THEMES,
  THEME_MODES,
  YEAR_DETAIL_ACTIONS,
  isAllowed,
  isRecord,
  isString,
} from "../portfolio-tools/schema.ts";
import type {
  ActionId,
  ApiAudience,
  ChatAction,
  ChatPortfolioViewAction,
  ChatPortfolioViewState,
  ChatResponse,
  ChatSegment,
  ChatToolExecution,
  ChatUiToolOutcome,
  PageContext,
} from "./types";

export { isAllowed, isRecord, isString };

/**
 * 한 응답에서 적용할 도구 실행 상한이다. 스트리밍 경로와 비스트리밍 경로가
 * 같은 값을 쓰도록 한곳에서 정의한다.
 */
export const MAX_TOOL_EXECUTIONS = 8;

/** 429 응답에서 사용자에게 보여줄 고정 문구다. */
export const RATE_LIMITED_MESSAGE =
  "요청이 많아 잠시 후 다시 시도해 주세요.";

/** 서버가 retry-after를 주지 않았을 때 쓰는 대기 시간이다. */
export const DEFAULT_RETRY_AFTER_MS = 10_000;

/** 서버가 비정상적으로 긴 대기를 요구해도 이 값을 넘기지 않는다. */
export const MAX_RETRY_AFTER_MS = 5 * 60 * 1_000;

/** 응답의 audience 필드가 가질 수 있는 값이다. */
const API_AUDIENCES: readonly ApiAudience[] = [
  "default",
  "hiring",
  "developer",
  "collaboration",
  "casual",
];

/**
 * done 페이로드의 uiToolOutcome이 가질 수 있는 값이다.
 * 목록 밖의 값과 부재는 모두 "보고 없음"으로 본다(옛 서버와의 호환).
 */
const UI_TOOL_OUTCOMES: readonly ChatUiToolOutcome[] = [
  "called",
  "not_called",
  "not_required",
];

/** 응답의 pageContext 필드가 가질 수 있는 값이다. */
const PAGE_CONTEXTS: readonly PageContext[] = [
  "default",
  "overview",
  "resume",
  "cover_letter",
  "research",
  "log",
];

export interface ChatApiErrorOptions {
  /** 화면이 문구 대신 상황으로 분기할 때 쓰는 식별자다. */
  code?: string;
  /** 429처럼 재시도까지 기다려야 하는 시간이다. */
  retryAfterMs?: number;
}

/**
 * 챗봇 API 경로에서 사용자에게 보여줄 수 있는 실패를 표현하는 오류다.
 *
 * 파서와 요청 계층이 같은 오류 타입을 던져야 화면이 한 곳에서 분기할 수 있어,
 * 순수 파서 쪽에 두고 `api.ts`가 재수출한다. message는 그대로 화면에 노출되니
 * 내부 사정이 드러나는 문구를 넣지 않는다.
 */
export class ChatApiError extends Error {
  readonly code?: string;
  readonly retryAfterMs?: number;

  constructor(message: string, options: ChatApiErrorOptions = {}) {
    super(message);
    this.name = "ChatApiError";
    this.code = options.code;
    this.retryAfterMs = options.retryAfterMs;
  }
}

/**
 * retry-after 헤더 값을 재시도 대기 밀리초로 바꾼다.
 *
 * 헤더가 없거나 숫자가 아니거나 0 이하면 기본 대기(10초)를 쓰고, 서버가 아주
 * 큰 값을 보내도 5분에서 자른다. 화면의 카운트다운이 무한정 잠기지 않게 하는
 * 안전장치다. 헤더 문자열만 받으므로 Response 객체 없이 검증할 수 있다.
 */
export function retryAfterMsFromHeader(header: string | null): number {
  const seconds = header?.trim() ? Number(header.trim()) : Number.NaN;
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_RETRY_AFTER_MS;
  return Math.min(Math.round(seconds * 1_000), MAX_RETRY_AFTER_MS);
}

/** 도구 실행 식별자가 계약대로인지 확인한다(1~128자 문자열). */
function isToolCallId(value: unknown): value is string {
  return isString(value) && value.length >= 1 && value.length <= 128;
}

/**
 * 응답이 제안한 이동 액션 하나를 검증한다.
 *
 * id는 프런트가 아는 액션 목록 안에 있어야 하고, label까지 프런트가 정의한
 * 문구와 같아야 통과한다. 서버가 임의 문구를 버튼 이름으로 밀어 넣지
 * 못하게 하는 것이 목적이다. 어긋나면 null을 돌려 그 액션만 버린다.
 */
export function parseAction(value: unknown): ChatAction | null {
  if (!isRecord(value) || !isAllowed(value.id, ACTION_IDS)) return null;
  const id = value.id as ActionId;
  if (!isString(value.label) || value.label !== ACTION_LABELS[id]) return null;
  return { id, label: value.label };
}

/**
 * 답변 문단 하나(markdown + 관련 액션)를 검증한다.
 *
 * markdown이 문자열이 아니거나 actions가 배열이 아니면 문단 자체를 버린다.
 * 액션은 문단당 최대 2개까지만 남겨 버튼이 문단을 뒤덮지 않게 한다.
 */
export function parseSegment(value: unknown): ChatSegment | null {
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

/**
 * 이어서 물어볼 질문 목록을 다듬는다.
 *
 * 문자열이 아니거나 너무 짧고(4자 미만) 긴(120자 초과) 질문, NFKC 정규화 후
 * 대소문자를 무시했을 때 중복인 질문을 걸러 최대 4개만 남긴다. 배열이 아니면
 * 빈 배열이다(구버전 응답과의 호환).
 */
export function parseSuggestedQuestions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const questions: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isString(item)) continue;
    const question = item.trim();
    const key = question.normalize("NFKC").toLowerCase();
    if (question.length < 4 || question.length > 120 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    questions.push(question);
    if (questions.length >= 4) break;
  }
  return questions;
}

/**
 * 서버가 되돌려준 "현재 화면 상태" 보고를 검증한다.
 *
 * page·researchTab·researchYear는 모두 허용 목록 안이어야 하고,
 * researchDetails의 펼침 수는 정수이면서 전체 수를 넘지 않아야 한다.
 * 연도 배열에 목록 밖 값이 하나라도 섞이면(길이 비교로 확인) 통째로 버린다.
 * 하나라도 어긋나면 null이라 화면 상태 보고가 통째로 무시된다.
 */
export function parsePortfolioViewState(
  value: unknown,
): ChatPortfolioViewState | null {
  if (
    !isRecord(value) ||
    !isAllowed(value.page, PORTFOLIO_PAGE_IDS) ||
    !(value.anchor === null || isString(value.anchor)) ||
    !(
      value.researchTab === undefined ||
      value.researchTab === null ||
      isAllowed(value.researchTab, PORTFOLIO_RESEARCH_TABS)
    ) ||
    !(
      value.researchYear === null ||
      isAllowed(value.researchYear, PORTFOLIO_RESEARCH_YEARS)
    )
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
    researchTab: value.researchTab ?? null,
    researchYear: value.researchYear,
    researchDetails,
  };
}

/**
 * 서버 모델이 실행한 화면 도구 하나를 검증한다.
 *
 * 타입별로 필요한 필드와 허용값을 모두 확인하고, 하나라도 어긋나면 null을
 * 돌려 그 도구 실행만 조용히 버린다. 허용 목록은 WebMCP 도구와 같은
 * `portfolio-tools/schema`에서 가져오므로 두 경로의 판정이 갈라지지 않는다.
 * 통과한 값만 실제 테마·라우팅 변경으로 이어지므로 이 함수가 신뢰 경계다.
 */
export function parseToolExecution(value: unknown): ChatToolExecution | null {
  if (!isRecord(value) || !isToolCallId(value.toolCallId)) return null;
  const toolCallId = value.toolCallId;

  switch (value.type) {
    case "report_portfolio_view_state": {
      if (value.toolName !== "get-portfolio-view-state") return null;
      if (typeof value.available !== "boolean") return null;
      const viewState =
        value.viewState === null ? null : parsePortfolioViewState(value.viewState);
      // 서버가 "읽었다"고 말했는데 상태가 없거나, 그 반대면 보고가 깨진 것이다.
      if (value.available !== Boolean(viewState)) return null;
      return {
        type: "report_portfolio_view_state",
        toolCallId,
        toolName: "get-portfolio-view-state",
        available: value.available,
        viewState,
      };
    }
    case "control_portfolio_view": {
      if (value.toolName !== "control-portfolio-view") return null;
      if (!isAllowed(value.action, PORTFOLIO_VIEW_ACTIONS)) return null;
      const action = value.action as ChatPortfolioViewAction;
      const requiresYear = (YEAR_DETAIL_ACTIONS as readonly string[]).includes(
        action,
      );
      const year = isAllowed(value.year, PORTFOLIO_RESEARCH_YEARS)
        ? value.year
        : undefined;
      if ((requiresYear && !year) || (!requiresYear && value.year !== undefined)) {
        return null;
      }
      return {
        type: "control_portfolio_view",
        toolCallId,
        toolName: "control-portfolio-view",
        action,
        ...(year ? { year } : {}),
      };
    }
    case "open_portfolio_settings": {
      if (value.toolName !== "open-portfolio-settings") return null;
      return {
        type: "open_portfolio_settings",
        toolCallId,
        toolName: "open-portfolio-settings",
      };
    }
    case "report_portfolio_ui_settings": {
      if (value.toolName !== "get-portfolio-ui-settings") return null;
      if (typeof value.available !== "boolean") return null;
      const raw = value.uiSettings;
      if (raw === null) {
        return {
          type: "report_portfolio_ui_settings",
          toolCallId,
          toolName: "get-portfolio-ui-settings",
          available: value.available,
          uiSettings: null,
        };
      }
      if (
        !isRecord(raw) ||
        !isAllowed(raw.theme, THEME_MODES) ||
        !isAllowed(raw.accent, ACCENTS) ||
        !isAllowed(raw.chatLayout, CHAT_LAYOUTS) ||
        !isAllowed(raw.chatFont, CHAT_FONTS) ||
        !isAllowed(raw.chatFontSize, CHAT_FONT_SIZES) ||
        !(
          raw.streamAnimation === undefined ||
          isAllowed(raw.streamAnimation, CHAT_STREAM_ANIMATIONS)
        )
      ) {
        return null;
      }
      return {
        type: "report_portfolio_ui_settings",
        toolCallId,
        toolName: "get-portfolio-ui-settings",
        available: value.available,
        uiSettings: {
          theme: raw.theme,
          accent: raw.accent,
          chatLayout: raw.chatLayout,
          chatFont: raw.chatFont,
          chatFontSize: raw.chatFontSize,
          // 연출을 보고하지 않는 옛 서버 응답도 계속 읽는다.
          streamAnimation: isAllowed(
            raw.streamAnimation,
            CHAT_STREAM_ANIMATIONS,
          )
            ? raw.streamAnimation
            : DEFAULT_CHAT_STREAM_ANIMATION,
        },
      };
    }
    case "set_portfolio_theme": {
      if (value.toolName !== "set-portfolio-theme") return null;
      if (!isAllowed(value.theme, THEMES)) return null;
      return {
        type: "set_portfolio_theme",
        toolCallId,
        toolName: "set-portfolio-theme",
        theme: value.theme,
      };
    }
    case "set_portfolio_accent": {
      if (value.toolName !== "set-portfolio-accent") return null;
      if (!isAllowed(value.accent, ACCENTS)) return null;
      return {
        type: "set_portfolio_accent",
        toolCallId,
        toolName: "set-portfolio-accent",
        accent: value.accent,
      };
    }
    case "cycle_portfolio_accent": {
      if (value.toolName !== "cycle-portfolio-accent") return null;
      // 색을 하나씩 훑는 연출이라 "모든 색이 한 번씩" 들어와야 의미가 있다.
      if (
        !Array.isArray(value.accents) ||
        value.accents.length !== ACCENTS.length ||
        !value.accents.every((accent) => isAllowed(accent, ACCENTS)) ||
        new Set(value.accents).size !== ACCENTS.length
      ) {
        return null;
      }
      // 너무 짧으면 깜빡임, 너무 길면 답변이 멈춘 것처럼 보인다.
      if (
        !Number.isInteger(value.stepMs) ||
        Number(value.stepMs) < 100 ||
        Number(value.stepMs) > 2_000
      ) {
        return null;
      }
      return {
        type: "cycle_portfolio_accent",
        toolCallId,
        toolName: "cycle-portfolio-accent",
        accents: value.accents as Array<(typeof ACCENTS)[number]>,
        stepMs: Number(value.stepMs),
      };
    }
    case "set_portfolio_chat_layout": {
      if (value.toolName !== "set-portfolio-chat-layout") return null;
      if (!isAllowed(value.layout, CHAT_LAYOUTS)) return null;
      return {
        type: "set_portfolio_chat_layout",
        toolCallId,
        toolName: "set-portfolio-chat-layout",
        layout: value.layout,
      };
    }
    case "set_portfolio_chat_font": {
      if (value.toolName !== "set-portfolio-chat-font") return null;
      if (!isAllowed(value.font, CHAT_FONTS)) return null;
      return {
        type: "set_portfolio_chat_font",
        toolCallId,
        toolName: "set-portfolio-chat-font",
        font: value.font,
      };
    }
    case "set_portfolio_chat_font_size": {
      if (value.toolName !== "set-portfolio-chat-font-size") return null;
      if (!isAllowed(value.size, CHAT_FONT_SIZES)) return null;
      return {
        type: "set_portfolio_chat_font_size",
        toolCallId,
        toolName: "set-portfolio-chat-font-size",
        size: value.size,
      };
    }
    case "set_portfolio_stream_animation": {
      if (value.toolName !== "set-portfolio-stream-animation") return null;
      if (!isAllowed(value.animation, CHAT_STREAM_ANIMATIONS)) return null;
      return {
        type: "set_portfolio_stream_animation",
        toolCallId,
        toolName: "set-portfolio-stream-animation",
        animation: value.animation,
      };
    }
    case "show_portfolio_log_results": {
      if (value.toolName !== "search-portfolio-logs") return null;
      if (
        !isString(value.query) ||
        value.query.length < 1 ||
        value.query.length > 200 ||
        !Array.isArray(value.matchedSlugs)
      ) {
        return null;
      }
      // slug는 그대로 주소가 되므로 형태를 좁히고 최대 5개만 남긴다.
      const matchedSlugs = [...new Set(value.matchedSlugs)]
        .filter(
          (slug): slug is string =>
            isString(slug) && /^[a-z0-9-]{1,120}$/u.test(slug),
        )
        .slice(0, 5);
      return {
        type: "show_portfolio_log_results",
        toolCallId,
        toolName: "search-portfolio-logs",
        query: value.query,
        matchedSlugs,
      };
    }
    default:
      return null;
  }
}

/**
 * 도구 실행 배열을 검증해 적용 가능한 것만 남긴다.
 *
 * 배열이 아니면 빈 배열이고, 개별 실패는 버리며, 한 응답에서 최대
 * MAX_TOOL_EXECUTIONS개까지만 적용한다. 서버가 많은 지시를 한 번에 보내
 * 화면이 계속 바뀌는 상황을 막는다.
 */
export function parseToolExecutions(value: unknown): ChatToolExecution[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseToolExecution)
    .filter((execution): execution is ChatToolExecution => execution !== null)
    .slice(0, MAX_TOOL_EXECUTIONS);
}

/**
 * 챗봇 응답 본문 전체를 검증해 화면이 쓸 형태로 돌려준다.
 *
 * mode·status·audience·tone·pageContext가 모두 허용값이어야 하고,
 * mode와 generated의 조합(model=true, retrieval_fallback=false)까지 맞아야
 * 한다. 형식이 어긋나면 ChatApiError를 던지고, 형식은 맞지만 보여줄 본문이
 * 하나도 없으면 code `empty_answer`로 던져 화면이 빈 말풍선으로 굳지 않게 한다.
 */
export function parseChatResponse(value: unknown): ChatResponse {
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
    actions,
    suggestedQuestions,
    toolExecutions,
    cached,
    uiToolOutcome,
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
    !Array.isArray(actions) ||
    typeof cached !== "boolean" ||
    (validMode === "model" && generated !== true) ||
    (validMode === "retrieval_fallback" && generated !== false)
  ) {
    throw new ChatApiError("서버 응답 형식을 확인할 수 없습니다.");
  }

  const parsedSegments = segments
    .map(parseSegment)
    .filter((segment): segment is ChatSegment => segment !== null);

  // 빈 말풍선으로 굳지 않도록, 보여줄 본문이 하나도 없으면 실패로 처리한다.
  if (!answer.trim() && parsedSegments.length === 0) {
    throw new ChatApiError("답변을 만들지 못했어요. 다시 시도해 주세요.", {
      code: "empty_answer",
    });
  }

  return {
    mode: validMode,
    status: validStatus,
    generated,
    answer,
    segments: parsedSegments,
    audience,
    tone,
    pageContext,
    actions: actions
      .map(parseAction)
      .filter((action): action is ChatAction => action !== null)
      .slice(0, 2),
    // 백엔드와 프론트의 순차 배포 중에도 기존 응답을 계속 읽는다.
    suggestedQuestions: parseSuggestedQuestions(suggestedQuestions),
    toolExecutions: parseToolExecutions(toolExecutions),
    cached,
    // 보고하지 않는 서버와 모르는 값은 모두 없는 것으로 본다.
    ...(isAllowed(uiToolOutcome, UI_TOOL_OUTCOMES)
      ? { uiToolOutcome }
      : {}),
  };
}

/** SSE 블록 하나에서 뽑아낸 이벤트 이름과 데이터다. */
export interface SseEvent {
  event: string;
  data: string;
}

/**
 * SSE 블록(빈 줄로 구분된 한 덩어리)을 이벤트 이름과 데이터로 나눈다.
 *
 * 선행 BOM을 지우고 CRLF·LF·CR 어느 줄바꿈이든 받아들이며, `:`로 시작하는
 * 주석 줄과 빈 줄은 건너뛴다. 필드 값 앞의 공백 한 칸은 스펙대로 제거하고,
 * 여러 개의 `data:` 줄은 줄바꿈으로 이어 붙인다.
 *
 * event가 없거나 data가 하나도 없으면 null을 돌려준다. keep-alive 주석처럼
 * "살아 있다"는 신호일 뿐 디스패치할 것이 없는 블록이기 때문이다.
 */
export function parseSseBlock(block: string): SseEvent | null {
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

  // SSE 스펙상 주석(`:`)만 있는 블록과 event 필드가 없는 블록은 정상이다.
  // 유휴 타이머를 되감는 신호로만 쓰고 디스패치는 건너뛴다.
  if (!event || data.length === 0) return null;
  return { event, data: data.join("\n") };
}

/**
 * 버퍼 앞에서 완결된 SSE 블록 하나를 떼어낸다.
 *
 * 네트워크 청크는 블록 한가운데를 자를 수 있으므로, 블록 구분자(빈 줄)를
 * 찾지 못하면 null을 돌려 호출한 쪽이 더 읽게 한다. 잘린 조각은 rest로
 * 남아 다음 청크와 이어 붙는다.
 */
export function nextSseBlock(
  buffer: string,
): { block: string; rest: string } | null {
  const boundary = /\r\n\r\n|\n\n|\r\r/u.exec(buffer);
  if (!boundary || boundary.index === undefined) return null;
  return {
    block: buffer.slice(0, boundary.index),
    rest: buffer.slice(boundary.index + boundary[0].length),
  };
}

/**
 * SSE data 필드를 JSON으로 읽는다.
 *
 * 스트림 중간에 깨진 JSON이 오면 화면에 조각난 답변을 남기는 대신
 * ChatApiError를 던져 실패로 마무리한다.
 */
export function parseEventData(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    throw new ChatApiError("스트리밍 응답 데이터를 읽지 못했습니다.");
  }
}
