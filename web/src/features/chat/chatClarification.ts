import {
  ACCENTS, CHAT_FONTS, CHAT_FONT_SIZES, CHAT_LAYOUTS, CHAT_STREAM_ANIMATIONS, THEMES,
} from "../portfolio-tools/settings.ts";
import { ACCENTS as ACCENT_PALETTE } from "../../context/accentPalette.ts";
import type {
  ChatClarification, ChatClarificationReply, ChatMessage, ChatRequest, ChatSettingChangeToolName, ChatUiSettings,
} from "./types";

export const CLARIFICATION_PROTOCOL = "portfolio-clarification-v1" as const;
export const CLARIFICATION_CANCEL_MESSAGE = "설정 변경 요청을 취소할게.";
const REASONS = ["missing_value", "ambiguous_target", "unsupported_value", "unintelligible"] as const;
const VALUES = {
  set_portfolio_theme: THEMES,
  set_portfolio_accent: ACCENTS,
  set_portfolio_chat_layout: CHAT_LAYOUTS,
  set_portfolio_chat_font: CHAT_FONTS,
  set_portfolio_chat_font_size: CHAT_FONT_SIZES,
  set_portfolio_stream_animation: CHAT_STREAM_ANIMATIONS,
} satisfies Record<ChatSettingChangeToolName, readonly string[]>;
const TARGETS = Object.keys(VALUES) as ChatSettingChangeToolName[];
const TARGET_LABELS: Record<ChatSettingChangeToolName, string> = {
  set_portfolio_theme: "화면 모드", set_portfolio_accent: "포인트 색상", set_portfolio_chat_layout: "채팅 배치",
  set_portfolio_chat_font: "채팅 글꼴", set_portfolio_chat_font_size: "채팅 글자 크기", set_portfolio_stream_animation: "스트리밍 연출",
};
const VALUE_LABELS: Record<ChatSettingChangeToolName, Readonly<Record<string, string>>> = {
  set_portfolio_theme: { light: "라이트", dark: "다크", system: "시스템" },
  set_portfolio_accent: Object.fromEntries(ACCENTS.map(key => [key, ACCENT_PALETTE[key].label])),
  set_portfolio_chat_layout: { floating: "플로팅", dock: "오른쪽 고정" },
  set_portfolio_chat_font: { pretendard: "프리텐다드", "noto-sans-kr": "노토 산스 KR", system: "시스템" },
  set_portfolio_chat_font_size: { small: "작게", medium: "보통", large: "크게", xlarge: "매우 크게" },
  set_portfolio_stream_animation: { none: "없음", typewriter: "타자기", "word-fade": "단어 페이드", "token-chunks": "토큰 청크",
    "blur-focus": "블러 포커스", "slide-up": "슬라이드 업", skeleton: "스켈레톤", "mask-wipe": "마스크 와이프",
    scramble: "스크램블", "letter-drop": "레터 드롭", "highlight-trail": "하이라이트 트레일" },
};
const SETTINGS_KEYS = {
  set_portfolio_theme: "theme", set_portfolio_accent: "accent", set_portfolio_chat_layout: "chatLayout",
  set_portfolio_chat_font: "chatFont", set_portfolio_chat_font_size: "chatFontSize", set_portfolio_stream_animation: "streamAnimation",
} as const;
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const keys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).every(key => allowed.includes(key));
const id = (value: unknown): value is string => typeof value === "string" && value.length >= 1 && value.length <= 128
  && !/[^A-Za-z0-9._:-]/u.test(value);
const text = (value: unknown): value is string => typeof value === "string" && Boolean(value.trim());
const target = (value: unknown): value is ChatSettingChangeToolName | null => value === null || TARGETS.includes(value as ChatSettingChangeToolName);
const reason = (value: unknown): value is ChatClarification["reason"] => REASONS.includes(value as ChatClarification["reason"]);

export function clarificationValues(value: Pick<ChatClarification, "target" | "reason">): readonly string[] {
  return value.target ? VALUES[value.target] : value.reason === "ambiguous_target" ? TARGETS : [];
}

/** 서버와 같은 질문 정본을 사용해 표시 후 회신이 거절되는 변조·어긋남을 막는다. */
export function clarificationQuestion(value: Pick<ChatClarification, "target" | "reason">): string | undefined {
  if (value.target) {
    const label = TARGET_LABELS[value.target];
    return value.reason === "unsupported_value" ? `요청한 ${label} 값은 지원하지 않아요. 어떤 값으로 바꿀까요?`
      : `${label} 설정을 어떤 값으로 바꿀까요?`;
  }
  if (value.reason === "ambiguous_target") return "어떤 설정을 바꾸려는지 알려 주세요.";
  if (value.reason === "unsupported_value") return "이 사이트에서 지원하는 설정이나 화면 이동 중 어떤 작업을 원하시는지 알려 주세요.";
  if (value.reason === "unintelligible") return "요청을 이해하지 못했어요. 원하는 작업이나 바꾸려는 설정을 조금 더 구체적으로 알려 주세요.";
  return undefined;
}

/** 기존 이력과 별개로 표시·회신할 정본 옵션만 검증한다. CSS나 실행 명령은 받지 않는다. */
export function parseChatClarification(value: unknown, context: Pick<ChatRequest, "conversationId" | "turnId" | "toolTask"> = {}): ChatClarification | undefined {
  if (!record(value) || !keys(value, ["schemaVersion", "id", "reason", "target", "question", "choices", "continuation"])
    || value.schemaVersion !== CLARIFICATION_PROTOCOL || !id(value.id) || !reason(value.reason) || !target(value.target)
    || !text(value.question) || !Array.isArray(value.choices) || !record(value.continuation)) return undefined;
  const targetName = value.target;
  if (value.question !== clarificationQuestion({ reason: value.reason, target: targetName })) return undefined;
  const allowed = clarificationValues({ reason: value.reason, target: value.target });
  const seen = new Set<string>();
  if (value.choices.length !== allowed.length || value.choices.some((choice, index) => {
    if (!record(choice) || !keys(choice, ["value", "label"]) || typeof choice.value !== "string" || !text(choice.label)
      || choice.value !== allowed[index] || seen.has(choice.value)
      || choice.label !== clarificationChoiceLabel({ target: targetName }, choice.value)) return true;
    seen.add(choice.value);
    return false;
  })) return undefined;
  const continuation = value.continuation;
  if (!keys(continuation, ["conversationId", "originTurnId", "originalMessage", "exchanges", "sourceTurnId", "sourceTaskId", "sourceGeneration"])
    || !(continuation.conversationId === null || id(continuation.conversationId)) || !id(continuation.originTurnId)
    || !text(continuation.originalMessage) || !id(continuation.sourceTurnId) || value.id !== continuation.sourceTurnId
    || !(continuation.sourceTaskId === null || id(continuation.sourceTaskId))
    || !(continuation.sourceGeneration === null || (Number.isSafeInteger(continuation.sourceGeneration)
      && Number(continuation.sourceGeneration) >= 1 && Number(continuation.sourceGeneration) <= 2_147_483_647))
    || (continuation.sourceTaskId === null) !== (continuation.sourceGeneration === null)
    || !Array.isArray(continuation.exchanges)) return undefined;
  if (context.conversationId !== undefined && continuation.conversationId !== context.conversationId) return undefined;
  if (context.turnId !== undefined && continuation.sourceTurnId !== context.turnId) return undefined;
  if (context.toolTask && (continuation.sourceTaskId !== context.toolTask.taskId
    || continuation.sourceGeneration !== context.toolTask.generation)) return undefined;
  if (continuation.exchanges.some(exchange => !record(exchange)
    || !keys(exchange, ["reason", "target", "reply", "choiceValue"]) || !reason(exchange.reason) || !target(exchange.target)
    || (exchange.reason === "missing_value" && exchange.target === null)
    || !text(exchange.reply) || (exchange.choiceValue !== undefined && (typeof exchange.choiceValue !== "string"
      || !clarificationValues({ reason: exchange.reason, target: exchange.target }).includes(exchange.choiceValue))))) return undefined;
  return structuredClone(value) as unknown as ChatClarification;
}

export function clarificationChoiceLabel(clarification: Pick<ChatClarification, "target">, value: string): string {
  return clarification.target ? VALUE_LABELS[clarification.target][value] ?? value : TARGET_LABELS[value as ChatSettingChangeToolName] ?? value;
}

/** 정본 한글 라벨의 받침이다. 현재 비한글 라벨 '노토 산스 KR'에는 '로'를 붙인다. */
function finalConsonant(label: string): number {
  const last = label.charCodeAt(label.length - 1);
  return last >= 0xac00 && last <= 0xd7a3 ? (last - 0xac00) % 28 : 0;
}

export function clarificationChoicePrompt(clarification: ChatClarification, value: string): string | undefined {
  if (!clarification.choices.some(choice => choice.value === value)) return undefined;
  const label = clarificationChoiceLabel(clarification, value);
  if (!clarification.target) return `${label} 설정을 변경하고 싶어.`;
  const setting = TARGET_LABELS[clarification.target];
  const objectParticle = finalConsonant(setting) ? "을" : "를";
  const final = finalConsonant(label);
  const valueParticle = final !== 0 && final !== 8 ? "으로" : "로";
  const requestedValue = clarification.target === "set_portfolio_chat_font_size" && value !== "medium"
    ? label : `${label}${valueParticle}`;
  // 대상과 값을 다른 문장으로 분리하면 서버가 첫 문장만 값 없는 변경으로 해석할 수 있다.
  return `${setting}${objectParticle} ${requestedValue} 변경해 줘.`;
}

/** 활성 질문에 대한 소수의 명시 취소만 처리한다. 일반 문장이나 과거 작업의 undo를 추측하지 않는다. */
export function isExplicitClarificationCancel(message: string): boolean {
  return ["취소", "됐어", "안 바꿀래", "안바꿀래", CLARIFICATION_CANCEL_MESSAGE].includes(message.trim());
}

export function clarificationCurrentValue(clarification: ChatClarification, settings: ChatUiSettings): string | undefined {
  return clarification.target ? settings[SETTINGS_KEYS[clarification.target]] : undefined;
}

/** 서버 문자열을 색으로 쓰지 않고 로컬 정본 swatch와 대비 안전한 두 라벨 색만 만든다. */
export function clarificationAccentColors(clarification: ChatClarification, value: string): { swatch: string; light: string; dark: string } | undefined {
  if (clarification.target !== "set_portfolio_accent" || !ACCENTS.includes(value as typeof ACCENTS[number])) return undefined;
  const swatch = ACCENT_PALETTE[value as typeof ACCENTS[number]].color;
  const mix = (toward: number, ratio: number) => `#${[1, 3, 5].map(offset => {
    const channel = Number.parseInt(swatch.slice(offset, offset + 2), 16);
    return Math.round(channel * (1 - ratio) + toward * ratio).toString(16).padStart(2, "0");
  }).join("")}`;
  // 고정 중립 버튼 표면(--chat-bg) 대비: light는 검정 25%, dark는 흰색 55%를 섞는다.
  return { swatch, light: mix(0, 0.25), dark: mix(255, 0.55) };
}

export interface PendingChatClarification {
  messageId: string;
  epoch: number;
  clarification: ChatClarification;
}

function immutable<T>(value: T): T {
  const copy = structuredClone(value);
  const freeze = (item: unknown): void => {
    if (item === null || typeof item !== "object" || Object.isFrozen(item)) return;
    Object.values(item).forEach(freeze);
    Object.freeze(item);
  };
  freeze(copy);
  return copy;
}

/** 렌더보다 먼저 소모되는 일회성 선택권이다. toolTask의 세대나 native 이력은 건드리지 않는다. */
export class ChatClarificationSession {
  private epoch = 0;
  private pending: PendingChatClarification | null = null;

  get current(): PendingChatClarification | null { return this.pending; }

  activate(messageId: string, clarification: ChatClarification): PendingChatClarification {
    this.pending = immutable({ messageId, epoch: ++this.epoch, clarification });
    return this.pending;
  }

  matches(messageId: string, epoch: number, messages: readonly ChatMessage[]): boolean {
    const last = messages.at(-1);
    return Boolean(this.pending && this.pending.messageId === messageId && this.pending.epoch === epoch
      && last?.id === messageId && last.role === "assistant" && last.generationState === "complete"
      && !last.clarificationState && last.clarification?.id === this.pending.clarification.id);
  }

  consume(messageId: string, epoch: number, messages: readonly ChatMessage[], choiceValue?: string): ChatClarificationReply | undefined {
    if (!this.matches(messageId, epoch, messages) || !this.pending
      || (choiceValue !== undefined && !this.pending.clarification.choices.some(choice => choice.value === choiceValue))) return undefined;
    const reply = immutable({ ...this.pending.clarification, ...(choiceValue === undefined ? {} : { choiceValue }) });
    this.clear();
    return reply;
  }

  clear(): void { this.epoch++; this.pending = null; }
}
