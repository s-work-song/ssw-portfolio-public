import Link from "next/link";
import { aiWorkflowStages } from "@/data/aiWorkflow";
import styles from "./AiWorkflowPreview.module.css";

/** 개인과 팀·조직이 자신의 SI 활용 단계를 살펴보는 페이지의 진입점입니다. */
export default function AiWorkflowPreview() {
  return (
    <section id="ai-workflow-preview" className={styles.preview} aria-labelledby="ai-workflow-preview-title">
      <p className={styles.eyebrow}>SI ADOPTION LEVELS</p>
      <h3 id="ai-workflow-preview-title">SI 활용 단계</h3>
      <p className={styles.intro}>
        채팅으로 답을 얻는 단계부터 구현, 도구 연결, 여러 에이전트의 조율까지.
        SI 활용 수준을 다섯 단계로 나누어, 개인과 팀·조직의 현재 위치를 살펴봅니다.
      </p>
      <ol className={styles.stages} aria-label="SI 활용 단계 바로 보기">
        {aiWorkflowStages.map((stage) => (
          <li key={stage.id}>
            <Link href={`/about-me/ai-workflow/#workflow-${stage.id}`}>
              <span className={styles.number}>{stage.number}</span>
              <span className={styles.stageCopy}>
                <strong>{stage.shortTitle}</strong>
                <span className={styles.stageDescription}>{stage.navDescription}</span>
              </span>
              <span className={styles.arrow} aria-hidden="true">↗</span>
            </Link>
          </li>
        ))}
      </ol>
      <div className={styles.footer}>
        <p>여러분 또는 여러분의 팀·조직은 지금 어느 단계로 일하고 있나요?</p>
        <Link href="/about-me/ai-workflow/" className={styles.more}>
          활용 단계 살펴보기 <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
