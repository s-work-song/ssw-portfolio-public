"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SearchablePostSummary } from "@/lib/posts";
import { compareEnglishFirst } from "@/lib/textSort";
import { getSearchTokens } from "@/lib/textSearch";
import { AskAiButton } from "@/features/chat";
import styles from "./LogEntries.module.css";

type LogEntriesProps = {
  posts: SearchablePostSummary[];
};

export default function LogEntries({ posts }: LogEntriesProps) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const tags = useMemo(
    () => Array.from(new Set(posts.flatMap((post) => post.tags ?? [])))
      .sort(compareEnglishFirst),
    [posts],
  );
  const searchTokens = useMemo(() => getSearchTokens(query), [query]);
  const visiblePosts = useMemo(
    () => posts.filter((post) => {
      const matchesTag = selectedTag === null || post.tags?.includes(selectedTag);
      const matchesQuery = searchTokens.every((token) => post.searchText.includes(token));
      return matchesTag && matchesQuery;
    }),
    [posts, searchTokens, selectedTag],
  );

  useEffect(() => {
    const revealActionTarget = () => {
      const anchor = window.location.hash.replace(/^#/u, "");
      const prefix = "log-card-";
      if (!anchor.startsWith(prefix)) return;
      const targetSlug = anchor.slice(prefix.length);
      if (posts.some(({ slug }) => slug === targetSlug)) {
        setSelectedTag(null);
        setQuery("");
      }
    };
    revealActionTarget();
    window.addEventListener("hashchange", revealActionTarget);
    return () => window.removeEventListener("hashchange", revealActionTarget);
  }, [posts]);

  return (
    <section
      id="log-entries"
      tabIndex={-1}
      className={styles.section}
      aria-labelledby="log-entries-title"
    >
      <div className={styles.toolbar}>
        <div
          id="log-entries-heading"
          className={styles.toolbarTitle}
          tabIndex={-1}
        >
          <p className={styles.eyebrow}>ARCHIVE</p>
          <h2 id="log-entries-title" className={styles.heading}>전체 기록</h2>
        </div>

        <div className={styles.toolbarControls}>
          <div className={styles.searchRow} role="search">
            <div className={styles.searchBox}>
              <label htmlFor="log-search" className={styles.visuallyHidden}>
                기록 제목과 내용 검색
              </label>
              <svg
                className={styles.searchIcon}
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                id="log-search"
                className={styles.searchInput}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="제목과 내용 검색"
                autoComplete="off"
              />
              {query.length > 0 && (
                <button
                  type="button"
                  className={styles.clearSearch}
                  onClick={() => setQuery("")}
                  aria-label="검색어 지우기"
                >
                  ×
                </button>
              )}
            </div>
            <p className={styles.resultCount} aria-live="polite">
              {visiblePosts.length}개 기록
            </p>
          </div>

          {tags.length > 0 && (
            <div className={styles.filters} aria-label="기록 태그 필터">
              <button
                type="button"
                className={selectedTag === null ? styles.filterActive : styles.filter}
                aria-pressed={selectedTag === null}
                onClick={() => setSelectedTag(null)}
              >
                전체
              </button>
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={selectedTag === tag ? styles.filterActive : styles.filter}
                  aria-pressed={selectedTag === tag}
                  onClick={() => setSelectedTag(tag)}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {visiblePosts.length === 0 ? (
        <div className={styles.empty}>
          <p>
            {query.trim()
              ? `“${query.trim()}”에 해당하는 기록이 없습니다.`
              : "선택한 태그의 기록이 없습니다."}
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSelectedTag(null);
            }}
          >
            검색과 태그 초기화
          </button>
        </div>
      ) : (
        <div className={styles.list}>
          {visiblePosts.map(({ slug, title, date, tags: postTags, summary }) => (
            <article
              key={slug}
              id={`log-card-${slug}`}
              className={styles.card}
              tabIndex={-1}
            >
              <div className={styles.cardMeta}>
                {(postTags?.length ?? 0) > 0 && (
                  <div className={styles.tagList} aria-label="글 태그">
                    {postTags?.map((tag) => <span key={tag}>#{tag}</span>)}
                  </div>
                )}
                {date && <time>{date}</time>}
              </div>

              <div className={styles.cardContent}>
                <Link href={`/about-me/log/${slug}`} className={styles.cardLink}>
                  <h3>{title}</h3>
                  {summary && <p>{summary}</p>}
                </Link>

                <div className={styles.actions}>
                  <Link href={`/about-me/log/${slug}`} className={styles.readLink}>
                    기록 읽기
                  </Link>
                  <AskAiButton
                    align="end"
                    question={`기록 「${title}」의 핵심 내용과 이 경험에서 얻은 관점을 자세히 설명해 주세요.`}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
