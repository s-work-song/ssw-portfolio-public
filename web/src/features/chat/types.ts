export type AudienceChoice =
  | "default"
  | "recruiter"
  | "developer"
  | "collaboration"
  | "personality"
  | "values"
  | "casual";

export type ApiAudience =
  | "default"
  | "hiring"
  | "developer"
  | "collaboration"
  | "casual";

export type Tone = "official" | "manager" | "mascot";

export type ChatAvailability = "idle" | "checking" | "online" | "offline";

/** 채팅 패널이 열리고 닫힐 때 재생할 연출이다. PC 화면에만 적용된다. */
export type ChatAnimation = "none" | "slide" | "jelly";

/**
 * 스트리밍으로 도착하는 답변 텍스트에 입히는 연출이다.
 * 전체 길이를 모르는 SSE 특성상 "도착 시점" 기준으로 재생한다.
 */
export type ChatStreamAnimation =
  | "none"
  | "typewriter"
  | "word-fade"
  | "token-chunks"
  | "blur-focus"
  | "slide-up"
  | "skeleton"
  | "mask-wipe"
  | "scramble"
  | "letter-drop"
  | "highlight-trail";

export type PageContext =
  | "default"
  | "overview"
  | "resume"
  | "cover_letter"
  | "research"
  | "log";

export interface ChatUiSettings {
  theme: "light" | "dark" | "system";
  accent: "indigo" | "emerald" | "amber" | "rose" | "violet";
  chatLayout: "floating" | "dock";
  chatFont: "pretendard" | "noto-sans-kr" | "system";
  chatFontSize: "small" | "medium" | "large" | "xlarge";
}

export type ChatPortfolioPageId =
  | "landing"
  | "main"
  | "overview"
  | "resume"
  | "cover-letter"
  | "research"
  | "log"
  | "settings"
  | "unknown";

export interface ChatPortfolioViewState {
  page: ChatPortfolioPageId;
  anchor: string | null;
  researchYear: ChatPortfolioResearchYear | null;
  researchDetails: {
    expanded: number;
    total: number;
    expandedYears: ChatPortfolioResearchYear[];
  } | null;
}

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

export interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface ChatSource {
  docId: string;
  chunkId: string;
  title: string;
  source: string;
  section: string;
  score: number;
  excerpt: string;
  url: string | null;
}

export interface ChatAction {
  id: ActionId;
  label: string;
}

export interface ChatSegment {
  markdown: string;
  actions: ChatAction[];
}

export interface ChatLogSearchToolExecution {
  type: "show_portfolio_log_results";
  toolCallId: string;
  toolName: "search-portfolio-logs";
  query: string;
  matchedSlugs: string[];
}

export interface ChatThemeToolExecution {
  type: "set_portfolio_theme";
  toolCallId: string;
  toolName: "set-portfolio-theme";
  theme: "light" | "dark";
}

export interface ChatAccentToolExecution {
  type: "set_portfolio_accent";
  toolCallId: string;
  toolName: "set-portfolio-accent";
  accent: "indigo" | "emerald" | "amber" | "rose" | "violet";
}

export interface ChatLayoutToolExecution {
  type: "set_portfolio_chat_layout";
  toolCallId: string;
  toolName: "set-portfolio-chat-layout";
  layout: "floating" | "dock";
}

export interface ChatFontToolExecution {
  type: "set_portfolio_chat_font";
  toolCallId: string;
  toolName: "set-portfolio-chat-font";
  font: "pretendard" | "noto-sans-kr" | "system";
}

export interface ChatFontSizeToolExecution {
  type: "set_portfolio_chat_font_size";
  toolCallId: string;
  toolName: "set-portfolio-chat-font-size";
  size: "small" | "medium" | "large" | "xlarge";
}

export interface ChatStreamAnimationToolExecution {
  type: "set_portfolio_stream_animation";
  toolCallId: string;
  toolName: "set-portfolio-stream-animation";
  animation: ChatStreamAnimation;
}

export interface ChatUiSettingsReportToolExecution {
  type: "report_portfolio_ui_settings";
  toolCallId: string;
  toolName: "get-portfolio-ui-settings";
  available: boolean;
  uiSettings: {
    theme: "light" | "dark" | "system";
    accent: "indigo" | "emerald" | "amber" | "rose" | "violet";
    chatLayout: "floating" | "dock";
    chatFont: "pretendard" | "noto-sans-kr" | "system";
    chatFontSize: "small" | "medium" | "large" | "xlarge";
  } | null;
}

export interface ChatSettingsNavigationToolExecution {
  type: "open_portfolio_settings";
  toolCallId: string;
  toolName: "open-portfolio-settings";
}

export type ChatPortfolioViewAction =
  | "main"
  | "overview"
  | "resume"
  | "cover-letter"
  | "research"
  | "research-2022"
  | "research-2023"
  | "research-2024"
  | "research-2025"
  | "research-2026"
  | "log"
  | "expand-research-details"
  | "collapse-research-details"
  | "expand-research-year-details"
  | "collapse-research-year-details";

export type ChatPortfolioResearchYear =
  | "2022"
  | "2023"
  | "2024"
  | "2025"
  | "2026";

export interface ChatPortfolioViewToolExecution {
  type: "control_portfolio_view";
  toolCallId: string;
  toolName: "control-portfolio-view";
  action: ChatPortfolioViewAction;
  year?: ChatPortfolioResearchYear;
}

export interface ChatPortfolioViewStateReportToolExecution {
  type: "report_portfolio_view_state";
  toolCallId: string;
  toolName: "get-portfolio-view-state";
  available: boolean;
  viewState: ChatPortfolioViewState | null;
}

export type ChatToolExecution =
  | ChatLogSearchToolExecution
  | ChatThemeToolExecution
  | ChatAccentToolExecution
  | ChatLayoutToolExecution
  | ChatFontToolExecution
  | ChatFontSizeToolExecution
  | ChatStreamAnimationToolExecution
  | ChatUiSettingsReportToolExecution
  | ChatSettingsNavigationToolExecution
  | ChatPortfolioViewToolExecution
  | ChatPortfolioViewStateReportToolExecution;

export interface ChatResponse {
  mode: "model" | "retrieval_fallback";
  status: "online" | "upstream_offline";
  generated: boolean;
  answer: string;
  segments: ChatSegment[];
  audience: ApiAudience;
  tone: Tone;
  pageContext: PageContext;
  sources: ChatSource[];
  actions: ChatAction[];
  suggestedQuestions: string[];
  toolExecutions: ChatToolExecution[];
  cached: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  kind: "greeting" | "message" | "retrieval_fallback";
  generationState?: "streaming" | "complete" | "stopped" | "failed";
  segments?: ChatSegment[];
  sources?: ChatSource[];
  actions?: ChatAction[];
  suggestedQuestions?: string[];
}

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

export interface ChatStatusResponse {
  status: "online" | "offline";
  checkedAt: string;
}
