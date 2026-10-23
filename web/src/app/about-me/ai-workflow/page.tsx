import type { Metadata } from 'next';
import Link from 'next/link';
import { aiWorkflowStages } from '@/data/aiWorkflow';
import WorkflowStageTabs from './WorkflowStageTabs';
import WorkflowStageContent from './WorkflowStageContent';
import styles from './AiWorkflow.module.css';

export const metadata: Metadata = {
  title: 'SI 활용 단계 | SI Adoption Levels',
  description: '채팅부터 구현, 도구 연결, 여러 에이전트 조율까지 SI 활용 수준을 다섯 단계로 정리합니다. 여러분 또는 여러분의 팀·조직은 지금 어느 단계로 일하고 있나요?',
};

export default function AiWorkflowPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero} id="ai-workflow-intro" aria-labelledby="workflow-title" tabIndex={-1}>
        <p className={styles.eyebrow}>SI ADOPTION LEVELS</p>
        <h2 id="workflow-title" className={styles.pageTitle}>SI(Super Intelligence, 초지능) 활용 단계</h2>
        <p className={styles.lead}>
          채팅으로 답을 얻는 단계부터 여러 에이전트를 조율하는 단계까지.<br />
          SI 활용 수준을 다섯 단계로 나누어 살펴봅니다.
        </p>
        <div className={styles.principle}>
          <span className={styles.principleMark} aria-hidden="true">?</span>
          <p>
            <strong>여러분 또는 여러분의 팀·조직은 지금 어느 단계로 일하고 있나요?</strong>
            ChatGPT를 챗봇으로 사용하던 때부터 여러 에이전트가 협업하는 장기간 세션까지,
            직접 활용해 본 경험을 바탕으로 정리했습니다.
            각 단계에서 SI를 어떻게 활용하고 사람이 어떤 역할을 맡는지 비교해 보세요.
            현재의 작업 방식과 다음으로 넓혀 보고 싶은 활용 범위를 생각해 볼 수 있습니다.
          </p>
        </div>
      </section>

      <WorkflowStageTabs panels={aiWorkflowStages.map((stage) => (
        <WorkflowStageContent key={stage.id} stage={stage} />
      ))} />

      <aside className={styles.closing} aria-labelledby="workflow-try-title">
        <p className={styles.eyebrow}>CHOOSE WHAT FITS</p>
        <h3 id="workflow-try-title">정답은 하나가 아닙니다</h3>
        <p>더 높은 단계나 더 많은 도구가 항상 더 좋은 결과를 뜻하지는 않습니다. 작업의 성격과 복잡도, 팀의 환경, 검토에 드는 노력을 함께 고려해 상황에 맞는 활용 방식을 고르는 것이 중요합니다.</p>
      </aside>

      <section className={styles.nextSection} aria-labelledby="workflow-next-title">
        <h3 id="workflow-next-title">관련 개발 기록 및 회고</h3>
        <p>SI를 활용하며 얻은 경험과 개발 과정의 고민은 기록(Log) 페이지에서 이어서 확인할 수 있습니다.</p>
        <Link href="/about-me/log/" className={`${styles.nextLink} hover-btn-primary hover-btn-inverse`}>
          기록(Log) 확인하기 <span aria-hidden="true">→</span>
        </Link>
      </section>
    </div>
  );
}
