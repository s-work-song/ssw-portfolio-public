"use client";

/**
 * 현재 카드의 주제를 포트폴리오 챗봇에 바로 질문하는 공용 진입점이다.
 * 온라인 상태 확인과 대화 전송은 ChatProvider에 위임하고, 서버 컴포넌트는
 * 직렬화 가능한 질문 문자열만 전달한다.
 */
import { useChat } from "./ChatContext";
import type { GuidedTourTargetId } from "./guidedTour";
import styles from "./AskAiButton.module.css";

/**
 * 버튼이 대신 던져 줄 질문과 겉모습 조정 값이다.
 *
 * question은 실제로 전송되는 문장이고 label은 버튼에 적히는 문구다. 둘이 다르므로
 * aria-label에는 둘을 합쳐 넣어, 화면을 못 보는 사용자도 무엇을 묻게 되는지 알 수 있게 한다.
 * guidedTourTarget을 주면 안내 투어의 질문 체험 단계와 이 버튼이 연결된다.
 */
interface AskAiButtonProps {
  question: string;
  label?: string;
  className?: string;
  align?: "start" | "end";
  guidedTourTarget?: GuidedTourTargetId;
}

/**
 * 정해진 질문 하나를 챗봇에 던지는 버튼이다.
 *
 * 아직 상태를 확인하지 않았어도 진입점을 보여 주고 클릭한 실제 질문으로 확인한다.
 * 확인된 오프라인이면 숨기고, 확인·답변을 기다리는 동안 같은 질문을 중복하지 않는다.
 *
 * 클릭 처리는 순서가 중요하다. 투어에 먼저 알려야 그 시점의 `waiting-for-ai`
 * 상태를 보고 체험을 받아들일 수 있고, 그 반환값이 true일 때만 답변 뒤에 완료를
 * 알린다. 패널은 초점 없이 열어 모바일에서 키보드가 답변을 가리지 않게 한다.
 */
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

  if (availability === "offline") return null;

  return (
    <button
      type="button"
      className={`${styles.button} ${
        align === "end" ? styles.alignEnd : ""
      } ${className}`.trim()}
      disabled={isLoading || availability === "checking"}
      data-guided-tour-target={guidedTourTarget}
      onClick={async () => {
        const advancesTour = guidedTourTarget
          ? beginGuidedTourQuestion(guidedTourTarget)
          : false;
        open({ focusInput: false, checkAvailability: false });
        await sendMessage(question, undefined, "explanation");
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
