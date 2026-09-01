import { GUIDED_TOUR_STEPS } from "./guidedTour";
import type { GuidedTourState, GuidedTourStep } from "./guidedTour";
import type { Ref } from "react";
import styles from "./GuidedTourCard.module.css";

interface GuidedTourInviteProps {
  onStart: () => void;
  onDismiss: () => void;
}

export function GuidedTourInvite({
  onStart,
  onDismiss,
}: GuidedTourInviteProps) {
  return (
    <aside className={styles.invite} aria-labelledby="guided-tour-invite-title">
      <span className={styles.aiMark} aria-hidden="true">
        AI
      </span>
      <div className={styles.inviteCopy}>
        <strong id="guided-tour-invite-title">처음 방문하셨나요?</strong>
        <span>AI와 함께 약 5분 동안 포트폴리오를 둘러볼 수 있어요.</span>
      </div>
      <div className={styles.inviteActions}>
        <button type="button" className={styles.primary} onClick={onStart}>
          둘러보기 시작
        </button>
        <button type="button" className={styles.ghost} onClick={onDismiss}>
          나중에
        </button>
      </div>
    </aside>
  );
}

interface GuidedTourCardProps {
  state: GuidedTourState;
  step: GuidedTourStep | null;
  placement: "external" | "panel";
  animateEntrance?: boolean;
  externalChatOpen?: boolean;
  externalChatButtonRef?: Ref<HTMLButtonElement>;
  aiAvailable: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSkip: () => void;
  onStop: () => void;
  onReturnToCurrentStep: () => void;
  onRestart: () => void;
  onShowSettingsGuide: () => void;
  onToggleExternalChat?: () => void;
}

export function GuidedTourCard({
  state,
  step,
  placement,
  animateEntrance = false,
  externalChatOpen = false,
  externalChatButtonRef,
  aiAvailable,
  onPrevious,
  onNext,
  onSkip,
  onStop,
  onReturnToCurrentStep,
  onRestart,
  onShowSettingsGuide,
  onToggleExternalChat,
}: GuidedTourCardProps) {
  const completed = state.status === "completed";
  const progress = completed
    ? GUIDED_TOUR_STEPS.length
    : Math.min(state.stepIndex + 1, GUIDED_TOUR_STEPS.length);
  const waitingForAi =
    state.status === "active" &&
    Boolean(step?.targetId) &&
    state.interaction === "waiting-for-ai";
  const answering = state.interaction === "answering";
  const answered = state.interaction === "answered";
  const lastStep = state.stepIndex === GUIDED_TOUR_STEPS.length - 1;

  return (
    <section
      className={`${styles.card} ${styles[placement]} ${
        animateEntrance ? styles.panelReveal : ""
      }`}
      aria-labelledby="guided-tour-title"
      aria-live="polite"
    >
      <div className={styles.heading}>
        <span className={styles.aiMark} aria-hidden="true">
          AI
        </span>
        <div>
          <span className={styles.eyebrow}>
            PORTFOLIO TOUR · {progress}/{GUIDED_TOUR_STEPS.length}
          </span>
          <h3 id="guided-tour-title">
            {completed ? "한 바퀴 둘러봤어요" : step?.title}
          </h3>
        </div>
        {placement === "external" && onToggleExternalChat && (
          <button
            ref={externalChatButtonRef}
            type="button"
            className={styles.externalChatButton}
            aria-label={externalChatOpen ? "채팅 닫기" : "AI 질문하기"}
            aria-expanded={externalChatOpen}
            onClick={onToggleExternalChat}
          >
            <span aria-hidden="true">AI</span>
            <span>질문하기</span>
          </button>
        )}
      </div>

      <p className={styles.message}>
        {completed
          ? "이제 관심 있는 카드의 AI 버튼을 누르거나 챗봇에 자유롭게 질문해 보세요."
          : step?.message}
      </p>

      {waitingForAi && aiAvailable && (
        <p className={styles.instruction}>
          화면에서 빛나는 <strong>AI에게 물어보기</strong> 버튼을 직접 눌러보세요.
        </p>
      )}
      {waitingForAi && !aiAvailable && (
        <p className={styles.instruction}>
          현재 AI가 오프라인이라 질문 체험은 건너뛸 수 있어요.
        </p>
      )}
      {answering && (
        <p className={styles.instruction}>실제 AI 답변을 불러오고 있어요…</p>
      )}
      {answered && (
        <p className={styles.instruction}>
          답변을 확인했어요. 같은 방식으로 다른 카드도 질문할 수 있습니다.
        </p>
      )}

      <div className={styles.progressTrack} aria-hidden="true">
        <span
          style={{
            width: `${(progress / GUIDED_TOUR_STEPS.length) * 100}%`,
          }}
        />
      </div>

      <div className={styles.actions}>
        {completed ? (
          <>
            <button type="button" className={styles.secondary} onClick={onRestart}>
              다시 둘러보기
            </button>
            <button
              type="button"
              className={styles.primary}
              onClick={onShowSettingsGuide}
            >
              설정·WebMCP 안내
            </button>
            <button type="button" className={styles.ghost} onClick={onStop}>
              닫기
            </button>
          </>
        ) : (
          <>
            {state.stepIndex > 0 && (
              <button
                type="button"
                className={styles.secondary}
                onClick={onPrevious}
                disabled={answering}
              >
                이전
              </button>
            )}
            <button
              type="button"
              className={styles.secondary}
              onClick={onReturnToCurrentStep}
              disabled={answering}
            >
              현재 장소
            </button>
            {!waitingForAi && !answering && (
              <button type="button" className={styles.primary} onClick={onNext}>
                {lastStep ? "둘러보기 마치기" : "다음 장소"}
              </button>
            )}
            {waitingForAi && (
              <button type="button" className={styles.secondary} onClick={onSkip}>
                질문 체험 없이 다음
              </button>
            )}
            <button
              type="button"
              className={styles.ghost}
              onClick={onStop}
              disabled={answering}
            >
              종료
            </button>
          </>
        )}
      </div>
    </section>
  );
}
