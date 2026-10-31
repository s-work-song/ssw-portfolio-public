import LogReadingLink from '@/features/logs/navigation/LogReadingLink';
import type { AboutProject } from '@/features/overview/data/about';
import ResearchLink from '@/features/research/ui/ResearchLink';
import ProjectMediaCarousel from './ProjectMediaCarousel';
import styles from './ProjectCardGrid.module.css';

/** 프로젝트 카드의 미디어·공개 상태·링크를 두 소개 섹션에서 공유한다. */
export default function ProjectCardGrid({ projects }: { projects: AboutProject[] }) {
  return (
    <div className={styles.grid}>
      {projects.map((project) => (
        <article
          key={project.id}
          className={project.experiment ? styles.experimentCard : undefined}
          id={project.id}
          tabIndex={-1}
          style={{
            padding: '22px',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            background: 'var(--bg-elev-2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            scrollMarginTop: '96px',
          }}
        >
          <span style={{ color: 'var(--accent, #6366f1)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {project.category}
          </span>
          <h4 style={{ margin: 0, color: 'var(--text)', fontSize: '1.12rem' }}>
            {project.title}
          </h4>
          {project.gallery && (
            <div className={project.experiment ? styles.experimentMedia : undefined}>
              <ProjectMediaCarousel
                gallery={project.gallery}
                projectTitle={project.title}
              />
            </div>
          )}
          <p style={{ margin: 0, color: 'var(--text-dim)', lineHeight: 1.65, wordBreak: 'keep-all', whiteSpace: 'pre-line', flex: 1 }}>
            {project.desc}
          </p>
          {project.learningContext && (
            <section className={styles.learningContext} aria-labelledby={`${project.id}-learning-context`}>
              <h5 id={`${project.id}-learning-context`}>{project.learningContext.title}</h5>
              {project.learningContext.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {project.learningContext.relatedLog && (
                <LogReadingLink
                  slug={project.learningContext.relatedLog.slug}
                  className={`${styles.learningContextLink} hover-btn-secondary`}
                >
                  <span>{project.learningContext.relatedLog.label}</span>
                  <span aria-hidden="true">→</span>
                </LogReadingLink>
              )}
            </section>
          )}
          {project.experiment && (
            <section className={styles.experiment} aria-labelledby={`${project.id}-experiment`}>
              <h5 id={`${project.id}-experiment`}>{project.experiment.title}</h5>
              <div className={styles.comparison}>
                <p>{project.experiment.before}</p>
                <p>{project.experiment.after}</p>
              </div>
              <p className={styles.result}>{project.experiment.result}</p>
              <p>{project.experiment.scope}</p>
              <p>{project.experiment.retained}</p>
              <p>{project.experiment.observation}</p>
              <p className={styles.limitation}>{project.experiment.limitation}</p>
            </section>
          )}
          <span style={{
            alignSelf: 'flex-start',
            padding: project.statusTone === 'warning' ? '5px 9px' : 0,
            border: project.statusTone === 'warning'
              ? '1px solid color-mix(in srgb, #f97316 42%, transparent)'
              : 'none',
            borderRadius: project.statusTone === 'warning' ? '999px' : 0,
            background: project.statusTone === 'warning'
              ? 'color-mix(in srgb, #f97316 13%, transparent)'
              : 'transparent',
            color: project.statusTone === 'warning' ? '#f97316' : 'var(--text-mute)',
            fontSize: '0.82rem',
            fontWeight: project.statusTone === 'warning' ? 700 : 400,
          }}>
            {project.status}
          </span>
          {project.links && project.links.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '2px' }}>
              {project.links.map((link) => {
                const isDemo = link.kind === 'demo';
                const linkStyle = {
                  minHeight: '36px',
                  padding: '7px 11px',
                  border: isDemo
                    ? '1px solid var(--accent, #6366f1)'
                    : '1px solid var(--border-strong)',
                  borderRadius: '9px',
                  background: isDemo
                    ? 'var(--accent, #6366f1)'
                    : 'var(--bg-elev)',
                  color: isDemo ? '#fff' : 'var(--text-dim)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                } as const;
                // 연구 링크는 사이트 안의 연구 위치로 같은 탭에서 이동한다.
                if (link.kind === 'research') {
                  return (
                    <ResearchLink
                      key={link.href}
                      href={link.href}
                      ariaLabel={`${project.title} ${link.label}`}
                      className="hover-btn-secondary"
                      style={linkStyle}
                    >
                      {link.label}
                    </ResearchLink>
                  );
                }
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${project.title} ${link.label} 새 탭에서 열기`}
                    className={isDemo ? 'hover-btn-primary' : 'hover-btn-secondary'}
                    style={linkStyle}
                  >
                    {link.label}
                    <span aria-hidden="true">↗</span>
                  </a>
                );
              })}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
