'use client';

import {
  createPortfolioLogListView,
  type LogListViewResult,
  type LogSearchIndex,
} from './logTools.mjs';

export const PORTFOLIO_LOG_SEARCH_VIEW_EVENT = 'portfolio:webmcp-log-search-view';
const STORAGE_KEY = 'portfolio-pending-log-search-view';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export type PortfolioLogSearchViewSource = 'webmcp' | 'chat';

export type PortfolioLogSearchViewDetail = LogListViewResult['view'] & {
  source: PortfolioLogSearchViewSource;
};

let logIndexPromise: Promise<LogSearchIndex> | null = null;

export async function loadPortfolioLogIndex(): Promise<LogSearchIndex> {
  if (!logIndexPromise) {
    logIndexPromise = fetch(`${basePath}/data/log-search-index.json`, {
      cache: 'force-cache',
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`로그 검색 인덱스를 불러오지 못했습니다. (${response.status})`);
        }
        return response.json() as Promise<LogSearchIndex>;
      })
      .catch((error) => {
        logIndexPromise = null;
        throw error;
      });
  }
  return logIndexPromise;
}

export function publishPortfolioLogSearchView(detail: PortfolioLogSearchViewDetail): void {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(detail));
  window.dispatchEvent(new CustomEvent<PortfolioLogSearchViewDetail>(
    PORTFOLIO_LOG_SEARCH_VIEW_EVENT,
    { detail },
  ));
}

export function consumePortfolioLogSearchView(): PortfolioLogSearchViewDetail | null {
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(STORAGE_KEY);
  try {
    return JSON.parse(raw) as PortfolioLogSearchViewDetail;
  } catch {
    return null;
  }
}

export async function preparePortfolioLogSearchView(
  input: { query?: unknown; tags?: unknown; limit?: unknown },
  source: PortfolioLogSearchViewSource,
): Promise<LogListViewResult> {
  const result = createPortfolioLogListView(await loadPortfolioLogIndex(), input);
  publishPortfolioLogSearchView({ ...result.view, source });
  return result;
}

export function isPortfolioLogListRequest(message: string): boolean {
  const normalized = message.normalize('NFKC').toLocaleLowerCase('ko-KR');
  const mentionsLogs = /(?:기록|로그|글)/u.test(normalized);
  const asksForResults = /(?:찾|검색|목록|보여)/u.test(normalized);
  return mentionsLogs && asksForResults;
}
