/**
 * 화면에만 필요한 메시지 투영이다. 원본 메시지와 도구 결과를 수정하지 않는다.
 * generationState는 생성 수명, statusStage는 서버가 알린 진행 단계다. content 모양으로
 * 성공이나 역할을 추측하지 않고 메시지의 명시적 필드만 읽는다.
 * React/DOM/네트워크를 모르는 순수 함수이므로 동일 입력에는 동일 표시를 돌려준다.
 */
import { CHAT_QUICK_START_OPTION_BY_ACTION_ID, settingChoiceOptions } from "../constants.ts";
import { CHOICE_SETTING_TARGETS } from "../../portfolio-tools/schema.ts";
import { toolResultDisplayStatus, toolResultText } from "../workflow/toolResultPresentation.ts";
import { CHAT_FAILURE_NOTICE } from "../transport/chatFailure.ts";
import type { ActionId, ChatAction, ChatMessage, ChatUiSettings } from "../types";

/**
 * 지금 보고 있는 빠른 시작 목적지의 "짝"이다.
 * 한쪽을 이미 봤다면 나머지 하나를 마지막 답변에 덧붙여 다음 갈 곳을 준다.
 */
const QUICK_ACTION_COMPLEMENTS: Partial<Record<ActionId, ActionId>> = {
  project_overview: "research_optimization",
  research_optimization: "project_overview",
};

/** 추천 질문이 없을 때 넘기는 고정 빈 배열이다(memo가 깨지지 않게 한다). */
export const EMPTY_SUGGESTED_QUESTIONS: readonly string[] = [];

/**
 * 답변에 붙일 액션 중 실제로 보여 줄 것만 고른다.
 *
 * 개요는 어느 답변에나 붙어 중복되므로 빼고, 이미 그 화면에 와 있는
 * 목적지(activeQuickDestination)도 뺀다. 방금 도착한 곳으로 다시 가라는
 * 버튼은 잡음이기 때문이다.
 */
export function visibleResponseActions(
  actions: readonly ChatAction[],
  activeQuickDestination: ActionId | null,
) {
  return actions.filter(
    (action) =>
      action.id !== "overview" && action.id !== activeQuickDestination,
  );
}

/**
 * 말풍선 하단에 모아 보여 줄 액션 목록을 만든다.
 *
 * 문단마다 이미 붙은 액션, 개요, 현재 위치, 중복은 모두 제외한다. 마지막
 * 답변(includeComplement)에는 짝이 되는 빠른 시작 목적지를 하나 덧붙여
 * 대화가 막다른 곳에서 끝나지 않게 한다.
 */
export function summaryActionsForMessage(
  message: ChatMessage,
  activeQuickDestination: ActionId | null,
  includeComplement: boolean,
) {
  if (message.recommendationsSuppressed === true) return [];
  const segments = message.segments ?? [];
  const inlineActionIds = new Set(
    segments.flatMap((segment) =>
      visibleResponseActions(segment.actions, activeQuickDestination).map(
        (action) => action.id,
      ),
    ),
  );
  const seen = new Set<string>();
  const actions = (message.actions ?? []).filter((action) => {
    if (
      action.id === "overview" ||
      action.id === activeQuickDestination ||
      inlineActionIds.has(action.id) ||
      seen.has(action.id)
    ) {
      return false;
    }
    seen.add(action.id);
    return true;
  });

  const complementId = activeQuickDestination
    ? QUICK_ACTION_COMPLEMENTS[activeQuickDestination]
    : undefined;
  const complementOption = complementId
    ? CHAT_QUICK_START_OPTION_BY_ACTION_ID.get(complementId)
    : undefined;
  if (
    includeComplement &&
    complementOption &&
    !inlineActionIds.has(complementOption.actionId) &&
    !seen.has(complementOption.actionId)
  ) {
    actions.push({
      id: complementOption.actionId,
      label: complementOption.label,
    });
  }

  return actions;
}


/** 서버가 알린 진행 단계별 상태 문구다. */
const STAGE_STATUS_TEXT: Readonly<Record<NonNullable<ChatMessage["statusStage"]>, string>> = {
  answering: "응답 생성 중",
  searching: "자료 찾는 중",
  working: "화면 조작 중",
};

/**
 * 설정 선택지를 버튼 목록으로 투영한다.
 *
 * 버튼은 턴과 무관하게 언제든 설정을 바꾸는 작은 설정 패널이라, 현재 값은 띄울 때가 아니라
 * 지금 화면 설정(uiSettings)으로 표시한다. 설정을 모르면 현재 값을 표시하지 않는다.
 */
function projectSettingChoice(message: ChatMessage, uiSettings: ChatUiSettings | undefined) {
  const choice = message.settingChoice;
  if (!choice) return null;
  const { title, options } = settingChoiceOptions(choice.setting);
  const current = uiSettings?.[CHOICE_SETTING_TARGETS[choice.setting].settingsKey];
  return {
    callId: choice.callId,
    setting: choice.setting,
    title,
    hint: `${title} 선택지예요. 누르면 바로 적용되고, 여러 번 바꿔 볼 수 있어요.`,
    options: options.map((option) => ({ ...option, current: option.value === current })),
  } as const;
}

export interface MessageViewModelInput {
  readonly message: ChatMessage;
  readonly activeQuickDestination: ActionId | null;
  readonly includeComplement: boolean;
  readonly suggestedQuestions: readonly string[];
  readonly slowResponse: boolean;
  readonly canRetry: boolean;
  readonly retryWaitSeconds: number;
  /** 설정 선택지의 현재 값 표시에 쓰는 지금 화면 설정이다. 선택지가 있는 답변에만 넘긴다. */
  readonly uiSettings?: ChatUiSettings;
}

/** Readonly 표시는 도메인 상태가 아니라 렌더 결과라는 경계를 타입에도 남긴다. */
export type MessageViewModel = Readonly<ReturnType<typeof projectMessageViewModel>>;
export function projectMessageViewModel({
  message, activeQuickDestination, includeComplement, suggestedQuestions, slowResponse,
  canRetry, retryWaitSeconds, uiSettings,
}: MessageViewModelInput) {
  const toolResults = message.toolResults ?? [];
  const summaryActions = summaryActionsForMessage(message, activeQuickDestination, includeComplement);
  const hasFailed = message.generationState === "failed";
  const isStreaming = message.generationState === "streaming";
  const hasActiveStatus = isStreaming;
  const isIncompleteAnswer =
    message.role === "assistant" &&
    Boolean(message.generationState) &&
    message.generationState !== "complete";
  const statusText = slowResponse ? "평소보다 오래 걸리고 있어요. 기다리거나 중단할 수 있어요"
    : STAGE_STATUS_TEXT[message.statusStage ?? "answering"];
  const showSuggestedQuestions = suggestedQuestions.length > 0 && message.recommendationsSuppressed !== true;
  const choice = projectSettingChoice(message, uiSettings);
  // 첫 delta 전에는 빈 말풍선을 만들지 않는다. 도구 칩 등 실제 내용이
  // 있으면 말풍선을 유지하고, 생성 상태만 그 아래 별도 줄에서 갱신한다.
  const showMessageBubble = !hasActiveStatus
    || Boolean(message.content)
    || toolResults.length > 0 || choice !== null
    || summaryActions.length > 0 || showSuggestedQuestions;
  // 화면을 이미 바꾼 뒤 실패했다면 바뀐 화면이 그대로라는 사실을 함께 알린다.
  const changedScreen = toolResults.some(result => result.status === "applied" || result.status === "arrived");
  const failureNotice = message.failureNotice ?? CHAT_FAILURE_NOTICE;

  return {
    id: message.id,
    isStreaming, hasFailed, hasActiveStatus, isIncompleteAnswer,
    showMessageBubble, showSuggestedQuestions,
    bodyKind: isIncompleteAnswer ? "streaming"
      : message.role === "assistant" ? "markdown" : "plain",
    segments: (message.segments?.length ? message.segments : [{ markdown: message.content, actions: [] }])
      .map(segment => ({ markdown: segment.markdown, actions: message.recommendationsSuppressed === true
        ? [] : visibleResponseActions(segment.actions, activeQuickDestination) })),
    summaryActions,
    status: hasActiveStatus ? { text: statusText, dots: true } : null,
    choice,
    stoppedLabel: message.generationState === "stopped" ? "응답 생성이 중단되었습니다" : null,
    failure: hasFailed ? {
      label: "응답 생성을 완료하지 못했습니다",
      notice: changedScreen ? `${failureNotice} 이미 바뀐 화면은 그대로 유지됩니다.` : failureNotice,
    } : null,
    retry: canRetry && hasFailed ? {
      disabled: retryWaitSeconds > 0,
      label: retryWaitSeconds > 0 ? `${retryWaitSeconds}초 후 다시 시도` : "다시 시도",
    } : null,
    chips: toolResults.map(result => ({
      id: result.callId,
      status: toolResultDisplayStatus(result, message.generationState),
      text: toolResultText(result, message.generationState),
    })),
  } as const;
}
