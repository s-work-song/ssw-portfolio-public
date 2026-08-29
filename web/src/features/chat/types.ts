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
}

export type ActionId =
  | "overview"
  | "resume"
  | "cover_letter"
  | "research"
  | "log"
  | "project_overview"
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
  | "log_repeated_grievance"
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

export interface ChatUiSettingsReportToolExecution {
  type: "report_portfolio_ui_settings";
  toolCallId: string;
  toolName: "get-portfolio-ui-settings";
  available: boolean;
  uiSettings: {
    theme: "light" | "dark" | "system";
    accent: "indigo" | "emerald" | "amber" | "rose" | "violet";
    chatLayout: "floating" | "dock";
  } | null;
}

export type ChatToolExecution =
  | ChatLogSearchToolExecution
  | ChatThemeToolExecution
  | ChatAccentToolExecution
  | ChatLayoutToolExecution
  | ChatUiSettingsReportToolExecution;

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
}

export interface ChatStatusResponse {
  status: "online" | "offline";
  checkedAt: string;
}
