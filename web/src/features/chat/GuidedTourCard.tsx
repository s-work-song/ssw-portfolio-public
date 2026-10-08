/**
 * 안내 투어의 두 화면 조각을 담은 표현 전용 모듈이다.
 *
 * 첫 방문자에게 투어를 권하는 배너(GuidedTourInvite)와 진행 중 안내 카드
 * (GuidedTourCard) 모두 상태를 직접 갖지 않고 useGuidedTour가 계산한 값을
 * 그대로 그린다. 저장소·DOM 접근이 없어 클라이언트 지시자도 필요하지 않다.
 */
import { GUIDED_TOUR_STEPS } from "./guidedTour";
import type { GuidedTourState, GuidedTourStep } from "./guidedTour";
import type { Ref } from "react";
import styles from "./GuidedTourCard.module.css";

/** 배너의 두 버튼이 각각 투어 시작과 배너 닫기를 상위로 올린다. */
interface GuidedTourInviteProps {
  onStart: () => void;
  onDismiss: () => void;
}

/**
 * 첫 방문자에게 투어를 권하는 배너다.
 *
 * 노출 여부는 훅이 판단하므로 여기서는 조건 없이 그린다. aria-labelledby로
 * 제목과 묶어 보조 기술이 안내 영역임을 알 수 있게 했다.
 */
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

/**
 * 카드가 그리는 데 필요한 상태와 조작 콜백 묶음이다.
 *
 * placement는 카드가 채팅 패널 안(`panel`)에 있는지 화면 위에 따로 떠 있는지
 * (`external`)를 가리키며, external일 때만 채팅을 여닫는 버튼이 함께 붙는다.
 * aiAvailable은 질문 체험 안내 문구를 고르는 데만 쓰고 버튼 잠금과는 무관하다.
 */
interface GuidedTourCardProps {
  state: GuidedTourState;
  step: GuidedTourStep | null;
  placement: "external" | "panel";
  /** 패널이 열리는 순간에만 등장 연출을 한 번 재생한다. */
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

/**
 * 진행 중인 투어의 현재 단계와 다음 행동 버튼을 보여 주는 안내 카드다.
 *
 * 완료 상태에서는 단계 안내 대신 마무리 문구와 다시 둘러보기·설정 안내 버튼을
 * 내놓는다. 질문 체험을 기다리는 동안에는 "다음 장소" 버튼을 감춰 방문자가
 * 체험을 지나치지 않게 하고, 대신 건너뛰기 버튼만 남긴다. 답변을 받는
 * 중(answering)에는 이전·현재 장소·종료를 모두 잠가 진행 중인 요청과 화면
 * 이동이 엇갈리지 않게 한다.
 *
 * 단계가 바뀌면 문구만 갈리므로 aria-live="polite"를 걸어 보조 기술이 바뀐
 * 내용을 읽어 주도록 했다.
 */
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
  // 완료 상태는 마지막 stepIndex를 그대로 들고 있으므로 진행도만 전체 값으로 채운다.
  // 진행 중에는 인덱스가 범위를 벗어나도 표시가 깨지지 않도록 전체 개수로 잘라 낸다.
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
