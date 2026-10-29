import { aiWorkflowOrchestrationConnections, aiWorkflowOrchestrationReview, type aiWorkflowStages } from '@/features/ai-workflow/data/aiWorkflow';
import styles from './WorkflowOrchestrationFlow.module.css';

type OrchestrationStage = Extract<(typeof aiWorkflowStages)[number], { id: 'orchestration' }>;

/** 모든 요청과 보고가 조율을 거친다. 모바일은 같은 연결 정보를 시간순으로 펼친다. */
export function WorkflowOrchestrationFlow({ stage }: { stage: OrchestrationStage }) {
  const [goal, coordinator, implementer, reviewer, decision] = stage.flowSteps;
  const names = { coordinator: coordinator.title, implementer: implementer.title, reviewer: reviewer.title };
  const agents = [{ id: 'implementer', node: implementer }, { id: 'reviewer', node: reviewer }] as const;
  return (
    <div className={styles.flow} aria-label="구현·검수·재작업과 사람의 검토 흐름">
      <div className={styles.humanNode}>
        <span className={styles.actor}>사람</span>
        <strong>{goal.title}</strong>
        <p>{goal.detail}</p>
      </div>
      <span className={styles.down} aria-hidden="true">↓</span>
      <p className={styles.sequenceNote}>같은 조율 세션이 모든 요청과 보고를 이어받습니다. 번호는 한 작업의 진행 순서입니다.</p>
      <WorkflowOrchestrationTimeline coordinator={coordinator} />
      <div className={styles.desktopFlow}>
      <div className={styles.network}>
        <div className={styles.coordinator}>
          <span className={styles.actor}>SI 에이전트 · 조율</span>
          <strong>{coordinator.title}</strong>
          <p>{coordinator.detail}</p>
          <p className={styles.coordinatorNote}>② 완료 보고를 받은 뒤 ③ 검수를 실행합니다.</p>
        </div>
        <div className={styles.exchanges}>
          {agents.map(({ id, node }) => (
            <section key={id} className={styles.exchange} aria-label={`${coordinator.title}과 ${node.title}의 요청·보고`}>
              <ol className={styles.connections} aria-label={`${node.title} 요청·보고 순서`}>
                {aiWorkflowOrchestrationConnections.filter((edge) => edge.from === id || edge.to === id).map((edge) => (
                  <li key={edge.step} className={edge.from === 'coordinator' ? styles.request : styles.report}
                    aria-label={`${edge.step}. ${names[edge.from]} → ${names[edge.to]}: ${edge.label}`}>
                    <span className={styles.edgeLabel}><b>{edge.step}</b>{edge.label}</span>
                    <span className={styles.arrow} aria-hidden="true" />
                  </li>
                ))}
              </ol>
              <div className={styles.agentNode}>
                <span className={styles.actor}>SI 에이전트 · {id === 'implementer' ? '구현' : '검수'}</span>
                <strong>{node.title}</strong>
                <p>{node.detail}</p>
              </div>
            </section>
          ))}
        </div>
      </div>
      <div className={styles.decision}>
        <strong>⑤ 조율 세션이 검수 보고를 확인하고 판단</strong>
        <div className={styles.outcomes}>
          <div>
            <span className={styles.outcomeArrow} aria-hidden="true">↑</span>
            <strong>보완 필요 → ①로</strong>
            <p>구현 에이전트를 다시 실행하고, 완료 보고를 받은 뒤 검수를 다시 요청합니다.</p>
          </div>
          <div>
            <span className={styles.outcomeArrow} aria-hidden="true">↓</span>
            <strong>완료 기준 충족 → 결과 전달</strong>
            <p>조율 세션이 결과를 통합하고 사람의 핵심 검토·최종 판단으로 넘깁니다.</p>
          </div>
        </div>
      </div>
      </div>
      <span className={styles.down} aria-hidden="true">↓</span>
      <div className={styles.humanNode}>
        <span className={styles.actor}>사람</span>
        <strong>{decision.title}</strong>
        <p>{decision.detail}</p>
        <span className={styles.feedback}>의도와 다른 부분은 조율 세션에 피드백해 다시 수정합니다.</span>
      </div>
    </div>
  );
}

function WorkflowOrchestrationTimeline({ coordinator }: { coordinator: OrchestrationStage['flowSteps'][1] }) {
  const roles = { coordinator: '조율', implementer: '구현', reviewer: '검수' };
  return (
    <section className={styles.mobileTimeline} aria-labelledby="mobile-orchestration-title">
      <header className={styles.timelineHeader}>
        <span className={styles.actor}>전체 작업 조율</span>
        <h4 id="mobile-orchestration-title">{coordinator.title}</h4>
        <p>{coordinator.detail}</p>
      </header>
      <div className={styles.timelineCycle}>
      <ol className={styles.timeline} aria-label="구현 요청부터 조율 판단까지의 진행 순서">
        {aiWorkflowOrchestrationConnections.map((edge) => (
          <li key={edge.step} className={styles.timelineStep}>
            <span className={styles.timelineRail} aria-hidden="true" />
            <span className={styles.stepNumber}>{edge.step}</span>
            <div className={styles.stepContent}>
              <strong>{edge.step === 1 ? '구현 요청' : edge.label}</strong>
              <span className={styles.stepRoute}>{roles[edge.from]} → {roles[edge.to]}</span>
            </div>
            <span className={styles.timelineNext} aria-hidden="true">↓</span>
          </li>
        ))}
        <li className={styles.timelineStep}>
          <span className={styles.timelineRail} aria-hidden="true" />
          <span className={styles.stepNumber}>5</span>
          <div className={styles.stepContent}>
            <strong>결과 확인·판단</strong>
            <span className={styles.stepRoute}>조율 세션</span>
          </div>
          <p className={styles.timelineRetry}>보완 필요 → ① 구현부터 다시</p>
        </li>
      </ol>
      <div className={styles.timelineComplete}>
        <span className={styles.down} aria-hidden="true">↓</span>
        <strong>완료 기준 충족 · 결과 전달</strong>
      </div>
      </div>
    </section>
  );
}

export function WorkflowOrchestrationReview() {
  const review = aiWorkflowOrchestrationReview;
  return (
    <section className={styles.review} aria-labelledby="orchestration-review-title">
      <h4 id="orchestration-review-title">{review.title}</h4>
      <p className={styles.summary}>{review.summary}</p>
      <dl className={styles.checkpoints}>
        {review.checkpoints.map((checkpoint) => (
          <div key={checkpoint.title}>
            <dt>{checkpoint.title}</dt>
            <dd>{checkpoint.description}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
