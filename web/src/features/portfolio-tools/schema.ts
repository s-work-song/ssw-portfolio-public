/**
 * 포트폴리오 UI 도구의 허용값과 입력 계약을 한곳에 모은 단일 소스다.
 *
 * 같은 허용값이 WebMCP 도구 등록(inputSchema), 도구 실행기(입력 검증),
 * 챗봇 응답 파서(서버가 보낸 도구 실행 검증), 타입 선언(union 파생)까지
 * 네 군데에 흩어져 있으면 한 곳만 고쳤을 때 조용히 어긋난다. 이 파일이
 * 배열 하나를 쥐고 나머지는 모두 여기서 파생시킨다.
 *
 * 이 모듈은 런타임 의존이 없다(브라우저 API·React·네트워크를 쓰지 않는다).
 * 덕분에 `node --test`가 이 파일과 이 파일을 쓰는 순수 파서를 그대로 불러
 * 검증할 수 있다.
 */

/** 도구로 바꿀 수 있는 화면 모드다. `system`은 사용자만 고를 수 있다. */
export const THEMES = ["light", "dark"] as const;

/** 설정 화면과 챗봇 요청에 실리는 화면 모드 전체다. */
export const THEME_MODES = ["light", "dark", "system"] as const;

/** 지원하는 포인트 색상이다. `ThemeContext`의 ACCENTS 맵 키와 같아야 한다. */
export const ACCENTS = [
  "indigo",
  "emerald",
  "amber",
  "rose",
  "violet",
] as const;

/** PC 채팅 패널 배치다. 좁은 화면에서는 dock을 골라도 플로팅으로 그린다. */
export const CHAT_LAYOUTS = ["floating", "dock"] as const;

/** 채팅 영역 글꼴이다. */
export const CHAT_FONTS = ["pretendard", "noto-sans-kr", "system"] as const;

/** 채팅 영역 글자 크기다. */
export const CHAT_FONT_SIZES = ["small", "medium", "large", "xlarge"] as const;

/**
 * 스트리밍 답변 텍스트 연출이다.
 * 채팅 UI 상수지만 `set-portfolio-stream-animation` 도구의 허용값이기도 해
 * 다른 허용값과 같은 자리에 둔다. `features/chat/constants`가 재수출한다.
 */
export const CHAT_STREAM_ANIMATIONS = [
  "none",
  "typewriter",
  "word-fade",
  "token-chunks",
  "blur-focus",
  "slide-up",
  "skeleton",
  "mask-wipe",
  "scramble",
  "letter-drop",
  "highlight-trail",
] as const;

/** `control-portfolio-view`가 받을 수 있는 화면 제어 동작이다. */
export const PORTFOLIO_VIEW_ACTIONS = [
  "main",
  "overview",
  "resume",
  "cover-letter",
  "research",
  "research-timeline",
  "research-optimization",
  "research-tools",
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
] as const;

/** 연구 여정에 존재하는 연도 앵커다. */
export const PORTFOLIO_RESEARCH_YEARS = [
  "2022",
  "2023",
  "2024",
  "2025",
  "2026",
] as const;

/** 연구 경험 페이지의 탭 식별자다. */
export const PORTFOLIO_RESEARCH_TABS = [
  "timeline",
  "optimization",
  "cpu",
  "memory",
  "serialization",
  "tools",
] as const;

/** 연도 인자를 반드시 함께 받아야 하는 화면 제어 동작이다. */
export const YEAR_DETAIL_ACTIONS = [
  "expand-research-year-details",
  "collapse-research-year-details",
] as const;

/** 화면 상태 보고에 쓰는 페이지 식별자다. */
export const PORTFOLIO_PAGE_IDS = [
  "landing",
  "main",
  "overview",
  "resume",
  "cover-letter",
  "research",
  "log",
  "settings",
  "unknown",
] as const;

/** 챗봇과 WebMCP가 함께 쓰는 포트폴리오 UI 도구 이름이다. */
export const PORTFOLIO_UI_TOOL_NAMES = [
  "get-portfolio-ui-settings",
  "set-portfolio-theme",
  "set-portfolio-accent",
  "set-portfolio-chat-layout",
  "set-portfolio-chat-font",
  "set-portfolio-chat-font-size",
  "set-portfolio-stream-animation",
  "get-portfolio-view-state",
  "control-portfolio-view",
  "open-portfolio-settings",
] as const;

export type PortfolioTheme = (typeof THEMES)[number];
export type PortfolioThemeMode = (typeof THEME_MODES)[number];
export type PortfolioAccent = (typeof ACCENTS)[number];
export type PortfolioChatLayout = (typeof CHAT_LAYOUTS)[number];
export type PortfolioChatFont = (typeof CHAT_FONTS)[number];
export type PortfolioChatFontSize = (typeof CHAT_FONT_SIZES)[number];
export type PortfolioStreamAnimation = (typeof CHAT_STREAM_ANIMATIONS)[number];
export type PortfolioViewActionId = (typeof PORTFOLIO_VIEW_ACTIONS)[number];
export type PortfolioResearchYearId =
  (typeof PORTFOLIO_RESEARCH_YEARS)[number];
export type PortfolioResearchTabId = (typeof PORTFOLIO_RESEARCH_TABS)[number];
export type PortfolioPageId = (typeof PORTFOLIO_PAGE_IDS)[number];
export type PortfolioUiToolName = (typeof PORTFOLIO_UI_TOOL_NAMES)[number];

/**
 * 값이 객체인지 확인한다(배열과 null 제외 없이 typeof만 본다).
 *
 * JSON.parse 결과처럼 어떤 모양이든 올 수 있는 값을 좁힐 때 쓰는 최소 가드다.
 * 배열도 `object`라 통과하므로, 배열을 걸러야 하는 자리에서는 호출한 쪽이
 * `Array.isArray`를 함께 확인한다.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** 값이 문자열인지 확인한다. */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * 값이 허용 목록 안의 문자열인지 확인한다.
 *
 * 서버·도구 호출자가 보낸 값을 그대로 상태에 넣기 전에 통과시키는 관문이다.
 * 목록 밖의 값은 거부하므로 프로토타입 키(`constructor` 등)나 임의 문자열이
 * 설정값·라우팅 인자로 새어 들어오지 않는다.
 */
export function isAllowed<T extends string>(
  value: unknown,
  allowlist: readonly T[],
): value is T {
  return isString(value) && (allowlist as readonly string[]).includes(value);
}

/**
 * 도구 인자가 객체인지 단언한다.
 *
 * WebMCP 호출자는 임의의 JSON을 보낼 수 있어 배열·null·원시값이 올 수 있다.
 * 실패하면 TypeError를 던지고, 호출한 도구가 이를 오류 응답으로 감싼다.
 */
export function assertInputObject(
  input: unknown,
): asserts input is Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("도구 인자는 객체여야 합니다.");
  }
}

/**
 * 도구 인자에 허용한 키만 들어 있는지 확인한다.
 *
 * 모르는 키를 조용히 무시하면 오타 난 인자가 성공으로 보고돼 호출자가
 * 잘못된 결론을 내린다. 그래서 알 수 없는 키는 TypeError로 거부한다.
 */
export function assertOnlyKeys(
  input: Record<string, unknown>,
  allowedKeys: readonly string[],
): void {
  if (Object.keys(input).some((key) => !allowedKeys.includes(key))) {
    throw new TypeError("도구 인자에 지원하지 않는 항목이 포함돼 있습니다.");
  }
}

/**
 * 인자를 받지 않는 도구의 입력을 검증한다.
 *
 * 키가 하나라도 있으면 `assertOnlyKeys`가 먼저 걸러내고, 그 뒤의 검사는
 * 계약을 문서로 남기기 위한 이중 확인이다.
 */
export function assertEmptyInput(
  input: Record<string, unknown>,
  label: string,
): void {
  assertOnlyKeys(input, []);
  if (Object.keys(input).length > 0) {
    throw new TypeError(`${label} 도구에는 인자가 필요하지 않습니다.`);
  }
}

/**
 * 키 하나짜리 열거형 인자를 읽어 허용값으로 좁힌다.
 *
 * 허용 목록에 없거나 문자열이 아니면 TypeError를 던진다. 성공하면 목록의
 * 리터럴 타입으로 좁혀져 호출한 쪽에서 별도 캐스팅이 필요 없다.
 */
export function readEnumInput<const T extends readonly string[]>(
  input: Record<string, unknown>,
  key: string,
  values: T,
  label: string,
): T[number] {
  assertOnlyKeys(input, [key]);
  const value = input[key];
  if (!isAllowed(value, values as readonly string[])) {
    throw new TypeError(`${label} 도구 인자가 올바르지 않습니다.`);
  }
  return value as T[number];
}

/** 화면 제어 동작이 연도 인자를 함께 요구하는지 알려준다. */
export function viewActionRequiresYear(action: PortfolioViewActionId): boolean {
  return (YEAR_DETAIL_ACTIONS as readonly string[]).includes(action);
}

/** `control-portfolio-view`가 실제로 받는 인자다. */
export interface PortfolioViewControlInput {
  action: PortfolioViewActionId;
  year?: PortfolioResearchYearId;
}

/**
 * 화면 제어 도구의 인자를 검증한다.
 *
 * 연도별 상세 제어에는 연도가 반드시 있어야 하고, 그 밖의 동작에는 연도를
 * 붙일 수 없다. 두 규칙을 한곳에서 지켜야 WebMCP 호출과 챗봇 도구 실행이
 * 같은 판정을 내린다.
 */
export function readViewControlInput(
  input: Record<string, unknown>,
): PortfolioViewControlInput {
  assertOnlyKeys(input, ["action", "year"]);
  const action: unknown = input.action;
  const rawYear: unknown = input.year;
  if (!isAllowed(action, PORTFOLIO_VIEW_ACTIONS)) {
    throw new TypeError("지원하지 않는 포트폴리오 화면 제어 동작입니다.");
  }
  const requiresYear = viewActionRequiresYear(action);
  const year = isAllowed(rawYear, PORTFOLIO_RESEARCH_YEARS)
    ? rawYear
    : undefined;
  if ((requiresYear && !year) || (!requiresYear && rawYear !== undefined)) {
    throw new TypeError("연도별 연구 상세 제어의 연도 인자가 올바르지 않습니다.");
  }
  return year ? { action, year } : { action };
}

/**
 * 도구 하나의 계약이다.
 *
 * `inputSchema`는 WebMCP 등록에 그대로 실리고, `parse`는 실행 직전 검증에
 * 쓰인다. 둘을 같은 객체에 묶어 두면 스키마만 고치고 검증을 빠뜨리는
 * (또는 그 반대의) 어긋남이 생기지 않는다.
 */
export interface PortfolioUiToolDefinition<TArgs> {
  name: PortfolioUiToolName;
  inputSchema: Record<string, unknown>;
  parse: (input: Record<string, unknown>) => TArgs;
}

/** 인자를 받지 않는 도구의 JSON Schema다. */
const EMPTY_INPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

/** 키 하나짜리 열거형 도구의 JSON Schema를 만든다. */
function enumInputSchema(
  key: string,
  values: readonly string[],
  description: string,
): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      [key]: { type: "string", enum: [...values], description },
    },
    required: [key],
    additionalProperties: false,
  };
}

/**
 * 포트폴리오 UI 도구 10종의 이름·입력 스키마·입력 파서다.
 *
 * WebMCP 등록 컴포넌트는 `inputSchema`를, 도구 실행기는 `parse`를 읽는다.
 * 도구별 제목·설명은 등록 컴포넌트에만 필요해 여기 두지 않는다. 그래야
 * 안내 문구가 지연 로딩되는 등록 청크에만 실린다.
 */
export const PORTFOLIO_UI_TOOLS = {
  "get-portfolio-ui-settings": {
    name: "get-portfolio-ui-settings",
    inputSchema: EMPTY_INPUT_SCHEMA,
    parse: (input) => {
      assertEmptyInput(input, "현재 UI 설정 조회");
      return {};
    },
  } satisfies PortfolioUiToolDefinition<Record<string, never>>,
  "set-portfolio-theme": {
    name: "set-portfolio-theme",
    inputSchema: enumInputSchema("theme", THEMES, "light 또는 dark 중 하나"),
    parse: (input) => ({
      theme: readEnumInput(input, "theme", THEMES, "화면 모드"),
    }),
  } satisfies PortfolioUiToolDefinition<{ theme: PortfolioTheme }>,
  "set-portfolio-accent": {
    name: "set-portfolio-accent",
    inputSchema: enumInputSchema("accent", ACCENTS, "지원하는 포인트 색상"),
    parse: (input) => ({
      accent: readEnumInput(input, "accent", ACCENTS, "포인트 색상"),
    }),
  } satisfies PortfolioUiToolDefinition<{ accent: PortfolioAccent }>,
  "set-portfolio-chat-layout": {
    name: "set-portfolio-chat-layout",
    inputSchema: enumInputSchema(
      "layout",
      CHAT_LAYOUTS,
      "floating 또는 dock 중 하나",
    ),
    parse: (input) => ({
      layout: readEnumInput(input, "layout", CHAT_LAYOUTS, "채팅 레이아웃"),
    }),
  } satisfies PortfolioUiToolDefinition<{ layout: PortfolioChatLayout }>,
  "set-portfolio-chat-font": {
    name: "set-portfolio-chat-font",
    inputSchema: enumInputSchema("font", CHAT_FONTS, "지원하는 채팅 글꼴"),
    parse: (input) => ({
      font: readEnumInput(input, "font", CHAT_FONTS, "채팅 글꼴"),
    }),
  } satisfies PortfolioUiToolDefinition<{ font: PortfolioChatFont }>,
  "set-portfolio-chat-font-size": {
    name: "set-portfolio-chat-font-size",
    inputSchema: enumInputSchema(
      "size",
      CHAT_FONT_SIZES,
      "small, medium, large, xlarge 중 하나",
    ),
    parse: (input) => ({
      size: readEnumInput(input, "size", CHAT_FONT_SIZES, "채팅 글자 크기"),
    }),
  } satisfies PortfolioUiToolDefinition<{ size: PortfolioChatFontSize }>,
  "set-portfolio-stream-animation": {
    name: "set-portfolio-stream-animation",
    inputSchema: enumInputSchema(
      "animation",
      CHAT_STREAM_ANIMATIONS,
      "none, typewriter, word-fade, token-chunks, blur-focus, slide-up, skeleton, mask-wipe, scramble, letter-drop, highlight-trail 중 하나",
    ),
    parse: (input) => ({
      animation: readEnumInput(
        input,
        "animation",
        CHAT_STREAM_ANIMATIONS,
        "스트리밍 연출",
      ),
    }),
  } satisfies PortfolioUiToolDefinition<{
    animation: PortfolioStreamAnimation;
  }>,
  "get-portfolio-view-state": {
    name: "get-portfolio-view-state",
    inputSchema: EMPTY_INPUT_SCHEMA,
    parse: (input) => {
      assertEmptyInput(input, "현재 화면 상태 조회");
      return {};
    },
  } satisfies PortfolioUiToolDefinition<Record<string, never>>,
  "control-portfolio-view": {
    name: "control-portfolio-view",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [...PORTFOLIO_VIEW_ACTIONS],
          description:
            "화면 이동, 전체 연구 상세 제어 또는 연도별 연구 상세 제어 동작",
        },
        year: {
          type: "string",
          enum: [...PORTFOLIO_RESEARCH_YEARS],
          description:
            "expand-research-year-details 또는 collapse-research-year-details일 때 반드시 지정할 연구 연도",
        },
      },
      required: ["action"],
      additionalProperties: false,
    },
    parse: readViewControlInput,
  } satisfies PortfolioUiToolDefinition<PortfolioViewControlInput>,
  "open-portfolio-settings": {
    name: "open-portfolio-settings",
    inputSchema: EMPTY_INPUT_SCHEMA,
    parse: (input) => {
      assertEmptyInput(input, "설정 페이지 열기");
      return {};
    },
  } satisfies PortfolioUiToolDefinition<Record<string, never>>,
} as const;
