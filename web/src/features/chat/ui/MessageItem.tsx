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
import { CHAT_QUICK_START_OPTION_BY_ACTION_ID } from "../constants";
import { StreamingText } from "../streaming/StreamingText";
import type {
  ActionId,
  ChatAction,
  ChatMessage,
  ChatStreamAnimation,
  ChatUiSettings,
} from "../types";
import { CHAT_DOCK_MIN_VIEWPORT_WIDTH, type PortfolioChoiceSetting } from "../../portfolio-tools/schema.ts";
import { useChatDockViewport } from "./useChatDockViewport.ts";
import { projectMessageViewModel, type MessageViewModel } from "../view-model/messageViewModel.ts";
import styles from "./ChatWidget.module.css";

type MarkdownModule = typeof import("react-markdown");
type MarkdownRenderer = MarkdownModule["default"];
type MarkdownComponents = NonNullable<
  Parameters<MarkdownRenderer>[0]["components"]
>;
type MarkdownPlugins = NonNullable<
  Parameters<MarkdownRenderer>[0]["remarkPlugins"]
>;

/** 한 번 불러온 렌더러는 모듈에 남겨 두 번째 말풍선부터는 즉시 그린다. */
let markdownRenderer: MarkdownRenderer | null = null;
let markdownRequest: Promise<MarkdownRenderer> | null = null;
/**
 * 렌더러와 함께 불러오는 remark 플러그인이다.
 *
 * CommonMark는 닫는 `**` 앞이 괄호 같은 문장부호이고 뒤에 글자가 붙으면
 * 강조를 닫지 않는다. 한국어 답변의 `**LoRA(저랭크 적응)**를`처럼 조사가
 * 바로 붙는 경우 별표가 그대로 보이므로, CJK 글자 옆에서는 강조를 닫도록
 * 규칙을 보완하는 플러그인을 쓴다.
 */
let markdownPlugins: MarkdownPlugins = [];

/**
 * 마크다운 렌더러를 지연 로딩한다. 이미 불렀으면 같은 약속을 돌려준다.
 *
 * 채팅을 여는 순간 미리 호출해 두면 첫 답변이 완료될 즈음에는 이미 준비돼
 * 있어 평문 대체 표시가 눈에 띄지 않는다. 실패해도 예외를 밖으로 던지지
 * 않게 호출한 쪽이 `void`로 흘려보낸다.
 */
export function loadMarkdownRenderer(): Promise<MarkdownRenderer> {
  markdownRequest ??= Promise.all([
    import("react-markdown"),
    import("remark-cjk-friendly"),
  ]).then(
    ([module, cjkFriendly]) => {
      // 렌더러를 내보이기 전에 플러그인부터 채워, 첫 말풍선도 같은 규칙으로 그린다.
      markdownPlugins = [cjkFriendly.default];
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
    <Renderer skipHtml remarkPlugins={markdownPlugins} components={MARKDOWN_COMPONENTS}>
      {markdown}
    </Renderer>
  );
}

// 호환 export: 표시 정책의 정본은 순수 ViewModel에만 둔다.
export { EMPTY_SUGGESTED_QUESTIONS, visibleResponseActions, summaryActionsForMessage } from "../view-model/messageViewModel.ts";

/**
 * 액션 버튼 하나다.
 *
 * 빠른 시작 목적지면 화살표가 붙은 강조 스타일과 온보딩과 같은 문구를 쓴다.
 * 같은 곳으로 가는 버튼이 화면마다 달라 보이지 않게 하기 위함이다.
 */
export function ResponseActionButton({
  action,
  onActivate,
  canSend = true,
}: Readonly<{
  action: ChatAction;
  onActivate: (actionId: ActionId) => void;
  canSend?: boolean;
}>) {
  const quickStartOption = CHAT_QUICK_START_OPTION_BY_ACTION_ID.get(action.id);

  return (
    <button
      type="button"
      disabled={Boolean(quickStartOption) && !canSend}
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

/** 연출 미리보기 문장이다. 설정 페이지 미리보기처럼 두 글자씩 흘려보낸다. */
const STREAM_PREVIEW_TEXT = "고른 연출로 챗봇 답변이 이렇게 표시돼요.";

/** 고른(또는 가리킨) 연출로 예시 문장을 처음부터 다시 흘려보낸다. 연출이 바뀔 때마다 새로 재생한다. */
function StreamAnimationPreview({ animation, label }: Readonly<{ animation: ChatStreamAnimation; label: string }>) {
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  useEffect(() => {
    let timer = 0;
    const characters = Array.from(STREAM_PREVIEW_TEXT);
    const frame = window.requestAnimationFrame(() => {
      let cursor = 0;
      setText("");
      setRunning(true);
      timer = window.setInterval(() => {
        cursor = Math.min(cursor + 2, characters.length);
        setText(characters.slice(0, cursor).join(""));
        if (cursor === characters.length) {
          window.clearInterval(timer);
          setRunning(false);
        }
      }, 75);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, [animation]);
  return (
    <div className={styles.settingChoicePreview}>
      <span className={styles.settingChoicePreviewLabel}>미리보기 · {label}</span>
      <p aria-hidden="true">
        <StreamingText key={animation} text={text} animation={animation} isStreaming={running} />
      </p>
    </div>
  );
}

/**
 * 작업 세션이 띄운 설정 선택지다. 버튼은 대화 턴 없이 설정을 바로 바꾸고, 현재 값은 실제 설정을 따른다.
 * 스트리밍 연출은 가리키거나 포커스한 버튼(없으면 현재 값)으로 미리보기를 다시 재생한다.
 */
function SettingChoicePicker({ choice, onChoose }: Readonly<{
  choice: NonNullable<MessageViewModel["choice"]>;
  onChoose?: (setting: PortfolioChoiceSetting, value: string) => void;
}>) {
  const [pointed, setPointed] = useState<string | null>(null);
  const dockFits = useChatDockViewport();
  const previews = choice.setting === "stream_animation";
  // 버튼은 대화 턴 없이 바로 적용돼 모델이 설명할 기회가 없으므로, 좁은 화면이면 여기서 미리 알린다.
  const narrowDockNotice = choice.setting === "chat_layout" && !dockFits;
  const previewOption = choice.options.find((option) => option.value === pointed)
    ?? choice.options.find((option) => option.current);
  return (
    <section className={styles.clarification} aria-label={`${choice.title} 선택`}
      data-setting-choice={choice.callId}>
      <p className={styles.clarificationHint}>{choice.hint}</p>
      <div className={styles.clarificationChoices} role="group" aria-label={`${choice.title} 선택지`}
        onMouseLeave={previews ? () => setPointed(null) : undefined}>
        {choice.options.map((option) => (
          <button key={option.value} type="button" className={styles.clarificationChoice}
            aria-pressed={option.current}
            data-current={option.current ? "true" : undefined}
            style={option.swatch ? { "--clarification-swatch": option.swatch } as CSSProperties : undefined}
            onMouseEnter={previews ? () => setPointed(option.value) : undefined}
            onFocus={previews ? () => setPointed(option.value) : undefined}
            onClick={() => onChoose?.(choice.setting, option.value)}>
            {option.swatch && <span className={styles.clarificationSwatch} aria-hidden="true" />}
            <span className={styles.clarificationLabel}>{option.label}</span>
            {option.current && <span className={styles.clarificationCurrentBadge}>현재</span>}
          </button>
        ))}
      </div>
      {narrowDockNotice && (
        <p className={styles.clarificationHint}>
          지금 화면은 너비가 {CHAT_DOCK_MIN_VIEWPORT_WIDTH}px보다 좁아서 오른쪽 고정 패널을 골라도 플로팅 창으로 보여요.
        </p>
      )}
      {previews && previewOption && (
        <StreamAnimationPreview animation={previewOption.value as ChatStreamAnimation} label={previewOption.label} />
      )}
    </section>
  );
}

interface MessageItemProps {
  canSend?: boolean;
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
  /** 설정 선택지의 현재 값 표시에 쓰는 지금 화면 설정이다. 선택지가 있는 답변에만 넘긴다. */
  uiSettings?: ChatUiSettings;
  /** 설정 선택지 버튼을 눌렀을 때 그 값을 바로 적용한다. */
  onChooseSetting?: (setting: PortfolioChoiceSetting, value: string) => void;
}

/**
 * 말풍선과 그 아래 진행 안내를 포함하는 대화 한 행이다. 스트리밍 중에는 delta마다 messages 배열이
 * 바뀌지만, 이미 완료된 말풍선은 props가 그대로라 memo가 리렌더를 막는다.
 *
 * 상태에 따라 세 가지 몸통 중 하나를 그린다. (1) 아직 완료되지 않은 답변은
 * 연출이 붙은 단일 문단, (2) 완료된 답변은 문단별 마크다운과 액션,
 * (3) 사용자 말풍선은 평문이다. 생성 중 안내 문구는 생성 중에만
 * 보여 준다. 실패·중단 배지 아래에 "생성하고 있어요"가 함께 뜨면 서로
 * 모순된 안내가 되기 때문이다.
 */
export const MessageItem = memo(function MessageItem({
  canSend = true,
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
  uiSettings,
  onChooseSetting,
}: MessageItemProps) {
  const vm = projectMessageViewModel({
    message, activeQuickDestination, includeComplement, suggestedQuestions, slowResponse,
    canRetry, retryWaitSeconds, uiSettings,
  });
  const { isStreaming, hasFailed, hasActiveStatus,
    showMessageBubble, showSuggestedQuestions, summaryActions, choice } = vm;
  // 생성 단계 안내는 말풍선 밖 같은 자리에서 한 번만 알린다.
  const generationStatus = vm.status ? (
    <p className={styles.generationBadge} role="status" aria-live="polite" aria-atomic="true">
      <span>{vm.status.text}</span>
      {vm.status.dots && (
        <span className={styles.generationDots} aria-hidden="true">
          <span /><span /><span />
        </span>
      )}
    </p>
  ) : null;

  return (
    <article
      aria-live={message.role === "assistant" && !hasActiveStatus && !hasFailed ? "polite" : "off"}
      data-response-provenance={message.kind === "chat_notice" ? "application" : undefined}
      data-status-stage={message.statusStage}
      className={`${styles.messageRow} ${message.role === "user" ? styles.userMessageRow : styles.assistantMessageRow}`}
    >
      {showMessageBubble && (
        <div className={[
          styles.message,
          message.role === "user" ? styles.userMessage : styles.assistantMessage,
        ].join(" ")} data-chat-message-bubble="true">
          {vm.stoppedLabel && (
            <strong className={styles.stoppedBadge}>
              {vm.stoppedLabel}
            </strong>
          )}
          {vm.failure && (
            <strong className={styles.failedBadge}>
              {vm.failure.label}
            </strong>
          )}
          {vm.chips.length > 0 && (
            <div
              className={styles.toolResults}
              role="group"
              aria-label="화면 도구 실행 결과"
            >
              {vm.chips.map((result) => (
                <span
                  key={result.id}
                  className={styles.toolResult}
                  data-tool-status={result.status}
                >
                    {result.text}
                </span>
              ))}
            </div>
          )}
          {choice && <SettingChoicePicker choice={choice} onChoose={onChooseSetting} />}
          {vm.bodyKind === "streaming" ? (
            message.content && (
              <p className={`${styles.messageText} ${styles.partialText}`}>
                <StreamingText
                  text={message.content}
                  animation={streamAnimation}
                  isStreaming={isStreaming}
                />
              </p>
            )
          ) : vm.bodyKind === "markdown" ? (
            <div className={styles.answerSegments}>
              {vm.segments.map((segment, segmentIndex) => {
                const segmentActions = segment.actions;
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
                            canSend={canSend}
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
          {vm.failure && (
            <div className={styles.messageFailure} role="alert">
              <p>{vm.failure.notice}</p>
              {vm.retry && <button type="button" disabled={vm.retry.disabled} onClick={onRetry}>{vm.retry.label}</button>}
            </div>
          )}
          {!vm.failure && vm.retry && (
            <div className={styles.messageFailure}>
              <button type="button" disabled={vm.retry.disabled} onClick={onRetry}>{vm.retry.label}</button>
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
                  canSend={canSend}
                  onActivate={onActivateAction}
                />
              ))}
            </nav>
          )}
          {showSuggestedQuestions && (
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
                  disabled={!canSend}
                  onClick={() => onAskSuggestedQuestion(question)}
                >
                  {question}
                </button>
              ))}
            </nav>
          )}
        </div>
      )}
      {generationStatus}
    </article>
  );
});
