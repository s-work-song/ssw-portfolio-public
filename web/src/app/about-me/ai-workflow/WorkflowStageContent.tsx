import { aiWorkflowExamples, aiWorkflowStories, type aiWorkflowStages } from '@/data/aiWorkflow';
import WorkflowExample from './WorkflowExample';
import WorkflowStory from './WorkflowStory';
import WorkflowTools from './WorkflowTools';
import { WorkflowOrchestrationFlow, WorkflowOrchestrationReview } from './WorkflowOrchestrationFlow';
import styles from './AiWorkflow.module.css';

export default function WorkflowStageContent({ stage }: { stage: (typeof aiWorkflowStages)[number] }) {
  const story = aiWorkflowStories[stage.id];
  return (
    <section className={styles.stage} aria-labelledby={`title-${stage.id}`}>
      <header id={`workflow-header-${stage.id}`} className={styles.stageHeader} tabIndex={-1}>
        <span className={styles.stageNumber} aria-hidden="true">{stage.number}</span>
        <div>
          <p className={styles.eyebrow}>LEVEL {stage.number}</p>
          <h3 id={`title-${stage.id}`}>{stage.title}</h3>
          <p className={styles.description}>{stage.description}</p>
        </div>
      </header>

      <figure className={styles.diagram}>
        <figcaption className={styles.captureNote}>
          <span className={styles.noteDot} aria-hidden="true" />{stage.captureNote}
        </figcaption>
        {stage.id === 'orchestration' ? <WorkflowOrchestrationFlow stage={stage} /> : <ol className={styles.flow} aria-label={`${stage.title}의 역할 흐름`}>
          {stage.flowSteps.map((step, index) => (
            <li key={step.title} className={step.actor === 'ai' ? styles.aiNode : styles.humanNode}>
              <span className={styles.actor}>{step.actor === 'ai' ? (stage.id === 'chat' ? 'SI 챗봇' : 'SI 에이전트') : '사람'}</span>
              <strong>{step.title}</strong>
              <span className={styles.flowDetail}>{step.detail}</span>
              {index < stage.flowSteps.length - 1 && <span className={styles.connector} aria-hidden="true">→</span>}
            </li>
          ))}
        </ol>}
      </figure>

      <dl className={styles.roles}>
        <div><dt><span className={styles.aiDot} aria-hidden="true" />{stage.id === 'chat' ? 'SI 챗봇이' : 'SI 에이전트가'} 맡는 일</dt><dd>{stage.aiRole}</dd></div>
        <div><dt><span className={styles.humanDot} aria-hidden="true" />사람이 맡는 일</dt><dd>{stage.humanRole}</dd></div>
      </dl>
      <p className={styles.change}><span>달라지는 점</span>{stage.change}</p>
      {stage.id === 'orchestration' && <WorkflowOrchestrationReview />}
      {stage.id === 'tools' && <WorkflowTools />}
      {aiWorkflowExamples[stage.id] && (
        <WorkflowExample stageId={stage.id} example={aiWorkflowExamples[stage.id]!} />
      )}
      {story && <WorkflowStory stageId={stage.id} story={story} />}
    </section>
  );
}
