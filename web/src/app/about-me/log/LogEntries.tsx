"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { SearchablePostSummary } from "@/lib/posts";
import { compareEnglishFirst } from "@/lib/textSort";
import { getSearchTokens } from "@/lib/textSearch";
import { AskAiButton } from "@/features/chat";
import styles from "./LogEntries.module.css";

type LogEntriesProps = {
  posts: SearchablePostSummary[];
};

const SEARCH_DEBOUNCE_MS = 250;
const RESULT_TRANSITION_MS = 500;
const EXIT_ONLY_FADE_MS = 200;
const ENTER_ONLY_SLIDE_MS = 300;
const MIXED_FADE_MS = 150;
const MIXED_SLIDE_MS = 200;

export default function LogEntries({ posts }: LogEntriesProps) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const tags = useMemo(
    () => Array.from(new Set(posts.flatMap((post) => post.tags ?? [])))
      .sort(compareEnglishFirst),
    [posts],
  );
  const searchTokens = useMemo(() => getSearchTokens(appliedQuery), [appliedQuery]);
  const visiblePosts = useMemo(
    () => posts.filter((post) => {
      const matchesTag = selectedTag === null || post.tags?.includes(selectedTag);
      const matchesQuery = searchTokens.every((token) => post.searchText.includes(token));
      return matchesTag && matchesQuery;
    }),
    [posts, searchTokens, selectedTag],
  );
  const [renderedPosts, setRenderedPosts] = useState(visiblePosts);
  const renderedPostsRef = useRef(visiblePosts);
  const [animatingSlugs, setAnimatingSlugs] = useState<Set<string>>(() => new Set());
  const [hiddenSlugs, setHiddenSlugs] = useState<Set<string>>(() => new Set());
  const [collapsedSlugs, setCollapsedSlugs] = useState<Set<string>>(() => new Set());
  const [longPhaseSlugs, setLongPhaseSlugs] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (isComposing || query === appliedQuery) return;

    const timeoutId = window.setTimeout(() => {
      setAppliedQuery(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [appliedQuery, isComposing, query]);

  useEffect(() => {
    const timeoutIds: number[] = [];
    let layoutFrameId: number | undefined;

    const startFrameId = window.requestAnimationFrame(() => {
      const currentPosts = renderedPostsRef.current;
      const currentSlugs = new Set(currentPosts.map(({ slug }) => slug));
      const targetSlugs = new Set(visiblePosts.map(({ slug }) => slug));
      const removedSlugs = new Set(
        currentPosts
          .filter(({ slug }) => !targetSlugs.has(slug))
          .map(({ slug }) => slug),
      );
      const addedSlugs = new Set(
        visiblePosts
          .filter(({ slug }) => !currentSlugs.has(slug))
          .map(({ slug }) => slug),
      );
      const motionSetting = document.documentElement.dataset.motion;
      const shouldReduceMotion = motionSetting === "off"
        || (motionSetting !== "on" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      const shouldSkipForActionTarget = window.location.hash.startsWith("#log-card-")
        && selectedTag === null
        && appliedQuery.length === 0;

      const updateRenderedPosts = (nextPosts: SearchablePostSummary[]) => {
        renderedPostsRef.current = nextPosts;
        setRenderedPosts(nextPosts);
      };

      if (shouldReduceMotion || shouldSkipForActionTarget) {
        setAnimatingSlugs(new Set());
        setHiddenSlugs(new Set());
        setCollapsedSlugs(new Set());
        setLongPhaseSlugs(new Set());
        updateRenderedPosts(visiblePosts);
        return;
      }

      if (removedSlugs.size === 0 && addedSlugs.size === 0) {
        setAnimatingSlugs(new Set());
        setHiddenSlugs(new Set());
        setCollapsedSlugs(new Set());
        setLongPhaseSlugs(new Set());
        updateRenderedPosts(visiblePosts);
        return;
      }

      const transitionSlugs = new Set([...currentSlugs, ...targetSlugs]);
      const transitionPosts = posts.filter(({ slug }) => transitionSlugs.has(slug));
      const changedSlugs = new Set([...removedSlugs, ...addedSlugs]);
      setAnimatingSlugs(changedSlugs);
      setHiddenSlugs(changedSlugs);
      setCollapsedSlugs(addedSlugs);
      updateRenderedPosts(transitionPosts);

      const hasRemoved = removedSlugs.size > 0;
      const hasAdded = addedSlugs.size > 0;
      setLongPhaseSlugs(hasRemoved !== hasAdded ? changedSlugs : new Set());

      if (hasRemoved && hasAdded) {
        timeoutIds.push(window.setTimeout(() => {
          setCollapsedSlugs(removedSlugs);
        }, MIXED_FADE_MS));

        timeoutIds.push(window.setTimeout(() => {
          updateRenderedPosts(visiblePosts);
          setAnimatingSlugs(addedSlugs);
          setHiddenSlugs(new Set());
          setCollapsedSlugs(new Set());
        }, MIXED_FADE_MS + MIXED_SLIDE_MS));
      } else if (hasRemoved) {
        timeoutIds.push(window.setTimeout(() => {
          setCollapsedSlugs(removedSlugs);
        }, EXIT_ONLY_FADE_MS));
      } else {
        layoutFrameId = window.requestAnimationFrame(() => {
          setCollapsedSlugs(new Set());
        });

        timeoutIds.push(window.setTimeout(() => {
          setHiddenSlugs(new Set());
        }, ENTER_ONLY_SLIDE_MS));
      }

      timeoutIds.push(window.setTimeout(() => {
        updateRenderedPosts(visiblePosts);
        setAnimatingSlugs(new Set());
        setHiddenSlugs(new Set());
        setCollapsedSlugs(new Set());
        setLongPhaseSlugs(new Set());
      }, RESULT_TRANSITION_MS));
    });

    return () => {
      window.cancelAnimationFrame(startFrameId);
      if (layoutFrameId !== undefined) window.cancelAnimationFrame(layoutFrameId);
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [appliedQuery, posts, selectedTag, visiblePosts]);

  useEffect(() => {
    const revealActionTarget = () => {
      const anchor = window.location.hash.replace(/^#/u, "");
      const prefix = "log-card-";
      if (!anchor.startsWith(prefix)) return;
      const targetSlug = anchor.slice(prefix.length);
      if (posts.some(({ slug }) => slug === targetSlug)) {
        setSelectedTag(null);
        setQuery("");
        setAppliedQuery("");
        setIsComposing(false);
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
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={(event) => {
                  setQuery(event.currentTarget.value);
                  setIsComposing(false);
                }}
                placeholder="제목과 내용 검색"
                autoComplete="off"
              />
              {query.length > 0 && (
                <button
                  type="button"
                  className={styles.clearSearch}
                  onClick={() => {
                    setQuery("");
                    setAppliedQuery("");
                    setIsComposing(false);
                  }}
                  aria-label="검색어 지우기"
                >
                  ×
                </button>
              )}
            </div>
            <p
              className={styles.resultCount}
              aria-live="polite"
              aria-busy={isComposing || query !== appliedQuery}
            >
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

      {renderedPosts.length === 0 ? (
        <div className={styles.empty}>
          <p>
            {appliedQuery.trim()
              ? `“${appliedQuery.trim()}”에 해당하는 기록이 없습니다.`
              : "선택한 태그의 기록이 없습니다."}
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setAppliedQuery("");
              setIsComposing(false);
              setSelectedTag(null);
            }}
          >
            검색과 태그 초기화
          </button>
        </div>
      ) : (
        <div className={styles.list}>
          {renderedPosts.map(({ slug, title, date, tags: postTags, summary }) => (
            <div
              key={slug}
              className={`${styles.resultItem}${
                animatingSlugs.has(slug) ? ` ${styles.resultItemAnimating}` : ""
              }${longPhaseSlugs.has(slug) ? ` ${styles.resultItemLongPhase}` : ""}${
                hiddenSlugs.has(slug) ? ` ${styles.resultItemHidden}` : ""
              }${
                collapsedSlugs.has(slug) ? ` ${styles.resultItemCollapsed}` : ""
              }`}
            >
              <div className={styles.resultItemInner}>
                <article
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
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
