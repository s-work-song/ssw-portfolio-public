"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  listPortfolioLogs,
  portfolioLogHref,
  type LogSummary,
} from "@/lib/logApi";
import { AskAiButton } from "@/features/chat";
import {
  consumePortfolioLogSearchView,
  PORTFOLIO_LOG_SEARCH_VIEW_EVENT,
  type PortfolioLogSearchViewDetail,
} from "@/features/webmcp/logSearchView";
import styles from "./LogEntries.module.css";

type LogViewMode = "all" | "recommended";

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_QUERY_PARAM = "q";
const SEARCH_TAG_PARAM = "tag";
const SEARCH_VIEW_PARAM = "view";
const RECOMMENDED_VIEW_VALUE = "recommended";
const VIEW_MODE_FADE_OUT_MS = 180;
const RESULT_TRANSITION_MS = 500;
const EXIT_ONLY_FADE_MS = 200;
const ENTER_ONLY_SLIDE_MS = 300;
const MIXED_FADE_MS = 150;
const MIXED_SLIDE_MS = 200;

export default function LogEntries() {
  const [posts, setPosts] = useState<LogSummary[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<LogViewMode>("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [isLocationStateReady, setIsLocationStateReady] = useState(false);
  const [isViewModeFading, setIsViewModeFading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const requestKey = `${viewMode}\u0000${selectedTag ?? ""}\u0000${appliedQuery.trim()}\u0000${retryNonce}`;
  const [loadedRequestKey, setLoadedRequestKey] = useState<string | null>(null);
  const isLoading = isLocationStateReady && loadedRequestKey !== requestKey;
  const [externalSearch, setExternalSearch] = useState<{
    slugs: ReadonlySet<string>;
    source: PortfolioLogSearchViewDetail["source"];
  } | null>(null);
  const visiblePosts = useMemo(() => {
    const filteredPosts = externalSearch
      ? posts.filter((post) => externalSearch.slugs.has(post.slug))
      : posts;

    if (viewMode === "recommended") {
      return [...filteredPosts].sort(
        (a, b) => (a.recommendedOrder ?? Number.MAX_SAFE_INTEGER)
          - (b.recommendedOrder ?? Number.MAX_SAFE_INTEGER),
      );
    }
    return filteredPosts;
  }, [externalSearch, posts, viewMode]);
  const [renderedPosts, setRenderedPosts] = useState(visiblePosts);
  const renderedPostsRef = useRef(visiblePosts);
  const [animatingSlugs, setAnimatingSlugs] = useState<Set<string>>(() => new Set());
  const [hiddenSlugs, setHiddenSlugs] = useState<Set<string>>(() => new Set());
  const [collapsedSlugs, setCollapsedSlugs] = useState<Set<string>>(() => new Set());
  const [longPhaseSlugs, setLongPhaseSlugs] = useState<Set<string>>(() => new Set());
  const previousViewModeRef = useRef(viewMode);
  const viewModeFadeTimeoutRef = useRef<number | undefined>(undefined);

  const selectView = (nextViewMode: LogViewMode, nextTag: string | null) => {
    setExternalSearch(null);
    if (nextViewMode === viewMode) {
      setSelectedTag(nextTag);
      return;
    }

    const motionSetting = document.documentElement.dataset.motion;
    const shouldReduceMotion = motionSetting === "off"
      || (motionSetting !== "on" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (shouldReduceMotion) {
      setIsViewModeFading(false);
      setViewMode(nextViewMode);
      setSelectedTag(nextTag);
      return;
    }

    if (viewModeFadeTimeoutRef.current !== undefined) {
      window.clearTimeout(viewModeFadeTimeoutRef.current);
    }
    setIsViewModeFading(true);
    viewModeFadeTimeoutRef.current = window.setTimeout(() => {
      setViewMode(nextViewMode);
      setSelectedTag(nextTag);
      viewModeFadeTimeoutRef.current = undefined;
    }, VIEW_MODE_FADE_OUT_MS);
  };

  useEffect(() => () => {
    if (viewModeFadeTimeoutRef.current !== undefined) {
      window.clearTimeout(viewModeFadeTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    const applySearchView = (detail: PortfolioLogSearchViewDetail) => {
      const matchedSlugs = new Set(detail.matchedSlugs);
      const tag = detail.tag || null;
      setViewMode("all");
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
        const restoredViewMode: LogViewMode = searchParams.get(SEARCH_VIEW_PARAM)
          === RECOMMENDED_VIEW_VALUE
          ? "recommended"
          : "all";
        const restoredTag = requestedTag || null;
        setViewMode(restoredViewMode);
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
  }, []);

  useEffect(() => {
    if (!isLocationStateReady) return;
    const controller = new AbortController();
    void listPortfolioLogs({
      query: appliedQuery.trim(),
      tag: selectedTag,
      view: viewMode,
    }, controller.signal)
      .then((result) => {
        setPosts(result.posts);
        setTags(result.availableTags);
        setLoadError(null);
        setLoadedRequestKey(requestKey);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPosts([]);
        setLoadError(error instanceof Error
          ? error.message
          : "기록을 불러오지 못했습니다.");
        setLoadedRequestKey(requestKey);
      });
    return () => controller.abort();
  }, [appliedQuery, isLocationStateReady, requestKey, selectedTag, viewMode]);

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
    if (viewMode === "recommended") {
      url.searchParams.set(SEARCH_VIEW_PARAM, RECOMMENDED_VIEW_VALUE);
    } else {
      url.searchParams.delete(SEARCH_VIEW_PARAM);
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [isLocationStateReady, query, selectedTag, viewMode]);

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
      const viewModeChanged = previousViewModeRef.current !== viewMode;
      previousViewModeRef.current = viewMode;
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
        && viewMode === "all"
        && selectedTag === null
        && appliedQuery.length === 0;

      const updateRenderedPosts = (nextPosts: LogSummary[]) => {
        renderedPostsRef.current = nextPosts;
        setRenderedPosts(nextPosts);
      };

      if (viewModeChanged) {
        setAnimatingSlugs(new Set());
        setHiddenSlugs(new Set());
        setCollapsedSlugs(new Set());
        setLongPhaseSlugs(new Set());
        updateRenderedPosts(visiblePosts);
        layoutFrameId = window.requestAnimationFrame(() => {
          setIsViewModeFading(false);
        });
        return;
      }

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
      const transitionPosts = [...currentPosts, ...visiblePosts]
        .filter(({ slug }, index, values) => (
          transitionSlugs.has(slug)
          && values.findIndex((candidate) => candidate.slug === slug) === index
        ));
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
  }, [appliedQuery, posts, selectedTag, viewMode, visiblePosts]);

  useEffect(() => {
    const revealActionTarget = () => {
      const anchor = window.location.hash.replace(/^#/u, "");
      const prefix = "log-card-";
      if (!anchor.startsWith(prefix)) return;
      const targetSlug = anchor.slice(prefix.length);
      if (!targetSlug) return;
      setViewMode("all");
      setSelectedTag(null);
      setExternalSearch(null);
      setQuery("");
      setAppliedQuery("");
      setIsComposing(false);
    };
    revealActionTarget();
    window.addEventListener("hashchange", revealActionTarget);
    return () => window.removeEventListener("hashchange", revealActionTarget);
  }, []);

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
              aria-busy={isLoading || isComposing || query !== appliedQuery}
            >
              {externalSearch
                ? `${externalSearch.source === "webmcp" ? "WebMCP" : "모델 도구"} 검색 · `
                : viewMode === "recommended"
                  ? "추천 순서 · "
                  : ""}
              {isLoading ? "불러오는 중" : `${visiblePosts.length}개 기록`}
            </p>
          </div>

          {tags.length > 0 && (
            <div className={styles.filters} aria-label="기록 보기 방식 및 태그 필터">
              <button
                type="button"
                className={
                  viewMode === "all" && selectedTag === null
                    ? styles.filterActive
                    : styles.filter
                }
                aria-pressed={viewMode === "all" && selectedTag === null}
                disabled={isViewModeFading}
                onClick={() => {
                  selectView("all", null);
                }}
              >
                전체
              </button>
              <button
                type="button"
                className={viewMode === "recommended" ? styles.filterActive : styles.filter}
                aria-pressed={viewMode === "recommended"}
                disabled={isViewModeFading}
                onClick={() => {
                  selectView("recommended", null);
                }}
              >
                추천 순서
              </button>
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={selectedTag === tag ? styles.filterActive : styles.filter}
                  aria-pressed={selectedTag === tag}
                  disabled={isViewModeFading}
                  onClick={() => {
                    selectView("all", tag);
                  }}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        className={`${styles.resultsTransition}${
          isViewModeFading ? ` ${styles.resultsTransitionHidden}` : ""
        }`}
        aria-busy={isViewModeFading}
      >
        {viewMode === "recommended" && (
          <div className={styles.recommendedIntro} role="note">
            <span>RECOMMENDED READING</span>
            <p>개발을 시작한 배경과 개발에 대한 관점, 현재 AI 에이전트를 활용하기까지의 과정을 따라가는 추천 순서입니다.</p>
          </div>
        )}

        {loadError ? (
          <div className={styles.empty} role="alert">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => setRetryNonce((current) => current + 1)}
            >
              다시 불러오기
            </button>
          </div>
        ) : isLoading && renderedPosts.length === 0 ? (
          <div className={styles.empty} aria-live="polite">
            <p>기록을 불러오고 있습니다.</p>
          </div>
        ) : renderedPosts.length === 0 ? (
          <div className={styles.empty}>
            <p>
              {appliedQuery.trim()
                ? `“${appliedQuery.trim()}”에 해당하는 기록이 없습니다.`
                : viewMode === "recommended"
                  ? "추천 순서에 등록된 기록이 없습니다."
                  : "선택한 태그의 기록이 없습니다."}
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setAppliedQuery("");
                setIsComposing(false);
                setViewMode("all");
                setSelectedTag(null);
                setExternalSearch(null);
              }}
            >
              검색과 태그 초기화
            </button>
          </div>
        ) : (
          <div className={styles.list}>
            {renderedPosts.map(({ slug, title, date, tags: postTags, summary }, index) => (
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
                    {viewMode === "recommended" ? (
                      <span className={styles.recommendedOrder}>
                        추천 {String(index + 1).padStart(2, "0")}
                      </span>
                    ) : (
                      date && <time>{date}</time>
                    )}
                  </div>

                  <div className={styles.cardContent}>
                    <Link href={portfolioLogHref(slug)} className={styles.cardLink}>
                      <h3>{title}</h3>
                      {summary && <p>{summary}</p>}
                    </Link>

                    <div className={styles.actions}>
                      <Link href={portfolioLogHref(slug)} className={styles.readLink}>
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
      </div>
    </section>
  );
}
