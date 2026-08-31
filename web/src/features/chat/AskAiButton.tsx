"use client";

/**
 * 현재 카드의 주제를 포트폴리오 챗봇에 바로 질문하는 공용 진입점이다.
 * 온라인 상태 확인과 대화 전송은 ChatProvider에 위임하고, 서버 컴포넌트는
 * 직렬화 가능한 질문 문자열만 전달한다.
 */
import { useChat } from "./ChatContext";
import type { GuidedTourTargetId } from "./guidedTour";
import styles from "./AskAiButton.module.css";

interface AskAiButtonProps {
  question: string;
  label?: string;
  className?: string;
  align?: "start" | "end";
  guidedTourTarget?: GuidedTourTargetId;
}

export function AskAiButton({
  question,
  label = "AI에게 물어보기",
  className = "",
  align = "start",
  guidedTourTarget,
}: AskAiButtonProps) {
  const {
    availability,
    isLoading,
    open,
    sendMessage,
    beginGuidedTourQuestion,
    completeGuidedTourQuestion,
  } = useChat();

  if (availability !== "online") return null;

  return (
    <button
      type="button"
      className={`${styles.button} ${
        align === "end" ? styles.alignEnd : ""
      } ${className}`.trim()}
      disabled={isLoading}
      data-guided-tour-target={guidedTourTarget}
      onClick={async () => {
        const advancesTour = guidedTourTarget
          ? beginGuidedTourQuestion(guidedTourTarget)
          : false;
        open({ focusInput: false });
        await sendMessage(question);
        if (advancesTour && guidedTourTarget) {
          completeGuidedTourQuestion(guidedTourTarget);
        }
      }}
      aria-label={`${label}: ${question}`}
    >
      <span className={styles.icon} aria-hidden="true">
        AI
      </span>
      <span>{label}</span>
    </button>
  );
}
