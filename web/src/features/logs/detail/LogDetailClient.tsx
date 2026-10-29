'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import {
  getPortfolioLog,
  clearPortfolioLogCache,
  type LogDetailResponse,
} from '@/features/logs/api/logApi';
import LogReadingLink from '../navigation/LogReadingLink';
import LogListLink from '../navigation/LogListLink';
import { captureLogDetailReturn, type LogListReturn } from '../navigation/logListReturn';
import { scheduleLogReadingPosition } from './logReadingPosition';
import styles from '../../../app/about-me/log/view/page.module.css';

export default function LogDetailClient() {
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug')?.trim() ?? '';
  const [loaded, setLoaded] = useState<{ slug: string; requestKey: string; detail: LogDetailResponse; returnTo: LogListReturn | null } | null>(null);
  const [failed, setFailed] = useState<{ slug: string; requestKey: string; message: string; returnTo: LogListReturn | null } | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const requestKey = `${slug}\u0000${retryNonce}`;
  const refreshLog = () => {
    clearPortfolioLogCache();
    setRetryNonce((current) => current + 1);
  };
  const isLoading = loaded?.requestKey !== requestKey && failed?.requestKey !== requestKey;

  useEffect(() => {
    if (!slug) return;
    const returnTo = captureLogDetailReturn(window, slug);
    const controller = new AbortController();
    void getPortfolioLog(slug, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setLoaded({ slug, requestKey, detail: result, returnTo });
        setFailed(null);
        document.title = `${result.post.title} | Log`;
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        if (caught instanceof DOMException && caught.name === 'AbortError') return;
        setFailed({
          slug,
          requestKey,
          returnTo,
          message: caught instanceof Error ? caught.message : '기록을 불러오지 못했습니다.',
        });
      });
    return () => controller.abort();
  }, [requestKey, slug]);

  const detail = loaded?.slug === slug ? loaded.detail : null;
  const returnTo = loaded?.slug === slug ? loaded.returnTo : failed?.slug === slug ? failed.returnTo : null;
  const error = !slug
    ? '읽을 기록이 지정되지 않았습니다.'
    : failed?.slug === slug
      ? failed.message
      : null;

  useEffect(() => {
    if (!detail) return;
    return scheduleLogReadingPosition(window, slug);
  }, [detail, slug]);

  if (error) {
    return (
      <section className={styles.readingSurface} role="alert">
        <p className={styles.bodyParagraph}>{error}</p>
        <div className={styles.footerAction}>
          <LogListLink returnTo={returnTo} className={styles.listButton}>목록으로</LogListLink>
          {slug && (
            <button
              type="button"
              className={styles.listButton}
              onClick={refreshLog}
              disabled={isLoading}
            >
              다시 불러오기
            </button>
          )}
        </div>
      </section>
    );
  }

  if (!detail) {
    return <p style={{ color: 'var(--text-dim)' }}>기록을 불러오고 있습니다.</p>;
  }

  const { post, relatedPosts } = detail;
  let headingIndex = 0;
  const sectionAnchor = () => ({ id: `log-section-${++headingIndex}`, tabIndex: -1 });

  return (
    <article className={styles.article}>
      <div className={styles.readingSurface}>
        <header className={styles.articleHeader}>
          <div className={styles.titleRow}>
            <h1 className={styles.articleTitle}>{post.title}</h1>
            <div className={styles.headerActions}>
              <LogListLink returnTo={returnTo} className={styles.listButton}>
                <span aria-hidden="true">←</span>
                목록으로
              </LogListLink>
              <button type="button" className={styles.listButton} onClick={refreshLog}
                disabled={isLoading} aria-label="기록 본문 새로고침" aria-busy={isLoading}>
                {isLoading ? '불러오는 중' : '새로고침'}
              </button>
            </div>
          </div>
          {(post.date || post.tags.length > 0) && (
            <div className={styles.articleMeta}>
              {post.date && <time>{post.date}</time>}
              {post.tags.length > 0 && (
                <div className={styles.tagList} aria-label="글 태그">
                  {post.tags.map((tag) => <span key={tag} className={styles.tag}>#{tag}</span>)}
                </div>
              )}
            </div>
          )}
        </header>

        <div className={`${styles.markdownBody} markdown-content`}>
          <ReactMarkdown
            components={{
              h1: ({ node, ...props }) => {
                void node;
                return <h2 className={styles.bodyH1} {...sectionAnchor()} {...props} />;
              },
              h2: ({ node, ...props }) => {
                void node;
                return <h2 className={styles.bodyH2} {...sectionAnchor()} {...props} />;
              },
              h3: ({ node, ...props }) => {
                void node;
                return <h3 className={styles.bodyH3} {...props} />;
              },
              p: ({ node, ...props }) => {
                void node;
                return <p className={styles.bodyParagraph} {...props} />;
              },
              a: ({ node, href, children, ...props }) => {
                void node;
                const isExternal = Boolean(href?.startsWith('http://') || href?.startsWith('https://'));
                return (
                  <a
                    className={`${styles.markdownLink}${isExternal ? ` ${styles.externalLink}` : ''}`}
                    href={href}
                    target={isExternal ? '_blank' : undefined}
                    rel={isExternal ? 'noopener noreferrer' : undefined}
                    {...props}
                  >
                    {children}
                  </a>
                );
              },
              ul: ({ node, ...props }) => {
                void node;
                return <ul className={styles.bodyList} {...props} />;
              },
              li: ({ node, ...props }) => {
                void node;
                return <li className={styles.bodyListItem} {...props} />;
              },
              blockquote: ({ node, ...props }) => {
                void node;
                return <blockquote className={styles.bodyBlockquote} {...props} />;
              },
            }}
          >
            {post.content}
          </ReactMarkdown>
        </div>
      </div>

      <footer className={styles.articleFooter}>
        {relatedPosts.length > 0 && (
          <section aria-labelledby="related-posts-title">
            <div className={styles.relatedHeader}>
              <div>
                <p className={styles.relatedEyebrow}>CONTINUE READING</p>
                <h2 id="related-posts-title" className={styles.relatedTitle}>다른 기록</h2>
              </div>
              <LogListLink returnTo={returnTo} className={styles.footerListLink}>
                전체 목록 보기
                <span aria-hidden="true">→</span>
              </LogListLink>
            </div>
            <div className={styles.relatedGrid}>
              {relatedPosts.map((related) => (
                <LogReadingLink
                  key={related.slug}
                  slug={related.slug}
                  className={styles.relatedCard}
                >
                  {related.tags.length > 0 && (
                    <div className={styles.cardTagList} aria-label="글 태그">
                      {related.tags.map((tag) => <span key={tag}>#{tag}</span>)}
                    </div>
                  )}
                  <h3>{related.title}</h3>
                  {related.summary && <p>{related.summary}</p>}
                  <span className={styles.relatedArrow} aria-hidden="true">↗</span>
                </LogReadingLink>
              ))}
            </div>
          </section>
        )}
        <div className={styles.footerAction}>
          <LogListLink returnTo={returnTo} className={styles.listButton}>
            <span aria-hidden="true">←</span>
            목록으로 돌아가기
          </LogListLink>
        </div>
      </footer>
    </article>
  );
}
