import Link from 'next/link';
import { aiWorkflowSimdCase } from '@/features/ai-workflow/data/aiWorkflow';
import styles from './WorkflowSimdCase.module.css';

const formatMicroseconds = (value: number) => `${value.toFixed(2)} μs`;

/** 같은 SIMD 문제를 01·03·06 단계 방식으로 다시 푼 결과를 처리 시간 막대와 함께 보여 줍니다. */
export default function WorkflowSimdCase() {
  const { steps, chartMaxMicroseconds } = aiWorkflowSimdCase;
  return (
    <section className={styles.section} id="ai-workflow-simd-case" aria-labelledby="workflow-simd-case-title" tabIndex={-1}>
      <p className={styles.eyebrow}>SAME PROBLEM, THREE LEVELS</p>
      <h3 id="workflow-simd-case-title">{aiWorkflowSimdCase.title}</h3>
      <p className={styles.intro}>{aiWorkflowSimdCase.intro}</p>
      <p className={styles.origin}>
        {aiWorkflowSimdCase.origin.before}
        <Link href={aiWorkflowSimdCase.origin.link.href}>{aiWorkflowSimdCase.origin.link.label}</Link>
        {aiWorkflowSimdCase.origin.after}
      </p>
      <p className={styles.problem}><span>문제</span>{aiWorkflowSimdCase.problem}</p>

      <figure className={styles.chart} aria-labelledby="workflow-simd-chart-caption">
        <figcaption id="workflow-simd-chart-caption" className={styles.chartCaption}>
          처리 시간 <span>막대가 짧을수록 빠릅니다</span>
        </figcaption>
        <dl className={styles.chartRows}>
          {steps.map((step) => (
            <div key={step.stageId} className={styles.chartGroup}>
              <dt>{step.stage}</dt>
              {step.results.map((result) => (
                <dd key={result.label} className={styles.chartRow}>
                  <span className={styles.chartLabel}>{result.label}</span>
                  <span className={styles.chartTrack} aria-hidden="true">
                    <span
                      className={styles.chartBar}
                      data-stage={step.stageId}
                      style={{ width: `${(result.microseconds / chartMaxMicroseconds) * 100}%` }}
                    />
                  </span>
                  <span className={styles.chartValue}>{formatMicroseconds(result.microseconds)}</span>
                </dd>
              ))}
            </div>
          ))}
        </dl>
      </figure>

      <ol className={styles.steps}>
        {steps.map((step) => (
          <li key={step.stageId} className={styles.step}>
            <a className={styles.stageLink} href={`#workflow-${step.stageId}`}>{step.stage}</a>
            <h4>{step.title}</h4>
            <p className={styles.actor}>{step.actor}</p>
            <p className={styles.description}>{step.description}</p>
            <ul className={styles.results}>
              {step.results.map((result) => (
                <li key={result.label}>
                  <span>{result.label}</span>
                  <strong>{formatMicroseconds(result.microseconds)}</strong>
                </li>
              ))}
            </ul>
            {'explainer' in step && (
              <details className={styles.explainer}>
                <summary>{step.explainer.summary}</summary>
                {step.explainer.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </details>
            )}
            <a className={styles.codeLink} href={step.codeUrl} target="_blank" rel="noopener noreferrer">
              코드 보기 <span aria-hidden="true">↗</span>
            </a>
          </li>
        ))}
      </ol>

      <h4 className={styles.collaborationTitle}>{aiWorkflowSimdCase.collaborationTitle}</h4>
      <ol className={styles.collaboration}>
        {aiWorkflowSimdCase.collaboration.map(({ title, description }) => (
          <li key={title}>
            <strong>{title}</strong>
            <span>{description}</span>
          </li>
        ))}
      </ol>

      <p className={styles.note}>{aiWorkflowSimdCase.note}</p>
      <p className={styles.environment}>{aiWorkflowSimdCase.environment}</p>
      <div className={styles.links}>
        <a className={styles.codeLink} href={aiWorkflowSimdCase.repositoryUrl} target="_blank" rel="noopener noreferrer">
          세 단계 코드와 벤치마크 전체 보기 <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  );
}
