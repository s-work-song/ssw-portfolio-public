"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { SearchablePostSummary } from "@/lib/posts";
import { compareEnglishFirst } from "@/lib/textSort";
import { getSearchTokens } from "@/lib/textSearch";
import { AskAiButton } from "@/features/chat";
import {
  consumePortfolioLogSearchView,
  PORTFOLIO_LOG_SEARCH_VIEW_EVENT,
  type PortfolioLogSearchViewDetail,
} from "@/features/webmcp/logSearchView";
import styles from "./LogEntries.module.css";

type LogEntriesProps = {
  posts: SearchablePostSummary[];
};

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_QUERY_PARAM = "q";
const SEARCH_TAG_PARAM = "tag";
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
  const [isLocationStateReady, setIsLocationStateReady] = useState(false);
  const [externalSearch, setExternalSearch] = useState<{
    slugs: ReadonlySet<string>;
    source: PortfolioLogSearchViewDetail["source"];
  } | null>(null);
  const tags = useMemo(
    () => Array.from(new Set(posts.flatMap((post) => post.tags ?? [])))
      .sort(compareEnglishFirst),
    [posts],
  );
  const searchTokens = useMemo(() => getSearchTokens(appliedQuery), [appliedQuery]);
  const visiblePosts = useMemo(
    () => posts.filter((post) => {
      const matchesTag = selectedTag === null || post.tags?.includes(selectedTag);
      const matchesQuery = externalSearch
        ? externalSearch.slugs.has(post.slug)
        : searchTokens.every((token) => post.searchText.includes(token));
      return matchesTag && matchesQuery;
    }),
    [externalSearch, posts, searchTokens, selectedTag],
  );
  const [renderedPosts, setRenderedPosts] = useState(visiblePosts);
  const renderedPostsRef = useRef(visiblePosts);
  const [animatingSlugs, setAnimatingSlugs] = useState<Set<string>>(() => new Set());
  const [hiddenSlugs, setHiddenSlugs] = useState<Set<string>>(() => new Set());
  const [collapsedSlugs, setCollapsedSlugs] = useState<Set<string>>(() => new Set());
  const [longPhaseSlugs, setLongPhaseSlugs] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const applySearchView = (detail: PortfolioLogSearchViewDetail) => {
      const availableSlugs = new Set(posts.map(({ slug }) => slug));
      const matchedSlugs = new Set(
        detail.matchedSlugs.filter((slug) => availableSlugs.has(slug)),
      );
      const tag = detail.tag && tags.includes(detail.tag) ? detail.tag : null;
      setExternalSearch({ slugs: matchedSlugs, source: detail.source });
      setSelectedTag(tag);
      setQuery(detail.query);
      setAppliedQuery(detail.query);
      setIsComposing(false);
    };

    let receivedSearchView = false;
    const handleSearchView = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<PortfolioLogSearchViewDetail>;
      consumePortfolioLogSearchView();
      if (event.detail) {
        receivedSearchView = true;
        applySearchView(event.detail);
        setIsLocationStateReady(true);
      }
    };
    window.addEventListener(PORTFOLIO_LOG_SEARCH_VIEW_EVENT, handleSearchView);

    const pending = consumePortfolioLogSearchView();
    const restoreFrameId = window.requestAnimationFrame(() => {
      if (receivedSearchView) return;

      if (pending) {
        applySearchView(pending);
      } else {
        const searchParams = new URLSearchParams(window.location.search);
        const restoredQuery = searchParams.get(SEARCH_QUERY_PARAM) ?? "";
        const requestedTag = searchParams.get(SEARCH_TAG_PARAM);
        const restoredTag = requestedTag && tags.includes(requestedTag)
          ? requestedTag
          : null;
        setSelectedTag(restoredTag);
        setExternalSearch(null);
        setQuery(restoredQuery);
        setAppliedQuery(restoredQuery);
        setIsComposing(false);
      }
      setIsLocationStateReady(true);
    });

    return () => {
      window.cancelAnimationFrame(restoreFrameId);
      window.removeEventListener(PORTFOLIO_LOG_SEARCH_VIEW_EVENT, handleSearchView);
    };
  }, [posts, tags]);

  useEffect(() => {
    if (!isLocationStateReady) return;

    const url = new URL(window.location.href);
    if (query.length > 0) {
      url.searchParams.set(SEARCH_QUERY_PARAM, query);
    } else {
      url.searchParams.delete(SEARCH_QUERY_PARAM);
    }
    if (selectedTag) {
      url.searchParams.set(SEARCH_TAG_PARAM, selectedTag);
    } else {
      url.searchParams.delete(SEARCH_TAG_PARAM);
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [isLocationStateReady, query, selectedTag]);

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
        setExternalSearch(null);
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
          data-guided-tour-target="log-entries-heading"
        >
          <p className={styles.eyebrow}>ARCHIVE</p>
          <h2 id="log-entries-title" className={styles.heading}>전체 기록</h2>
        </div>

        <div className={styles.toolbarControls}>
          <div className={styles.searchRow}>
            <form
              className={styles.searchForm}
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                const submittedQuery = String(
                  new FormData(event.currentTarget).get("query") ?? "",
                );
                setQuery(submittedQuery);
                setAppliedQuery(submittedQuery);
                setExternalSearch(null);
                setIsComposing(false);
              }}
            >
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
                  name="query"
                  className={styles.searchInput}
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setExternalSearch(null);
                    setQuery(event.target.value);
                  }}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={(event) => {
                    setQuery(event.currentTarget.value);
                    setExternalSearch(null);
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
                      setExternalSearch(null);
                      setIsComposing(false);
                    }}
                    aria-label="검색어 지우기"
                  >
                    ×
                  </button>
                )}
              </div>
              <button type="submit" className={styles.searchSubmit}>
                검색
              </button>
            </form>
            <p
              className={styles.resultCount}
              aria-live="polite"
              aria-busy={isComposing || query !== appliedQuery}
            >
              {externalSearch
                ? `${externalSearch.source === "webmcp" ? "WebMCP" : "모델 도구"} 검색 · `
                : ""}
              {visiblePosts.length}개 기록
            </p>
          </div>

          {tags.length > 0 && (
            <div className={styles.filters} aria-label="기록 태그 필터">
              <button
                type="button"
                className={selectedTag === null ? styles.filterActive : styles.filter}
                aria-pressed={selectedTag === null}
                onClick={() => {
                  setExternalSearch(null);
                  setSelectedTag(null);
                }}
              >
                전체
              </button>
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={selectedTag === tag ? styles.filterActive : styles.filter}
                  aria-pressed={selectedTag === tag}
                  onClick={() => {
                    setExternalSearch(null);
                    setSelectedTag(tag);
                  }}
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
              setExternalSearch(null);
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
                        guidedTourTarget={
                          slug === "ask-ai-for-options-before-implementation"
                            ? "log-ai-options-ask-ai"
                            : undefined
                        }
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
