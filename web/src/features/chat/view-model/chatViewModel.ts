/**
 * 채팅 application 상태를 화면 배치/행 옵션으로 투영한다.
 * canSend는 UI의 사전 차단용이며 실행 권한이 아니다. Provider의 동시 요청·
 * cooldown 검증은 반드시 그대로 통과해야 한다.
 * 시간은 타이머를 만들지 않고 Provider가 전달한 retryWaitSeconds만 읽는다.
 */
import type { ChatAvailability, ChatMessage } from "../types";
import { chatAvailabilityPresentation } from "../transport/chatAvailability.ts";
import { onboardingPresentation } from "../onboarding/onboardingPolicy.ts";

const EMPTY_QUESTIONS: readonly string[] = [];
export function suggestedQuestionKey(question: string): string {
  return question.normalize("NFKC").trim().replace(/\s+/g, " ")
    .replace(/[?？!！.。]+$/u, "").toLowerCase();
}
export interface ChatViewModelInput {
  readonly messages: readonly ChatMessage[];
  readonly availability: ChatAvailability;
  readonly guidedTourStatus: string;
  readonly isLoading: boolean;
  readonly retryWaitSeconds: number;
  readonly usedSuggestedQuestionKeys: ReadonlySet<string>;
  readonly error: string | null;
}
export type ChatViewModel = Readonly<ReturnType<typeof projectChatViewModel>>;

export function projectChatViewModel(input: ChatViewModelInput) {
  const { messages, availability, guidedTourStatus, isLoading, retryWaitSeconds,
    usedSuggestedQuestionKeys, error } = input;
  const latest = messages.at(-1);
  const hasConversation = messages.some(message => message.role === "user");
  const canSend = availability === "online" && !isLoading && retryWaitSeconds <= 0;
  const retryTargetMessageId = latest?.role === "assistant"
    && latest.generationState === "failed" && latest.retryAllowed === true ? latest.id : null;
  const latestActionMessageId = !isLoading && latest?.role === "assistant"
    && latest.generationState === "complete" && latest.recommendationsSuppressed !== true
    ? latest.id : null;
  const uniqueKeys = new Set<string>();
  const questions = latestActionMessageId ? (latest?.suggestedQuestions ?? []).filter(question => {
    const key = suggestedQuestionKey(question);
    if (!key || usedSuggestedQuestionKeys.has(key) || uniqueKeys.has(key)) return false;
    uniqueKeys.add(key);
    return true;
  }) : EMPTY_QUESTIONS;
  return {
    canSend, hasConversation, retryTargetMessageId,
    inputHistory: messages.filter(message => message.role === "user").map(message => message.content),
    availability: chatAvailabilityPresentation(availability, hasConversation),
    onboarding: onboardingPresentation({ availability, guidedTourStatus, isLoading, retryWaitSeconds }),
    lastMessageLength: latest?.content.length ?? 0,
    streamingContentLength: latest?.generationState === "streaming" ? latest.content.length : 0,
    composer: {
      canSend, showStop: isLoading,
      stopLabel: "중단",
      stopAriaLabel: "챗봇 응답 생성 중단",
      sendLabel: retryWaitSeconds > 0 ? `대기 ${retryWaitSeconds}초` : "전송",
    },
    error: error && !retryTargetMessageId ? {
      text: error, retryDisabled: retryWaitSeconds > 0,
      retryLabel: retryWaitSeconds > 0 ? `${retryWaitSeconds}초 후 다시 시도` : "다시 시도",
    } : null,
    rows: messages.map(message => ({
      message,
      includeComplement: message.id === latestActionMessageId,
      suggestedQuestions: message.id === latestActionMessageId ? questions : EMPTY_QUESTIONS,
      canRetry: message.id === retryTargetMessageId,
      retryWaitSeconds: message.id === latest?.id ? retryWaitSeconds : 0,
      showTourIntro: message.kind === "greeting",
      showOnboarding: message.kind === "greeting",
    })),
  } as const;
}

