/**
 * 챗봇 기능이 주고받는 값의 타입 계약이다.
 *
 * 도구·설정과 관련된 union은 직접 나열하지 않고
 * `portfolio-tools/schema`의 허용 목록에서 파생한다. 목록에 값을 하나 더하면
 * 타입도 함께 넓어지므로, 파서·실행기·WebMCP 스키마가 조용히 어긋나지 않는다.
 */
import type {
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

/** 질문이 어떤 페이지에서 나왔는지 알려 주는 문맥 값이다. */
export type PageContext =
  | "default"
  | "overview"
  | "resume"
  | "cover_letter"
  | "research"
  | "log";

/** 매 요청에 함께 실어 보내는 현재 UI 설정이다. */
export interface ChatUiSettings {
  theme: (typeof THEME_MODES)[number];
  accent: (typeof ACCENTS)[number];
  chatLayout: (typeof CHAT_LAYOUTS)[number];
  chatFont: (typeof CHAT_FONTS)[number];
  chatFontSize: (typeof CHAT_FONT_SIZES)[number];
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
  | "settings"
  | "resume"
  | "cover_letter"
  | "research"
  | "log"
  | "project_overview"
  | "past_work_archive"
  | "project_common_infrastructure"
  | "project_ecommerce_demo"
  | "project_game_collection"
  | "project_code_archive"
  | "research_timeline"
  | "research_optimization"
  | "research_cpu"
  | "research_memory"
  | "research_serialization"
  | "research_tools"
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

/** 서버로 보내는 이전 대화 한 턴이다. */
export interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

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
  toolName: "search-portfolio-logs";
  query: string;
  matchedSlugs: string[];
}

/** 화면 모드 변경 지시다. */
export interface ChatThemeToolExecution {
  type: "set_portfolio_theme";
  toolCallId: string;
  toolName: "set-portfolio-theme";
  theme: (typeof THEMES)[number];
}

/** 포인트 색상 변경 지시다. */
export interface ChatAccentToolExecution {
  type: "set_portfolio_accent";
  toolCallId: string;
  toolName: "set-portfolio-accent";
  accent: (typeof ACCENTS)[number];
}

/** 포인트 색상을 순서대로 훑어 보여 주는 연출 지시다. */
export interface ChatAccentCycleToolExecution {
  type: "cycle_portfolio_accent";
  toolCallId: string;
  toolName: "cycle-portfolio-accent";
  accents: Array<(typeof ACCENTS)[number]>;
  stepMs: number;
}

/** 채팅 패널 배치 변경 지시다. */
export interface ChatLayoutToolExecution {
  type: "set_portfolio_chat_layout";
  toolCallId: string;
  toolName: "set-portfolio-chat-layout";
  layout: (typeof CHAT_LAYOUTS)[number];
}

/** 채팅 글꼴 변경 지시다. */
export interface ChatFontToolExecution {
  type: "set_portfolio_chat_font";
  toolCallId: string;
  toolName: "set-portfolio-chat-font";
  font: (typeof CHAT_FONTS)[number];
}

/** 채팅 글자 크기 변경 지시다. */
export interface ChatFontSizeToolExecution {
  type: "set_portfolio_chat_font_size";
  toolCallId: string;
  toolName: "set-portfolio-chat-font-size";
  size: (typeof CHAT_FONT_SIZES)[number];
}

/** 스트리밍 텍스트 연출 변경 지시다. */
export interface ChatStreamAnimationToolExecution {
  type: "set_portfolio_stream_animation";
  toolCallId: string;
  toolName: "set-portfolio-stream-animation";
  animation: ChatStreamAnimation;
}

/** 현재 UI 설정을 읽었다는 보고다. 화면을 바꾸지 않는다. */
export interface ChatUiSettingsReportToolExecution {
  type: "report_portfolio_ui_settings";
  toolCallId: string;
  toolName: "get-portfolio-ui-settings";
  available: boolean;
  uiSettings: ChatUiSettings | null;
}

/** 설정 페이지로 이동하라는 지시다. */
export interface ChatSettingsNavigationToolExecution {
  type: "open_portfolio_settings";
  toolCallId: string;
  toolName: "open-portfolio-settings";
}

/** 화면 이동과 연구 상세 제어 동작 식별자다. */
export type ChatPortfolioViewAction = (typeof PORTFOLIO_VIEW_ACTIONS)[number];

/** 연구 경험 페이지의 탭 식별자다. */
export type ChatPortfolioResearchTab =
  (typeof PORTFOLIO_RESEARCH_TABS)[number];

/** 연구 여정의 연도 앵커 식별자다. */
export type ChatPortfolioResearchYear =
  (typeof PORTFOLIO_RESEARCH_YEARS)[number];

/** 화면 이동·연구 상세 제어 지시다. 연도별 제어에만 year가 붙는다. */
export interface ChatPortfolioViewToolExecution {
  type: "control_portfolio_view";
  toolCallId: string;
  toolName: "control-portfolio-view";
  action: ChatPortfolioViewAction;
  year?: ChatPortfolioResearchYear;
}

/** 현재 화면 상태를 읽었다는 보고다. 화면을 바꾸지 않는다. */
export interface ChatPortfolioViewStateReportToolExecution {
  type: "report_portfolio_view_state";
  toolCallId: string;
  toolName: "get-portfolio-view-state";
  available: boolean;
  viewState: ChatPortfolioViewState | null;
}

/** 서버 모델이 실행한 화면 도구 하나다. type이 판별자다. */
export type ChatToolExecution =
  | ChatLogSearchToolExecution
  | ChatThemeToolExecution
  | ChatAccentToolExecution
  | ChatAccentCycleToolExecution
  | ChatLayoutToolExecution
  | ChatFontToolExecution
  | ChatFontSizeToolExecution
  | ChatStreamAnimationToolExecution
  | ChatUiSettingsReportToolExecution
  | ChatSettingsNavigationToolExecution
  | ChatPortfolioViewToolExecution
  | ChatPortfolioViewStateReportToolExecution;

/** 검증을 마친 챗봇 응답 본문이다. */
export interface ChatResponse {
  mode: "model" | "retrieval_fallback";
  status: "online" | "upstream_offline";
  generated: boolean;
  answer: string;
  segments: ChatSegment[];
  audience: ApiAudience;
  tone: Tone;
  pageContext: PageContext;
  actions: ChatAction[];
  suggestedQuestions: string[];
  toolExecutions: ChatToolExecution[];
  cached: boolean;
}

/** 화면에 그려지는 말풍선 하나다. */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  kind: "greeting" | "message" | "retrieval_fallback";
  generationState?: "streaming" | "complete" | "stopped" | "failed";
  segments?: ChatSegment[];
  actions?: ChatAction[];
  suggestedQuestions?: string[];
  /** 실패한 답변 말풍선 바로 아래에 표시할 사유다. */
  errorMessage?: string;
}

/** 서버로 보내는 질문 요청 본문이다. */
export interface ChatRequest {
  message: string;
  history: ChatHistoryItem[];
  audience: ApiAudience;
  tone: Tone;
  pageContext: PageContext;
  reasoningEnabled: boolean;
  uiSettings: ChatUiSettings;
  viewState: ChatPortfolioViewState;
}

/** `/api/chat/status` 응답이다. */
export interface ChatStatusResponse {
  status: "online" | "offline";
  checkedAt: string;
}
