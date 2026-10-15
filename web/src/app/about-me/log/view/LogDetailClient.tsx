'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import {
  getPortfolioLog,
  portfolioLogHref,
  type LogDetailResponse,
} from '@/lib/logApi';
import styles from './page.module.css';

export default function LogDetailClient() {
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug')?.trim() ?? '';
  const [loaded, setLoaded] = useState<{ slug: string; detail: LogDetailResponse } | null>(null);
  const [failed, setFailed] = useState<{ slug: string; message: string } | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    void getPortfolioLog(slug, controller.signal)
      .then((result) => {
        setLoaded({ slug, detail: result });
        setFailed(null);
        document.title = `${result.post.title} | Log`;
      })
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return;
        setFailed({
          slug,
          message: caught instanceof Error ? caught.message : '기록을 불러오지 못했습니다.',
        });
      });
    return () => controller.abort();
  }, [retryNonce, slug]);

  const detail = loaded?.slug === slug ? loaded.detail : null;
  const error = !slug
    ? '읽을 기록이 지정되지 않았습니다.'
    : failed?.slug === slug
      ? failed.message
      : null;

  useEffect(() => {
    if (!detail || !window.location.hash) return;
    const frameId = window.requestAnimationFrame(() => {
      const target = document.getElementById(window.location.hash.slice(1));
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [detail]);

  if (error) {
    return (
      <section className={styles.readingSurface} role="alert">
        <p className={styles.bodyParagraph}>{error}</p>
        <div className={styles.footerAction}>
          <Link href="/about-me/log" className={styles.listButton}>목록으로</Link>
          {slug && (
            <button
              type="button"
              className={styles.listButton}
              onClick={() => setRetryNonce((current) => current + 1)}
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
            <Link href="/about-me/log" className={styles.listButton}>
              <span aria-hidden="true">←</span>
              목록으로
            </Link>
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
              <Link href="/about-me/log" className={styles.footerListLink}>
                전체 목록 보기
                <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className={styles.relatedGrid}>
              {relatedPosts.map((related) => (
                <Link
                  key={related.slug}
                  href={portfolioLogHref(related.slug)}
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
                </Link>
              ))}
            </div>
          </section>
        )}
        <div className={styles.footerAction}>
          <Link href="/about-me/log" className={styles.listButton}>
            <span aria-hidden="true">←</span>
            목록으로 돌아가기
          </Link>
        </div>
      </footer>
    </article>
  );
}
