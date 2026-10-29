import type { AiWorkflowExample } from '@/features/ai-workflow/data/aiWorkflow';
import Link from 'next/link';
import WorkflowCaptureGallery from './WorkflowCaptureGallery';
import styles from '../../../app/about-me/ai-workflow/AiWorkflow.module.css';

interface WorkflowExampleProps {
  stageId: string;
  example: AiWorkflowExample;
}

export default function WorkflowExample({ stageId, example }: WorkflowExampleProps) {
  return (
    <section className={styles.example} aria-labelledby={`example-${stageId}`}>
      <p className={styles.eyebrow}>IN PRACTICE</p>
      <h4 id={`example-${stageId}`} tabIndex={-1}>{example.title}</h4>
      <p className={styles.exampleSummary}>{example.summary}</p>
      <dl className={styles.environment} aria-label="예제 사용 환경">
        <div><dt>사용 환경</dt><dd>{example.environment.tool}</dd></div>
        <div><dt>예제 구성</dt><dd>{example.environment.project}</dd></div>
      </dl>
      <p className={styles.environmentNote}>표시된 도구는 이 예제의 사용 환경입니다. 각 단계에서 반드시 사용해야 하는 도구를 뜻하지는 않습니다.</p>
      {example.request && <div className={styles.request}>
        <p className={styles.requestLabel}>요청 내용 <span>핵심 조건을 정리한 예시</span></p>
        <blockquote>{example.request}</blockquote>
      </div>}
      <ol className={styles.checkpoints} aria-label="예제에서 확인할 작업 흐름">
        {example.checkpoints.map((point) => <li key={point}>{point}</li>)}
      </ol>
      {example.applicationNote && (
        <aside className={styles.applicationNote} aria-labelledby={`example-${stageId}-applications-title`}>
          <h5 id={`example-${stageId}-applications-title`}>{example.applicationNote.title}</h5>
          <p>{example.applicationNote.description}</p>
        </aside>
      )}
      <WorkflowCaptureGallery title={example.title} captures={example.captures} portrait={example.portrait} frameAspectRatio={example.frameAspectRatio} />
      <p className={styles.privacyNote}>{example.privacyNote}</p>
      {example.relatedLink && (
        <p className={styles.privacyNote}>
          <Link className={styles.captureLink} href={example.relatedLink.href}>
            {example.relatedLink.label} <span aria-hidden="true">→</span>
          </Link>
        </p>
      )}
    </section>
  );
}
