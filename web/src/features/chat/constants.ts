/**
 * 챗봇 화면이 쓰는 고정 문구·선택지·라우팅 표를 모은 모듈이다.
 *
 * 도구 허용값은 여기 두지 않고 `portfolio-tools/schema`가 단일 소스로 쥔다.
 * 이 파일은 그중 스트리밍 연출 목록만 재수출해, 챗봇 쪽 호출부가 스키마
 * 모듈을 직접 알지 않아도 되게 한다.
 *
 * 값 import에 `.ts` 확장자를 붙인 이유: 순수 파서(`parse.ts`)가 이 파일을
 * 불러 쓰고, 그 파서를 Node가 직접 실행해 테스트한다. Node의 ESM 해석기는
 * 확장자 없는 상대 경로를 찾지 못한다.
 */
import { ACCENTS as ACCENT_PALETTE } from "../../context/accentPalette.ts";
import type {
  ActionId,
  ApiAudience,
  AudienceChoice,
  ChatAnimation,
  ChatStreamAnimation,
  ChatToolExecution,
  PageContext,
  Tone,
  ToolResult,
} from "./types";

export { CHAT_STREAM_ANIMATIONS } from "../portfolio-tools/schema.ts";

/** 채팅을 처음 열었을 때 보여 주는 인사말이다. */
export const GREETING =
  "안녕하세요. 포트폴리오를 안내하는 AI 챗봇입니다. 관심 있는 주제를 선택하거나 바로 질문해 주세요.";

/**
 * 온보딩과 투어 종료 화면에서 보여 주는 설정·WebMCP 안내 답변이다.
 * 서버를 거치지 않고 프런트가 직접 말풍선으로 삽입하는 고정 마크다운이다.
 */
export const SETTINGS_WEBMCP_GUIDE = `### 설정과 WebMCP 기능

별도의 설정 페이지에서 테마, 포인트 색상, 채팅 글꼴과 글자 크기, 패널 배치, 답변 스트리밍 연출을 직접 조정할 수 있어요.

채팅에 다음처럼 말하면 설정 도구가 요청을 반영합니다.

- “설정 페이지 열어줘”
- “지금 내가 어떤 페이지를 보고 있어?”
- “자기소개서 페이지로 이동해줘”
- “소개 페이지의 AI 협업 프로젝트로 이동”
- “다크 모드로 바꿔줘”
- “채팅 글꼴을 노토 산스로 바꿔줘”
- “채팅 글꼴을 프리텐다드로 바꿔줘”
- “채팅 글자 크기를 크게 해줘”
- “채팅을 오른쪽 패널로 도킹해줘”

WebMCP를 지원하는 브라우저에서는 현재 화면 상태 확인, 설정 페이지 열기, 공개 기록 목차 확인·열기, 포트폴리오 페이지·연구 연도 이동, 특정 연도 상세 펼치기·접기와 스트리밍 연출 변경 같은 화면 기능도 도구로 사용할 수 있습니다. 기록 검색은 기록 페이지에서 직접 이용할 수 있습니다.

WebMCP 자체뿐 아니라 이를 호출하는 에이전트 하네스와 브라우저 지원도 모두 실험 단계입니다. 따라서 환경에 따라 도구가 노출되지 않거나 일부 기능이 동작하지 않을 수 있어요.

현재 이 포트폴리오에서 실제 동작을 확인한 환경은 Codex의 브라우저 도구입니다.`;

/** 말투 선택을 담아 두는 localStorage 키다. */
export const TONE_STORAGE_KEY = "portfolio-chat-tone";
/** 스트리밍 사용 여부를 담아 두는 localStorage 키다. */
export const STREAMING_STORAGE_KEY = "portfolio-chat-streaming";
/** 사고모드 사용 여부를 담아 두는 localStorage 키다. */
export const REASONING_STORAGE_KEY = "portfolio-chat-reasoning";
/** 패널 연출 선택을 담아 두는 localStorage 키다. */
export const CHAT_ANIMATION_STORAGE_KEY = "portfolio-chat-animation";

/** 채팅창 안의 빠른 토글은 숨기고 설정 페이지에서만 사고 모드를 조절한다. */
export const REASONING_QUICK_TOGGLE_ENABLED = false;
/** 저장된 선택이 없을 때의 사고모드 기본값이다. */
export const DEFAULT_REASONING_ENABLED = false;

/** 서버가 이해하는 말투 값이다. 저장소에서 읽은 값을 검증할 때도 쓴다. */
export const TONES: readonly Tone[] = ["official", "manager", "mascot"];

/** 패널 열기·닫기 연출 허용값이다. */
export const CHAT_ANIMATIONS: readonly ChatAnimation[] = [
  "none",
  "slide",
  "jelly",
];

/** 설정을 지우거나 저장소를 쓸 수 없을 때 돌아갈 기본 연출이다. */
export const DEFAULT_CHAT_ANIMATION: ChatAnimation = "jelly";

/** 설정 화면의 패널 연출 선택지다(값 + 표시 문구). */
export const CHAT_ANIMATION_OPTIONS: ReadonlyArray<{
  value: ChatAnimation;
  label: string;
}> = [
  { value: "none", label: "없음" },
  { value: "slide", label: "슬라이드" },
  { value: "jelly", label: "젤리" },
];

/** 스트리밍 텍스트 연출 선택을 담아 두는 localStorage 키다. */
export const STREAM_ANIMATION_STORAGE_KEY = "portfolio-chat-stream-animation";

/** 설정을 지우거나 저장소를 쓸 수 없을 때 돌아갈 기본 연출이다. */
export const DEFAULT_CHAT_STREAM_ANIMATION: ChatStreamAnimation = "word-fade";

/** 설정 화면의 스트리밍 연출 선택지다(값 + 표시 문구 + 한 줄 설명). */
export const CHAT_STREAM_ANIMATION_OPTIONS: ReadonlyArray<{
  value: ChatStreamAnimation;
  label: string;
  description: string;
}> = [
  { value: "none", label: "없음", description: "도착한 그대로 표시" },
  {
    value: "typewriter",
    label: "타자기",
    description: "문장 끝에서 커서가 깜빡임",
  },
  {
    value: "word-fade",
    label: "단어 페이드",
    description: "새 단어가 부드럽게 나타남",
  },
  {
    value: "token-chunks",
    label: "토큰 청크",
    description: "방금 온 조각이 옅다가 진해짐",
  },
  {
    value: "blur-focus",
    label: "블러 포커스",
    description: "흐릿하게 왔다가 또렷해짐",
  },
  {
    value: "slide-up",
    label: "슬라이드 업",
    description: "새 단어가 아래에서 올라옴",
  },
  {
    value: "skeleton",
    label: "스켈레톤",
    description: "끝에 반짝이는 자리 표시줄",
  },
  {
    value: "mask-wipe",
    label: "마스크 와이프",
    description: "글자가 훑고 지나가듯 드러남",
  },
  {
    value: "scramble",
    label: "스크램블",
    description: "끝 글자가 뒤섞였다가 정착",
  },
  {
    value: "letter-drop",
    label: "레터 드롭",
    description: "글자가 위에서 떨어져 자리 잡음",
  },
  {
    value: "highlight-trail",
    label: "하이라이트 트레일",
    description: "방금 온 글자에 잔광이 남음",
  },
];

/** 화면 모드 값에 붙는 표시 이름이다. */
const THEME_LABELS: Readonly<Record<string, string>> = {
  light: "라이트",
  dark: "다크",
};

/** 채팅 패널 배치 값에 붙는 표시 이름이다(설정 화면과 같은 문구). */
const CHAT_LAYOUT_LABELS: Readonly<Record<string, string>> = {
  floating: "플로팅 창",
  dock: "오른쪽 고정 패널",
};

/** 채팅 글꼴 값에 붙는 표시 이름이다(설정 화면과 같은 문구). */
const CHAT_FONT_LABELS: Readonly<Record<string, string>> = {
  pretendard: "Pretendard",
  "noto-sans-kr": "Noto Sans KR",
  system: "시스템 글꼴",
};

/** 채팅 글자 크기 값에 붙는 표시 이름이다(설정 화면과 같은 문구). */
const CHAT_FONT_SIZE_LABELS: Readonly<Record<string, string>> = {
  small: "작게",
  medium: "기본",
  large: "크게",
  xlarge: "매우 크게",
};

/**
 * 허용 목록에서 온 값을 표시 이름으로 바꾼다.
 *
 * 표에 없는 값이면 원래 값을 그대로 쓴다. 상태 줄은 안내일 뿐이라
 * 표를 하나 빠뜨렸다고 화면이 비는 것보다 영문 값이라도 보이는 편이 낫다.
 */
function displayName(
  table: Readonly<Record<string, string>>,
  value: string,
): string {
  return Object.hasOwn(table, value) ? table[value] : value;
}

/**
 * 설정 변경 도구 하나를 사람이 읽는 명사구로 바꾼다.
 *
 * 도구 결과 상태 줄("도구 호출 · {label}")에 쓰는 문구라 설정 화면과 같은
 * 표시 이름을 재사용한다. 화면 이동 도구는 목적지 표(`portfolioView`)가
 * 자기 label을 들고 있으므로 여기서 null을 돌려 호출한 쪽이 그것을 쓰게 한다.
 */
export function settingToolResultLabel(
  execution: ChatToolExecution,
): string | null {
  switch (execution.type) {
    case "set_portfolio_theme":
      return `화면 모드 · ${displayName(THEME_LABELS, execution.theme)}`;
    case "set_portfolio_accent":
      return `포인트 색상 · ${ACCENT_PALETTE[execution.accent].label}`;
    case "cycle_portfolio_accent": {
      const last = execution.accents.at(-1);
      const lastLabel = last ? ACCENT_PALETTE[last].label : "";
      return `포인트 색상 순회 · ${lastLabel}`;
    }
    case "set_portfolio_chat_layout":
      return `채팅 배치 · ${displayName(CHAT_LAYOUT_LABELS, execution.layout)}`;
    case "set_portfolio_chat_font":
      return `채팅 글꼴 · ${displayName(CHAT_FONT_LABELS, execution.font)}`;
    case "set_portfolio_chat_font_size":
      return `채팅 글자 크기 · ${displayName(
        CHAT_FONT_SIZE_LABELS,
        execution.size,
      )}`;
    case "set_portfolio_stream_animation": {
      const option = CHAT_STREAM_ANIMATION_OPTIONS.find(
        (candidate) => candidate.value === execution.animation,
      );
      return `응답 연출 · ${option?.label ?? execution.animation}`;
    }
    default:
      return null;
  }
}

/**
 * 서버가 "도구를 승격했는데 끝내 실행되지 않았다"고 보고했을 때 붙이는 결과다.
 *
 * 모델은 이미 "이동했어요"라고 말했을 수 있으므로, 실제로는 아무 일도 없었다는
 * 사실을 화면이 대신 알린다. callId는 서버 도구 호출이 아니라 이 보고 자체를
 * 가리키므로 고정값을 쓴다.
 */
export const UI_TOOL_NOT_CALLED_RESULT: ToolResult = {
  callId: "outcome",
  tool: "none",
  label: "화면 이동·설정 변경",
  status: "failed",
  detail: "모델이 도구를 실행하지 않았어요",
};

/** 채팅 헤더 셀렉트에 노출하는 말투 선택지다. */
export const TONE_OPTIONS: ReadonlyArray<{ value: Tone; label: string }> = [
  { value: "official", label: "공식 안내자" },
  { value: "manager", label: "개발자 매니저" },
  { value: "mascot", label: "마스코트 펫" },
];

/**
 * 온보딩의 관점 선택지다.
 * 화면 값(value)과 서버 값(apiValue)이 다른 항목이 있어 둘을 함께 둔다.
 */
export const AUDIENCE_OPTIONS: ReadonlyArray<{
  value: AudienceChoice;
  apiValue: ApiAudience;
  label: string;
}> = [
  { value: "recruiter", apiValue: "hiring", label: "채용·평가 관점" },
  { value: "developer", apiValue: "developer", label: "개발·기술 검토" },
  {
    value: "collaboration",
    apiValue: "collaboration",
    label: "협업·의뢰 검토",
  },
  { value: "personality", apiValue: "casual", label: "성격·취미" },
  { value: "values", apiValue: "default", label: "가치관" },
  { value: "casual", apiValue: "casual", label: "가볍게 둘러보기" },
];

/** 첫 대화에서 질문 전송과 콘텐츠 이동을 함께 시작하는 바로가기다. */
export const CHAT_QUICK_START_OPTIONS: ReadonlyArray<{
  actionId: ActionId;
  audience: AudienceChoice;
  label: string;
  prompt: string;
}> = [
  {
    actionId: "project_overview",
    audience: "casual",
    label: "공개용 프로젝트 보기",
    prompt: "공개용 프로젝트의 목적과 차이를 간단히 소개해 주세요.",
  },
  {
    actionId: "research_optimization",
    audience: "developer",
    label: "최적화 개요 보기",
    prompt:
      "성능 최적화 연구를 CPU, 메모리·파일 I/O, 직렬화·전송 관점으로 나누어 개요를 설명해 주세요.",
  },
];

/**
 * 액션 식별자로 빠른 시작 선택지를 찾는 표다.
 * 온보딩 버튼과 답변 아래 액션 버튼이 같은 문구·같은 질문을 쓰도록 한다.
 */
export const CHAT_QUICK_START_OPTION_BY_ACTION_ID: ReadonlyMap<
  ActionId,
  (typeof CHAT_QUICK_START_OPTIONS)[number]
> = new Map(
  CHAT_QUICK_START_OPTIONS.map((option) => [option.actionId, option] as const),
);

/**
 * 액션 식별자에서 실제 이동 경로로 가는 표다.
 * 경로가 여기에 없으면 이동 자체가 일어나지 않으므로, 이 표가 챗봇이
 * 보낼 수 있는 목적지의 상한이다.
 */
export const ACTION_ROUTES: Readonly<Record<ActionId, string>> = {
  overview: "/about-me#portfolio-overview",
  settings: "/settings",
  resume: "/about-me/resume#resume-overview",
  cover_letter: "/about-me/cover-letter#cover-letter-overview",
  research: "/about-me/research#research-experiments",
  log: "/about-me/log#log-overview",
  project_overview: "/about-me#featured-projects",
  past_work_archive: "/about-me#past-work-archive",
  project_common_infrastructure: "/about-me#project-common-infrastructure",
  project_ecommerce_demo: "/about-me#project-ecommerce-demo",
  project_game_collection: "/about-me#project-game-collection-platform",
  project_code_archive: "/about-me#project-code-archive",
  research_timeline: "/about-me/research#research-timeline-overview",
  research_optimization: "/about-me/research#research-optimization-overview",
  research_cpu: "/about-me/research#research-cpu-simd",
  research_memory: "/about-me/research#research-memory-layout",
  research_serialization: "/about-me/research#research-serialization-packing",
  research_tools: "/about-me/research#research-tools-ai",
  log_ambiguous_support:
    "/about-me/log#log-card-ambiguous-support-leaves-negative-experiences",
  log_ai_implementation_options:
    "/about-me/log#log-card-ask-ai-for-options-before-implementation",
  log_canvas_dodge:
    "/about-me/log#log-card-canvas-dodge-game-before-game-development",
  log_human_hallucination:
    "/about-me/log#log-card-consider-human-hallucination-before-ai-hallucination",
  log_gray_area_responsibility:
    "/about-me/log#log-card-developer-responsibility-does-not-disappear-in-gray-areas",
  log_ai_bubble_reality:
    "/about-me/log#log-card-distinguishing-ai-bubble-from-reality-is-your-responsibility",
  log_restful_rpc:
    "/about-me/log#log-card-do-not-call-restful-and-rpc-the-same",
  log_ai_model_evaluation:
    "/about-me/log#log-card-do-not-trust-ai-evaluations-that-ignore-model-tiers",
  log_employment_contract:
    "/about-me/log#log-card-employment-contract-that-damaged-trust-from-the-start",
  log_excel_mapper:
    "/about-me/log#log-card-excel-row-mapping-wpf-app",
  log_ar_campfire:
    "/about-me/log#log-card-first-ar-project-using-real-space-and-motion",
  log_health_long_term_asset:
    "/about-me/log#log-card-health-as-the-most-important-long-term-asset",
  log_hobby_interview:
    "/about-me/log#log-card-interview-where-i-had-to-prove-my-hobby",
  log_license:
    "/about-me/log#log-card-license-is-not-something-to-negotiate-after-success",
  log_manual_security:
    "/about-me/log#log-card-manual-work-is-not-safe-just-because-ai-has-security-risks",
  log_mutual_respect:
    "/about-me/log#log-card-mutual-respect-creates-a-virtuous-cycle-of-knowledge",
  log_radial_nerve:
    "/about-me/log#log-card-radial-nerve-palsy-and-ai-workflow",
  log_sleep_recovery:
    "/about-me/log#log-card-recovery-after-alternate-all-nighters",
  log_rules_collaboration:
    "/about-me/log#log-card-rules-need-both-compliance-and-enforceable-structure",
  log_business_integrity:
    "/about-me/log#log-card-scale-and-appearance-do-not-guarantee-business-integrity",
  log_ai_writing:
    "/about-me/log#log-card-thoughts-on-writing-with-ai",
  log_hardware_to_software:
    "/about-me/log#log-card-why-i-started-software-development",
};

/**
 * 액션 버튼에 찍히는 문구다.
 * 서버가 보낸 label이 이 표와 다르면 파서가 그 액션을 버린다. 서버가 임의
 * 문구를 버튼 이름으로 밀어 넣지 못하게 하는 장치다.
 */
export const ACTION_LABELS: Readonly<Record<ActionId, string>> = {
  overview: "포트폴리오 개요 보기",
  settings: "설정 페이지 보기",
  resume: "경력·기술 보기",
  cover_letter: "자기소개서 보기",
  research: "연구·기술 탐구 보기",
  log: "작업 기록 보기",
  project_overview: "공개용 프로젝트 보기",
  past_work_archive: "과거 작업 아카이브 보기",
  project_common_infrastructure: "공용 인프라 보기",
  project_ecommerce_demo: "이커머스 데모 보기",
  project_game_collection: "게임 모음 플랫폼 보기",
  project_code_archive: "코드 아카이브 보기",
  research_timeline: "연구 여정 보기",
  research_optimization: "최적화 개요 보기",
  research_cpu: "CPU·SIMD 연구 보기",
  research_memory: "메모리·파일 I/O 연구 보기",
  research_serialization: "직렬화·전송 연구 보기",
  research_tools: "도구·AI 연구 보기",
  log_ambiguous_support: "AI 지원 조건 기록 보기",
  log_ai_implementation_options: "AI 구현 선택지 기록 보기",
  log_canvas_dodge: "Canvas 피하기 게임 기록 보기",
  log_human_hallucination: "사람의 환각 기록 보기",
  log_gray_area_responsibility: "회색지대 책임 기록 보기",
  log_ai_bubble_reality: "AI 거품과 실체 기록 보기",
  log_restful_rpc: "RESTful·RPC 기록 보기",
  log_ai_model_evaluation: "AI 모델 평가 기록 보기",
  log_employment_contract: "근로계약 신뢰 기록 보기",
  log_excel_mapper: "엑셀 행 매핑 기록 보기",
  log_ar_campfire: "AR 캠프파이어 기록 보기",
  log_health_long_term_asset: "건강 장기 자산 기록 보기",
  log_hobby_interview: "취미 면접 기록 보기",
  log_license: "라이선스 기록 보기",
  log_manual_security: "AI·수작업 보안 기록 보기",
  log_mutual_respect: "지식 선순환 기록 보기",
  log_radial_nerve: "요골신경 마비 회고 보기",
  log_sleep_recovery: "격일 밤샘 회복 기록 보기",
  log_rules_collaboration: "규칙과 협업 기록 보기",
  log_business_integrity: "사업 건전성 기록 보기",
  log_ai_writing: "AI 글쓰기 기록 보기",
  log_hardware_to_software: "하드웨어 관심에서 소프트웨어 개발로 보기",
};

/** 응답 검증에 쓰는 액션 식별자 허용 목록이다. */
export const ACTION_IDS: readonly ActionId[] = [
  "overview",
  "settings",
  "resume",
  "cover_letter",
  "research",
  "log",
  "project_overview",
  "past_work_archive",
  "project_common_infrastructure",
  "project_ecommerce_demo",
  "project_game_collection",
  "project_code_archive",
  "research_timeline",
  "research_optimization",
  "research_cpu",
  "research_memory",
  "research_serialization",
  "research_tools",
  "log_ambiguous_support",
  "log_ai_implementation_options",
  "log_canvas_dodge",
  "log_human_hallucination",
  "log_gray_area_responsibility",
  "log_ai_bubble_reality",
  "log_restful_rpc",
  "log_ai_model_evaluation",
  "log_employment_contract",
  "log_excel_mapper",
  "log_ar_campfire",
  "log_health_long_term_asset",
  "log_hobby_interview",
  "log_license",
  "log_manual_security",
  "log_mutual_respect",
  "log_radial_nerve",
  "log_sleep_recovery",
  "log_rules_collaboration",
  "log_business_integrity",
  "log_ai_writing",
  "log_hardware_to_software",
];

/**
 * 화면에서 고른 관점을 서버가 이해하는 값으로 바꾼다.
 *
 * 화면 선택지가 서버 값보다 세분화돼 있어(성격·가치관 등) 표를 한 번 거친다.
 * 선택이 없거나 표에 없는 값이면 안전한 기본값 `default`를 쓴다.
 */
export function audienceToApi(choice: AudienceChoice | null): ApiAudience {
  return (
    AUDIENCE_OPTIONS.find((option) => option.value === choice)?.apiValue ??
    "default"
  );
}

/**
 * 현재 경로에서 질문 문맥을 판정한다.
 *
 * 끝의 슬래시를 지운 뒤 뒤에서부터 좁은 규칙 순으로 맞춰 본다(기록 상세가
 * 소개 페이지로 잘못 잡히지 않게 하기 위함이다). 어디에도 걸리지 않으면
 * `default`이고, 서버는 이 값으로 답변의 초점을 조절한다.
 */
export function pageContextFromPathname(pathname: string): PageContext {
  const path = pathname.replace(/\/+$/u, "");

  if (/\/about-me\/resume$/u.test(path)) return "resume";
  if (/\/about-me\/cover-letter$/u.test(path)) return "cover_letter";
  if (/\/about-me\/research$/u.test(path)) return "research";
  if (/\/about-me\/log(?:\/.*)?$/u.test(path)) return "log";
  if (/\/about-me$/u.test(path)) return "overview";
  return "default";
}
