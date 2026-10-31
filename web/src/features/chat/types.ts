/**
 * 챗봇 기능이 주고받는 값의 타입 계약이다.
 *
 * 도구·설정과 관련된 union은 직접 나열하지 않고
 * `portfolio-tools/schema`의 허용 목록에서 파생한다. 목록에 값을 하나 더하면
 * 타입도 함께 넓어지므로, 실행기·WebMCP 스키마가 조용히 어긋나지 않는다.
 */
import type { ChatTurnStage } from "./transport/sse.ts";
import type {
  ACCENTS,
  CHAT_FONTS,
  CHAT_FONT_SIZES,
  CHAT_LAYOUTS,
  CHAT_STREAM_ANIMATIONS,
  PORTFOLIO_PAGE_IDS,
  PORTFOLIO_RESEARCH_TABS,
  PORTFOLIO_RESEARCH_YEARS,
  PORTFOLIO_RESEARCH_DETAILS_ACTIONS,
  PORTFOLIO_RESEARCH_DETAILS_TARGETS,
  PORTFOLIO_VIEW_ACTIONS,
  THEME_MODES,
  PortfolioChoiceSetting,
} from "../portfolio-tools/schema";

/** 온보딩에서 방문자가 고르는 관점이다. 화면 문구와 1:1로 대응한다. */
export type AudienceChoice =
  | "default"
  | "recruiter"
  | "developer"
  | "collaboration"
  | "personality"
  | "values"
  | "casual";

/** 백엔드가 이해하는 관점 값이다. 화면 선택지보다 좁다. */
export type ApiAudience =
  | "default"
  | "hiring"
  | "developer"
  | "collaboration"
  | "casual";

/** 답변 말투다. 설정과 헤더 셀렉트가 같은 값을 쓴다. */
export type Tone = "official" | "manager" | "mascot";

/** 추론 서버 연결 상태다. `idle`은 아직 한 번도 확인하지 않은 상태다. */
export type ChatAvailability = "idle" | "checking" | "online" | "offline";

/** 채팅 패널이 열리고 닫힐 때 재생할 연출이다. PC 화면에만 적용된다. */
export type ChatAnimation = "none" | "slide" | "jelly";

/**
 * 스트리밍으로 도착하는 답변 텍스트에 입히는 연출이다.
 * 전체 길이를 모르는 SSE 특성상 "도착 시점" 기준으로 재생한다.
 */
export type ChatStreamAnimation = (typeof CHAT_STREAM_ANIMATIONS)[number];

/** 요청마다 clientState로 함께 보내는 현재 UI 설정이다. */
export interface ChatUiSettings {
  theme: (typeof THEME_MODES)[number];
  accent: (typeof ACCENTS)[number];
  chatLayout: (typeof CHAT_LAYOUTS)[number];
  chatFont: (typeof CHAT_FONTS)[number];
  chatFontSize: (typeof CHAT_FONT_SIZES)[number];
  streamAnimation: (typeof CHAT_STREAM_ANIMATIONS)[number];
}

/** 화면 상태 보고에 쓰는 페이지 식별자다. */
export type ChatPortfolioPageId = (typeof PORTFOLIO_PAGE_IDS)[number];

/** 모델이 "지금 무엇을 보고 있는지" 판단할 때 참고하는 화면 상태다. */
export interface ChatPortfolioViewState {
  page: ChatPortfolioPageId;
  anchor: string | null;
  researchTab: ChatPortfolioResearchTab | null;
  researchYear: ChatPortfolioResearchYear | null;
  researchDetails: {
    expanded: number;
    total: number;
    expandedYears: ChatPortfolioResearchYear[];
  } | null;
}

/** 답변 아래 버튼으로 노출되는 콘텐츠 이동 액션 식별자다. */
export type ActionId =
  | "overview"
  | "architecture"
  | "development_environment"
  | "deployment_overview"
  | "migration_memory_history"
  | "infrastructure_optimization"
  | "settings"
  | "settings_overview"
  | "resume"
  | "cover_letter"
  | "cover_letter_story"
  | "cover_letter_career_turning_point"
  | "research"
  | "log"
  | "project_overview"
  | "agent_experiments"
  | "agent_experiments_svg"
  | "agent_experiments_webgl"
  | "agent_experiments_2d_games"
  | "agent_experiments_3d_games"
  | "agent_experiments_blender"
  | "agent_experiments_videos"
  | "agent_experiments_comfyui"
  | "past_work_archive"
  | "open_weight_experiments"
  | "optimization_preview"
  | "architecture_preview"
  | "si_levels_preview"
  | "project_common_infrastructure"
  | "project_ecommerce_demo"
  | "project_code_archive"
  | "research_timeline"
  | "research_year_2011"
  | "research_year_2022"
  | "research_year_2023"
  | "research_year_2024"
  | "research_year_2025"
  | "research_year_2026"
  | "research_optimization"
  | "research_benchmark_code"
  | "research_optimization_caution"
  | "research_cpu"
  | "research_counting_sort"
  | "research_memory"
  | "research_memory_mmf"
  | "research_serialization"
  | "research_serialization_bandwidth"
  | "research_tools"
  | "research_ai_verification"
  | "research_open_weight"
  | "research_chatbot_architecture"
  | "research_training_data"
  | "research_training_examples"
  | "si_levels"
  | "si_terminology"
  | "si_level_chat"
  | "si_level_read_only"
  | "si_level_implementation"
  | "si_level_tools"
  | "si_level_orchestration"
  | "si_learning"
  | "si_tools_ffmpeg"
  | "si_session_messaging"
  | "log_ambiguous_support"
  | "log_ai_implementation_options"
  | "log_canvas_dodge"
  | "log_human_hallucination"
  | "log_gray_area_responsibility"
  | "log_ai_bubble_reality"
  | "log_restful_rpc"
  | "log_ai_model_evaluation"
  | "log_employment_contract"
  | "log_excel_mapper"
  | "log_ar_campfire"
  | "log_health_long_term_asset"
  | "log_hobby_interview"
  | "log_license"
  | "log_manual_security"
  | "log_mutual_respect"
  | "log_radial_nerve"
  | "log_sleep_recovery"
  | "log_rules_collaboration"
  | "log_business_integrity"
  | "log_ai_writing"
  | "log_hardware_to_software";

/** 답변에 붙는 이동 버튼 하나다. label은 프런트가 정의한 문구여야 한다. */
export interface ChatAction {
  id: ActionId;
  label: string;
}

/** 답변을 문단 단위로 나눈 조각이다. 문단마다 관련 이동 버튼이 붙는다. */
export interface ChatSegment {
  markdown: string;
  actions: ChatAction[];
}

/** 기록 검색 결과를 목록 화면에 반영하라는 지시다. */
export interface ChatLogSearchToolExecution {
  type: "show_portfolio_log_results";
  toolCallId: string;
  toolName: "search_portfolio_logs";
  query: string;
  matchedSlugs: string[];
}

/** 화면 이동과 연구 상세 제어 동작 식별자다. */
export type ChatPortfolioViewAction = (typeof PORTFOLIO_VIEW_ACTIONS)[number];

/** 연구 경험 페이지의 탭 식별자다. */
export type ChatPortfolioResearchTab =
  (typeof PORTFOLIO_RESEARCH_TABS)[number];

/** 연구 여정의 연도 앵커 식별자다. */
export type ChatPortfolioResearchYear =
  (typeof PORTFOLIO_RESEARCH_YEARS)[number];

export type ChatResearchDetailsAction = (typeof PORTFOLIO_RESEARCH_DETAILS_ACTIONS)[number];
export type ChatResearchDetailsTarget = (typeof PORTFOLIO_RESEARCH_DETAILS_TARGETS)[number];



/** 도구 결과 상태 줄 하나의 진행 상태다. */
export type ChatToolResultStatus =
  | "started"
  | "arrived"
  | "applied"
  | "failed";

/**
 * 도구 하나가 화면에서 실제로 어떻게 끝났는지 알리는 상태다.
 *
 * 모델 호출·계획 실행 지시는 접수 기록이므로, 정말로 도착했는지·반영됐는지는
 * 이 값이 화면에서 보여 준다. `callId`는 서버가 보낸 도구 호출 식별자라
 * 같은 도구가 여러 번 실행돼도 항목이 섞이지 않는다.
 */
export interface ToolResult {
  callId: string;
  tool: string;
  action?: string;
  target?: ChatResearchDetailsTarget;
  label: string;
  status: ChatToolResultStatus;
  /** 실패했을 때의 사유다. 성공 상태에는 붙지 않는다. */
  detail?: string;
}

/**
 * 작업 세션이 답변 말풍선에 띄운 설정 선택지다.
 *
 * 버튼은 대화 턴 없이 설정을 바로 바꾸며, 현재 값 표시는 실제 화면 설정을 따른다.
 */
export interface ChatSettingChoice {
  callId: string;
  setting: PortfolioChoiceSetting;
}

/** 화면에 그려지는 말풍선 하나다. 대화 이력의 정본은 서버 채팅이며 이 값은 표시용이다. */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** chat_notice는 모델이 아니라 앱이 쓴 안내다(새 채팅 시작 알림 등). */
  kind: "greeting" | "message" | "chat_notice";
  /** 앱 안내는 모델이 생성한 답변이 아니다. */
  generated?: boolean;
  generationState?: "streaming" | "complete" | "stopped" | "failed";
  /** 생성 중 서버가 알려 준 진행 단계다. 완료되면 지운다. */
  statusStage?: ChatTurnStage;
  /** 실패했을 때 서버가 준 사용자용 안내다. 없으면 고정 안내를 쓴다. */
  failureNotice?: string;
  /** 같은 질문을 다시 보낼 수 있는지다. 화면 도구를 실행한 턴은 다시 보내지 않는다. */
  retryAllowed?: boolean;
  segments?: ChatSegment[];
  actions?: ChatAction[];
  suggestedQuestions?: string[];
  /** 추천 버튼·질문을 숨기는 답변이다. */
  recommendationsSuppressed?: boolean;
  /** 이 답변이 실행한 화면 도구의 실제 결과다. 없으면 표시하지 않는다. */
  toolResults?: ToolResult[];
  /** 이 답변에서 방문자에게 띄운 설정 선택지다. */
  settingChoice?: ChatSettingChoice;
}

/** `/api/chat/status` 응답이다. 역할 모델이 빠진 degraded는 offline으로 읽는다. */
export interface ChatStatusResponse {
  status: "online" | "offline";
  checkedAt: string;
}
