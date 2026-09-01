'use client';

import { searchPortfolioLogs } from '@/lib/logApi';
import {
  createLogListView,
  type LogListViewResult,
} from './logViewContract.mjs';
import type {
  ChatLogSearchToolExecution,
} from '@/features/chat/types';

export const PORTFOLIO_LOG_SEARCH_VIEW_EVENT = 'portfolio:webmcp-log-search-view';
export const PORTFOLIO_MODEL_TOOL_EXECUTION_EVENT = 'portfolio:model-tool-execution';
const STORAGE_KEY = 'portfolio-pending-log-search-view';

export type PortfolioLogSearchViewSource = 'webmcp' | 'model-tool';

export type PortfolioLogSearchViewDetail = {
  route: '/about-me/log#log-entries-heading';
  query: string;
  tag: string | null;
  matchedSlugs: string[];
  source: PortfolioLogSearchViewSource;
};

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
  const result = createLogListView(await searchPortfolioLogs(input));
  publishPortfolioLogSearchView({ ...result.view, source });
  return result;
}

export type PortfolioModelToolExecution = ChatLogSearchToolExecution;

export function dispatchPortfolioModelToolExecution(execution: PortfolioModelToolExecution): void {
  window.dispatchEvent(new CustomEvent<PortfolioModelToolExecution>(
    PORTFOLIO_MODEL_TOOL_EXECUTION_EVENT,
    { detail: execution },
  ));
}

export async function preparePortfolioModelToolView(
  execution: ChatLogSearchToolExecution,
): Promise<LogListViewResult> {
  const result = createLogListView(await searchPortfolioLogs({
    query: execution.query,
    limit: 10,
  }));
  const availableSlugs = new Set(result.matches.map(({ slug }) => slug));
  const matchedSlugs = [...new Set(execution.matchedSlugs)]
    .filter((slug) => availableSlugs.has(slug))
    .slice(0, 5);
  if (matchedSlugs.length > 0) result.view.matchedSlugs = matchedSlugs;
  publishPortfolioLogSearchView({ ...result.view, source: 'model-tool' });
  return result;
}
