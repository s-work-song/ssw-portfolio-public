"use client";

/**
 * 말풍선 하나를 그리는 표현 전용 모듈이다.
 *
 * 스트리밍 중에는 delta가 도착할 때마다 messages 배열이 통째로 새로 만들어져
 * 목록 전체가 리렌더 후보가 된다. 이미 완료된 말풍선은 props가 그대로라
 * memo가 리렌더를 막아 주므로, 이 컴포넌트를 위젯 본체에서 떼어 두는 것이
 * 긴 대화의 성능을 지키는 핵심이다.
 *
 * 마크다운 렌더러는 여기서만 필요하고 무거워서, 첫 화면 번들에 싣지 않고
 * 필요할 때 불러온다(`loadMarkdownRenderer`).
 */
import {
  memo,
  useEffect,
  useState,
  type CSSProperties,
} from "react";
import { CHAT_QUICK_START_OPTION_BY_ACTION_ID } from "./constants";
import { StreamingText } from "./StreamingText";
import type {
  ActionId,
  ChatAction,
  ChatMessage,
  ChatStreamAnimation,
} from "./types";
import styles from "./ChatWidget.module.css";

type MarkdownModule = typeof import("react-markdown");
type MarkdownRenderer = MarkdownModule["default"];
type MarkdownComponents = NonNullable<
  Parameters<MarkdownRenderer>[0]["components"]
>;

/** 한 번 불러온 렌더러는 모듈에 남겨 두 번째 말풍선부터는 즉시 그린다. */
let markdownRenderer: MarkdownRenderer | null = null;
let markdownRequest: Promise<MarkdownRenderer> | null = null;

/**
 * 마크다운 렌더러를 지연 로딩한다. 이미 불렀으면 같은 약속을 돌려준다.
 *
 * 채팅을 여는 순간 미리 호출해 두면 첫 답변이 완료될 즈음에는 이미 준비돼
 * 있어 평문 대체 표시가 눈에 띄지 않는다. 실패해도 예외를 밖으로 던지지
 * 않게 호출한 쪽이 `void`로 흘려보낸다.
 */
export function loadMarkdownRenderer(): Promise<MarkdownRenderer> {
  markdownRequest ??= import("react-markdown").then(
    (module) => {
      markdownRenderer = module.default;
      return module.default;
    },
    (error: unknown) => {
      // 실패한 약속을 캐시에 남기면 이후 시도가 모두 같은 실패를 되풀이한다.
      markdownRequest = null;
      throw error;
    },
  );
  return markdownRequest;
}

/**
 * 답변 마크다운에서 링크와 이미지를 무력화하는 렌더 규칙이다.
 *
 * 답변 문자열은 모델이 만든 것이라 임의 주소가 섞일 수 있다. 링크는 글자만
 * 남기고 이미지는 아예 그리지 않아, 답변이 외부로 나가는 통로가 되지 않게 한다.
 */
const MARKDOWN_COMPONENTS: MarkdownComponents = {
  a: ({ children }) => <>{children}</>,
  img: () => null,
};

/**
 * 마크다운 문단 하나를 그린다. 렌더러가 아직 도착하지 않았으면 평문을 보인다.
 *
 * 대체 표시는 서식만 없을 뿐 내용은 같아서, 로딩이 끝나면 같은 자리에서
 * 서식만 입혀진다. 렌더러 로딩이 끝나기 전에 언마운트되면 상태 갱신을
 * 건너뛴다.
 */
function MarkdownAnswer({ markdown }: Readonly<{ markdown: string }>) {
  const [Renderer, setRenderer] = useState<MarkdownRenderer | null>(
    () => markdownRenderer,
  );

  useEffect(() => {
    if (Renderer) return;
    let cancelled = false;
    void loadMarkdownRenderer()
      .then((component) => {
        if (!cancelled) setRenderer(() => component);
      })
      // 실패하면 평문 대체 표시를 그대로 둔다. 답변 내용은 이미 보이고 있다.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [Renderer]);

  if (!Renderer) return <p>{markdown}</p>;
  return (
    <Renderer skipHtml components={MARKDOWN_COMPONENTS}>
      {markdown}
    </Renderer>
  );
}

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

/**
 * 액션 버튼 하나다.
 *
 * 빠른 시작 목적지면 화살표가 붙은 강조 스타일과 온보딩과 같은 문구를 쓴다.
 * 같은 곳으로 가는 버튼이 화면마다 달라 보이지 않게 하기 위함이다.
 */
export function ResponseActionButton({
  action,
  onActivate,
}: Readonly<{
  action: ChatAction;
  onActivate: (actionId: ActionId) => void;
}>) {
  const quickStartOption = CHAT_QUICK_START_OPTION_BY_ACTION_ID.get(action.id);

  return (
    <button
      type="button"
      className={quickStartOption ? styles.responseQuickAction : undefined}
      onClick={() => onActivate(action.id)}
    >
      <span>{quickStartOption?.label ?? action.label}</span>
      {quickStartOption && (
        <span className={styles.responseQuickActionArrow} aria-hidden="true">
          →
        </span>
      )}
    </button>
  );
}

interface MessageItemProps {
  message: ChatMessage;
  activeQuickDestination: ActionId | null;
  streamAnimation: ChatStreamAnimation;
  /** 마지막 답변에만 붙는 보완 액션을 포함할지 여부다. */
  includeComplement: boolean;
  suggestedQuestions: readonly string[];
  revealCompletionControls: boolean;
  /** 오래 걸리는 중이라 안내 문구를 바꿔야 하는 상태다. */
  slowResponse: boolean;
  /** 이 말풍선에서 재시도 버튼을 노출할지 여부다. */
  canRetry: boolean;
  retryWaitSeconds: number;
  onActivateAction: (actionId: ActionId) => void;
  onAskSuggestedQuestion: (question: string) => void;
  onRetry: () => void;
}

/**
 * 말풍선 하나를 그리는 단위다. 스트리밍 중에는 delta마다 messages 배열이
 * 바뀌지만, 이미 완료된 말풍선은 props가 그대로라 memo가 리렌더를 막는다.
 *
 * 상태에 따라 세 가지 몸통 중 하나를 그린다. (1) 아직 완료되지 않은 답변은
 * 연출이 붙은 단일 문단, (2) 완료된 답변은 문단별 마크다운과 액션,
 * (3) 사용자 말풍선은 평문이다. 생성 중 안내 문구는 `streaming`일 때만
 * 보여 준다. 실패·중단 배지 아래에 "생성하고 있어요"가 함께 뜨면 서로
 * 모순된 안내가 되기 때문이다.
 */
export const MessageItem = memo(function MessageItem({
  message,
  activeQuickDestination,
  streamAnimation,
  includeComplement,
  suggestedQuestions,
  revealCompletionControls,
  slowResponse,
  canRetry,
  retryWaitSeconds,
  onActivateAction,
  onAskSuggestedQuestion,
  onRetry,
}: MessageItemProps) {
  const summaryActions = summaryActionsForMessage(
    message,
    activeQuickDestination,
    includeComplement,
  );
  const hasFailed = message.generationState === "failed";
  const isStreaming = message.generationState === "streaming";
  const isIncompleteAnswer =
    message.role === "assistant" &&
    Boolean(message.generationState) &&
    message.generationState !== "complete";
  /** 아직 한 글자도 오지 않은 "생성 중"에만 보여 주는 대기 문구다. */
  const pendingNotice = isStreaming
    ? slowResponse
      ? "평소보다 오래 걸리고 있어요. 기다리거나 중단할 수 있어요"
      : "응답을 생성하고 있어요…"
    : null;

  return (
    <article
      className={[
        styles.message,
        message.role === "user"
          ? styles.userMessage
          : styles.assistantMessage,
        message.kind === "retrieval_fallback" ? styles.fallbackMessage : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {message.kind === "retrieval_fallback" && (
        <strong className={styles.offlineBadge}>
          오프라인 · 생성 답변 없음
        </strong>
      )}
      {isStreaming && (
        <strong className={styles.generationBadge}>생성 중</strong>
      )}
      {message.generationState === "stopped" && (
        <strong className={styles.stoppedBadge}>
          응답 생성이 중단되었습니다
        </strong>
      )}
      {hasFailed && (
        <strong className={styles.failedBadge}>
          응답 생성을 완료하지 못했습니다
        </strong>
      )}
      {isIncompleteAnswer ? (
        (message.content || pendingNotice) && (
          <p className={`${styles.messageText} ${styles.partialText}`}>
            {message.content ? (
              <StreamingText
                text={message.content}
                animation={streamAnimation}
                isStreaming={isStreaming}
              />
            ) : (
              pendingNotice
            )}
          </p>
        )
      ) : message.role === "assistant" ? (
        <div className={styles.answerSegments}>
          {(message.segments?.length
            ? message.segments
            : [{ markdown: message.content, actions: [] }]
          ).map((segment, segmentIndex) => {
            const segmentActions = visibleResponseActions(
              segment.actions,
              activeQuickDestination,
            );
            return (
              <div
                className={styles.answerSegment}
                key={`${message.id}-segment-${segmentIndex}`}
              >
                <div className={styles.markdownMessage}>
                  <MarkdownAnswer markdown={segment.markdown} />
                </div>
                {segmentActions.length > 0 && (
                  <nav
                    className={[
                      styles.actions,
                      styles.inlineActions,
                      revealCompletionControls
                        ? styles.completionActions
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-label="이 문단과 관련된 페이지"
                    style={
                      {
                        "--completion-delay": `${80 + segmentIndex * 70}ms`,
                      } as CSSProperties
                    }
                  >
                    {segmentActions.map((action) => (
                      <ResponseActionButton
                        key={action.id}
                        action={action}
                        onActivate={onActivateAction}
                      />
                    ))}
                  </nav>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className={styles.messageText}>{message.content}</p>
      )}
      {hasFailed && (message.errorMessage || canRetry) && (
        <div className={styles.messageFailure} role="alert">
          {message.errorMessage && <p>{message.errorMessage}</p>}
          {canRetry && (
            <button
              type="button"
              disabled={retryWaitSeconds > 0}
              onClick={onRetry}
            >
              {retryWaitSeconds > 0
                ? `${retryWaitSeconds}초 후 다시 시도`
                : "다시 시도"}
            </button>
          )}
        </div>
      )}
      {summaryActions.length > 0 && (
        <nav
          className={[
            styles.actions,
            styles.summaryActions,
            revealCompletionControls ? styles.completionActions : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label="관련 페이지"
        >
          {summaryActions.map((action) => (
            <ResponseActionButton
              key={action.id}
              action={action}
              onActivate={onActivateAction}
            />
          ))}
        </nav>
      )}
      {suggestedQuestions.length > 0 && (
        <nav
          className={[
            styles.suggestedQuestions,
            revealCompletionControls ? styles.completionSuggestions : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label="이어서 물어볼 질문"
        >
          <span className={styles.suggestedQuestionsLabel}>
            이어서 물어보기
          </span>
          {suggestedQuestions.map((question) => (
            <button
              key={question}
              type="button"
              className={styles.suggestedQuestionButton}
              onClick={() => onAskSuggestedQuestion(question)}
            >
              {question}
            </button>
          ))}
        </nav>
      )}
    </article>
  );
});
