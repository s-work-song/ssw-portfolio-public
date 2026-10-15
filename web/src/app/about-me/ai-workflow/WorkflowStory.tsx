import type { AiWorkflowStory } from '@/data/aiWorkflow';
import WorkflowInlineCapture from './WorkflowInlineCapture';
import styles from './AiWorkflow.module.css';

export default function WorkflowStory({ stageId, story }: { stageId: string; story: AiWorkflowStory }) {
  return (
    <section className={styles.example} aria-labelledby={`story-${stageId}`}>
      <p className={styles.eyebrow}>IN PRACTICE</p>
      <h4 id={`story-${stageId}`}>{story.title}</h4>
      <p className={styles.exampleSummary}>{story.summary}</p>
      <dl className={styles.environment} aria-label="예제 사용 환경">
        <div><dt>사용 환경</dt><dd>{story.environment.tool}</dd></div>
        <div><dt>예제 구성</dt><dd>{story.environment.project}</dd></div>
      </dl>
      <div className={styles.storySections}>
        {story.sections.map((section) => (
          <section key={section.id} className={styles.storySection} aria-labelledby={`story-${stageId}-${section.id}`}>
            <h5 id={`story-${stageId}-${section.id}`}>{section.title}</h5>
            {section.paragraphs.map((paragraph) => <p key={paragraph} className={styles.storyParagraph}>{paragraph}</p>)}
            {section.capture && <WorkflowInlineCapture id={`capture-${stageId}-${section.id}`} capture={section.capture} />}
          </section>
        ))}
      </div>
      <p className={styles.privacyNote}>{story.privacyNote}</p>
    </section>
  );
}
