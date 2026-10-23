'use client';

/**
 * 기록 검색 결과를 기록 목록 화면에 흘려보내는 다리 역할의 모듈이다.
 *
 * WebMCP 도구와 서버 모델의 도구 실행이라는 두 경로가 같은 화면을 건드리므로,
 * 화면 갱신 방법은 여기 한곳에 모아 두고 각 호출부는 검색 입력만 넘긴다.
 * 전달은 브라우저 이벤트로 하고, 아직 화면이 없으면 sessionStorage에 맡겼다가
 * 마운트 직후 꺼내 쓰는 두 갈래를 함께 쓴다.
 */
import { searchPortfolioLogs } from '@/lib/logApi';
import {
  createLogListView,
  type LogListViewResult,
} from './logViewContract.mjs';
import type {
  ChatLogSearchToolExecution,
} from '@/features/chat/types';

/** 기록 목록 화면에 검색 결과를 반영하라고 알리는 이벤트다. 같은 탭 안에서만 오간다. */
export const PORTFOLIO_LOG_SEARCH_VIEW_EVENT = 'portfolio:webmcp-log-search-view';
/** 서버 모델이 기록 검색 도구를 실행했음을 알리는 이벤트다. 브리지가 받아 실제 검색과 화면 반영을 이어 간다. */
export const PORTFOLIO_MODEL_TOOL_EXECUTION_EVENT = 'portfolio:model-tool-execution';
/**
 * 아직 목록 화면이 없을 때 결과를 맡겨 두는 sessionStorage 키다.
 *
 * 이벤트는 그 순간 듣고 있는 쪽에만 닿으므로, 기록 페이지로 이동하는 중이라
 * 아직 마운트되지 않았으면 그대로 사라진다. 저장해 두면 페이지가 뜬 뒤 한 번
 * 꺼내 쓸 수 있다.
 */
const STORAGE_KEY = 'portfolio-pending-log-search-view';

/** 검색을 요청한 주체다. WebMCP 클라이언트가 부른 것인지, 서버 모델의 도구 실행인지 구분한다. */
export type PortfolioLogSearchViewSource = 'webmcp' | 'model-tool';

/** 목록 화면이 그대로 적용할 수 있게 좁혀 둔 검색 결과다. route는 이동 대상이 고정이라 리터럴로 못 박았다. */
export type PortfolioLogSearchViewDetail = {
  route: '/about-me/log#log-entries-heading';
  query: string;
  tag: string | null;
  matchedSlugs: string[];
  source: PortfolioLogSearchViewSource;
};

/**
 * 검색 결과를 저장소에 맡기고 같은 탭에 이벤트로 알린다.
 *
 * 저장과 이벤트는 서로를 대신하는 두 경로다. 목록 화면이 이미 떠 있으면
 * 이벤트로 곧바로 닿고, 아직 없으면 저장해 둔 값을 마운트 시점에 꺼내 쓴다.
 * 저장소가 막혀 있어도 이벤트 경로는 살아 있으므로 실패는 삼킨다.
 */
export function publishPortfolioLogSearchView(detail: PortfolioLogSearchViewDetail): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(detail));
  } catch {
    // 저장소를 쓸 수 없어도 같은 탭 안에서는 이벤트로 검색 결과가 전달된다.
  }
  window.dispatchEvent(new CustomEvent<PortfolioLogSearchViewDetail>(
    PORTFOLIO_LOG_SEARCH_VIEW_EVENT,
    { detail },
  ));
}

/**
 * 맡겨 둔 검색 결과를 꺼내면서 저장소에서 지운다.
 *
 * 한 번만 적용돼야 하는 값이라 읽는 즉시 비운다. 저장소를 못 읽거나 남아 있던
 * 값이 JSON으로 풀리지 않으면 null을 돌려주고, 화면은 주소창의 검색 조건으로
 * 평소처럼 복원된다. 다만 지우기가 읽기와 같은 try 안에 있어, 읽은 뒤 지우기에서
 * 실패하면 읽은 값도 함께 버린다.
 */
export function consumePortfolioLogSearchView(): PortfolioLogSearchViewDetail | null {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PortfolioLogSearchViewDetail;
  } catch {
    return null;
  }
}

/**
 * 기록을 검색하고 그 결과를 목록 화면에 반영한 뒤, 도구 호출자에게 돌려줄 전체 결과를 낸다.
 *
 * WebMCP 도구가 부르는 진입점이다. 화면 반영에 쓰는 값은 createLogListView가
 * 골라 낸 좁은 형태이고, 반환값에는 원본 검색 결과가 함께 담겨 있어 도구가
 * 요약을 만들 수 있다. 검색이 실패하면 예외가 그대로 올라가 화면도 바뀌지 않는다.
 */
export async function preparePortfolioLogSearchView(
  input: { query?: unknown; tags?: unknown; limit?: unknown },
  source: PortfolioLogSearchViewSource,
): Promise<LogListViewResult> {
  const result = createLogListView(await searchPortfolioLogs(input));
  publishPortfolioLogSearchView({ ...result.view, source });
  return result;
}

/** 서버 모델이 실행한 기록 검색 도구 결과다. 타입 계약은 챗봇 쪽과 공유한다. */
export type PortfolioModelToolExecution = ChatLogSearchToolExecution;

/**
 * 모델의 도구 실행 사실을 브리지에 알린다.
 *
 * ChatProvider가 답변을 받아 처리하는 자리에서 부르고, 실제 검색과 화면 반영은
 * 이 이벤트를 듣는 브리지가 맡는다. 챗봇이 기록 페이지 구현을 직접 알지 않게
 * 하려는 분리다. 듣는 쪽이 없으면 아무 일도 일어나지 않는다.
 */
export function dispatchPortfolioModelToolExecution(execution: PortfolioModelToolExecution): void {
  window.dispatchEvent(new CustomEvent<PortfolioModelToolExecution>(
    PORTFOLIO_MODEL_TOOL_EXECUTION_EVENT,
    { detail: execution },
  ));
}

/**
 * 모델이 실행한 검색을 브라우저에서 다시 돌려 목록 화면에 반영한다.
 *
 * 모델이 고른 slug 목록을 그대로 믿지 않고, 같은 질의로 다시 검색해 지금 실제로
 * 존재하는 항목만 남긴다. 서버가 본 기록과 브라우저가 볼 수 있는 기록이 다를 수
 * 있고, 없는 slug를 강조하면 목록이 비어 보이기 때문이다. 중복을 걸러 최대
 * 5개까지만 쓰고, 하나도 남지 않으면 모델의 선택을 접고 검색 결과 그대로를 보여 준다.
 */
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
