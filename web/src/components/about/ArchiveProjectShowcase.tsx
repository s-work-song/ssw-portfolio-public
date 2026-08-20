'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import Link from 'next/link';
import type { AboutArchiveProject } from '@/data/about';
import ArchiveVideoGallery from './ArchiveVideoGallery';
import ProjectMediaCarousel from './ProjectMediaCarousel';
import styles from './ArchiveProjectShowcase.module.css';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function ArchiveProjectShowcase({
  projects,
}: {
  projects: AboutArchiveProject[];
}) {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [activeProjectId, projects],
  );

  const closeModal = () => {
    setActiveProjectId(null);
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
  };

  const openModal = (
    projectId: string,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    lastTriggerRef.current = event.currentTarget;
    setActiveProjectId(projectId);
  };

  useEffect(() => {
    if (!activeProject) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeModal();
    };

    document.body.classList.add(styles.bodyLocked);
    window.addEventListener('keydown', closeOnEscape);
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      document.body.classList.remove(styles.bodyLocked);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [activeProject]);

  return (
    <>
      <div className={styles.grid}>
        {projects.map((project) => (
          <article
            key={project.id}
            id={project.id}
            className={`${styles.card} ${project.wide ? styles.wideCard : ''}`}
          >
            <span className={styles.category}>{project.category}</span>
            <h4 className={styles.title}>{project.title}</h4>

            {project.videos ? (
              <ArchiveVideoGallery
                videos={project.videos}
                images={project.gallery?.images}
                projectTitle={project.title}
                slotCount={project.videoSlotCount}
              />
            ) : project.gallery ? (
              <ProjectMediaCarousel
                gallery={project.gallery}
                projectTitle={project.title}
              />
            ) : (
              <div className={styles.preview} aria-label={project.preview.title}>
                <span className={styles.previewEyebrow}>{project.preview.eyebrow}</span>
                <strong>{project.preview.title}</strong>
                <div className={styles.keypad} aria-hidden="true">
                  <span />
                  <kbd>↑</kbd>
                  <span />
                  <kbd>←</kbd>
                  <kbd>↓</kbd>
                  <kbd>→</kbd>
                </div>
                <span className={styles.previewHint}>{project.preview.hint}</span>
              </div>
            )}

            <p className={styles.description}>{project.desc}</p>
            <div className={styles.tags} aria-label={`${project.title} 기술`}>
              {project.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className={styles.footer}>
              <span className={styles.status}>{project.status}</span>
              <div className={styles.actions}>
                {project.demo && (
                  <button
                    type="button"
                    className={styles.playButton}
                    onClick={(event) => openModal(project.id, event)}
                  >
                    <span aria-hidden="true">▶</span>
                    게임 실행
                  </button>
                )}
                {project.logHref && (
                  <Link
                    href={project.logHref}
                    className={styles.logButton}
                    prefetch={false}
                  >
                    작업 기록 보기
                  </Link>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {activeProject?.demo && (
        <div
          className={styles.overlay}
          role="presentation"
          onClick={closeModal}
        >
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-game-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.dialogHeader}>
              <div>
                <span className={styles.dialogEyebrow}>PLAYABLE ARCHIVE</span>
                <h2 id="archive-game-title">{activeProject.title}</h2>
                <p>{activeProject.demo.controls}</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className={styles.closeButton}
                onClick={closeModal}
                aria-label="게임 닫기"
              />
            </header>
            <div className={styles.gameFrame}>
              <iframe
                key={activeProject.id}
                className={styles.gameIframe}
                src={`${basePath}${activeProject.demo.src}`}
                title={activeProject.demo.title}
                sandbox="allow-scripts allow-modals"
                referrerPolicy="no-referrer"
              />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
