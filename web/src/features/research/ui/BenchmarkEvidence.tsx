"use client";

import type { ReactNode } from 'react';
import {
  BENCHMARK_CATALOGS,
  BENCHMARK_PROJECTS,
  BENCHMARK_PROJECT_BY_ID,
  BENCHMARK_ROOT_URL,
  benchmarkReadmeUrl,
  benchmarkTreeUrl,
  type BenchmarkCatalogId,
  type BenchmarkProject,
  type BenchmarkProjectId,
} from '@/features/research/data/benchmarks';
import ResearchLink from './ResearchLink';
import styles from './BenchmarkEvidence.module.css';

function ExternalLink({
  href,
  children,
  primary = false,
}: Readonly<{
  href: string;
  children: ReactNode;
  primary?: boolean;
}>) {
  return (
    <a
      className={`${styles.link}${primary ? ` ${styles.primaryLink}` : ''}`}
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {children}
      <span aria-hidden="true">↗</span>
    </a>
  );
}

function ProjectLinks({ project }: Readonly<{ project: BenchmarkProject }>) {
  return (
    <div className={styles.links}>
      <ExternalLink
        href={benchmarkTreeUrl(project.sourcePath)}
        primary
      >
        구현 코드
      </ExternalLink>
      <ExternalLink href={benchmarkReadmeUrl(project)}>실행 방법</ExternalLink>
      <ExternalLink href={benchmarkTreeUrl(project.testPath)}>테스트</ExternalLink>
      <ExternalLink href={benchmarkTreeUrl(project.benchmarkPath)}>
        벤치마크 러너
      </ExternalLink>
    </div>
  );
}

export function BenchmarkEvidence({
  projectId,
}: Readonly<{ projectId: BenchmarkProjectId }>) {
  const project = BENCHMARK_PROJECT_BY_ID[projectId];

  return (
    <aside className={styles.evidence} aria-label={`${project.title} 구현 코드`}>
      <div className={styles.evidenceHeader}>
        <div>
          <span className={styles.eyebrow}>IMPLEMENTATION</span>
          <h4 className={styles.title}>{project.title}</h4>
        </div>
        <span className={styles.statusBadge}>재구성 코드</span>
      </div>

      <p className={styles.summary}>{project.summary}</p>
      <div className={styles.tags} aria-label="기술 구성">
        {project.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
        <span>테스트 프로젝트 포함</span>
      </div>

      <ProjectLinks project={project} />

      <p className={styles.statusNote}>
        공개 재구성 코드는 핵심 원리와 동작을 검증하기 위한 구현이며, 성능
        수치는 실행 환경과 입력 데이터 및 구현 조건에 따라 달라질 수 있습니다.
      </p>
    </aside>
  );
}

export function BenchmarkCatalog({
  catalogId,
}: Readonly<{ catalogId: BenchmarkCatalogId }>) {
  const catalog = BENCHMARK_CATALOGS.find((item) => item.id === catalogId);
  if (!catalog) return null;
  const projects = BENCHMARK_PROJECTS.filter(
    (project) => project.catalog === catalogId,
  );
  const titleId = `${catalog.anchorId}-title`;

  return (
    <section
      id={catalog.anchorId}
      tabIndex={-1}
      className={styles.catalog}
      aria-labelledby={titleId}
    >
      <div className={styles.catalogHeader}>
        <div>
          <span className={styles.eyebrow}>{catalog.eyebrow}</span>
          <h3 id={titleId} className={styles.catalogTitle}>
            {catalog.title}
          </h3>
        </div>
        <ExternalLink href={BENCHMARK_ROOT_URL}>전체 폴더 보기</ExternalLink>
      </div>

      <p className={styles.catalogIntro}>{catalog.intro}</p>

      <div className={styles.catalogGrid}>
        {projects.map((project) => (
          <article key={project.id} className={styles.catalogCard}>
            <div className={styles.catalogCardHeader}>
              <h4>{project.title}</h4>
              <span>코드 공개</span>
            </div>
            <p>{project.summary}</p>
            <div className={styles.tags} aria-label={`${project.title} 기술 구성`}>
              {project.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className={styles.catalogCardLinks}>
              <ExternalLink
                href={benchmarkTreeUrl(project.repositoryPath)}
                primary
              >
                코드 보기
              </ExternalLink>
              {project.researchHref ? (
                <ResearchLink className={styles.internalLink} href={project.researchHref}>
                  {project.researchLabel ?? '연구 내용 보기'}
                </ResearchLink>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
