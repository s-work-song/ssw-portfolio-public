import type { PortfolioResearchDetailsControlInput, PortfolioResearchYearId } from './view.ts';
import {
  isPortfolioResearchYear,
  publishPortfolioResearchDetailsRequest,
  readPortfolioViewState,
} from '../webmcp/portfolioView.ts';
import { isPortfolioTargetAligned, isPortfolioTargetReady } from './viewTargetVisibility.ts';
import {
  CHAT_ACTION_TARGET_ARRIVED_EVENT,
  type ChatActionNavigationOptions,
  type ChatActionTargetArrivedDetail,
} from '../chat/navigation.ts';
import { navigationPathMatches } from '../chat/workflow/toolNavigationObservation.ts';
import { waitForAbortableDelay } from './abortableDelay.ts';

export interface ResearchDetailsSnapshot {
  pathname: string;
  targetReady: boolean;
  targetAligned: boolean;
  /** 대상 카드 각각의 실제 펼침 상태. 빈 배열은 미마운트 또는 대상 없음이다. */
  expanded: boolean[];
}

interface ResearchDetailsControlEnvironment {
  read: typeof readResearchDetailsSnapshot;
  readCurrentYear?: typeof readCurrentResearchYear;
  publish: typeof publishPortfolioResearchDetailsRequest;
  subscribe: typeof subscribeToResearchArrival;
  now: () => number;
  wait: typeof waitForAbortableDelay;
  basePath: string;
  minimumDelayMs: number;
  timeoutMs: number;
}

export function researchDetailsRoute(target: PortfolioResearchDetailsControlInput['target']): string {
  return target === 'all' ? '/about-me/research#research-timeline-overview'
    : `/about-me/research#research-year-${target}`;
}

/** URL 해시가 아닌 활성 연구 여정의 실제 보이는 연도만 위치 보존에 쓴다. */
export function readCurrentResearchYear(basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''): PortfolioResearchYearId | null {
  const pathname = window.location.pathname;
  if (!navigationPathMatches('/about-me/research', pathname, basePath)) return null;
  const view = readPortfolioViewState(pathname);
  if (view.page !== 'research' || view.researchTab !== 'timeline'
    || !isPortfolioResearchYear(view.researchYear)) return null;
  const anchor = document.getElementById(`research-year-${view.researchYear}`);
  const timeline = document.getElementById('research-timeline');
  return anchor && timeline?.contains(anchor) && isPortfolioTargetReady(anchor)
    ? view.researchYear : null;
}

/** 카드 범위와 이동 위치를 분리한다. 전체 제어도 보존한 연도의 도착을 확인한다. */
export function readResearchDetailsSnapshot(
  target: PortfolioResearchDetailsControlInput['target'],
  position: PortfolioResearchDetailsControlInput['target'] = target,
): ResearchDetailsSnapshot {
  const anchor = document.getElementById(position === 'all'
    ? 'research-timeline-overview' : `research-year-${position}`);
  // expandedYears 집계만으로는 같은 연도의 일부 카드를 놓치므로 전체 대상을 읽는다.
  const details = Array.from(document.querySelectorAll<HTMLElement>(target === 'all'
    ? '.timeline-card-detail' : `[data-research-year="${target}"] .timeline-card-detail`));
  const scroller = document.scrollingElement;
  const scrollTop = scroller?.scrollTop ?? window.scrollY;
  const maximumScrollTop = Math.max(0,
    (scroller?.scrollHeight ?? document.documentElement.scrollHeight) - window.innerHeight);
  const expectedTop = (anchor ? Number.parseFloat(window.getComputedStyle(anchor).scrollMarginTop) || 0 : 0)
    + (Number.parseFloat(window.getComputedStyle(document.documentElement).scrollPaddingTop) || 0);
  return {
    pathname: window.location.pathname,
    targetReady: !!anchor && isPortfolioTargetReady(anchor),
    targetAligned: !!anchor && isPortfolioTargetAligned(anchor, expectedTop, scrollTop, maximumScrollTop),
    expanded: details.map(detail => detail.classList.contains('is-open')
      || detail.getAttribute('aria-hidden') === 'false'),
  };
}

function subscribeToResearchArrival(arrived: (anchor: string) => void): () => void {
  const handleArrived = (event: Event) => {
    const detail = (event as CustomEvent<ChatActionTargetArrivedDetail>).detail;
    if (detail?.anchor) arrived(detail.anchor);
  };
  window.addEventListener(CHAT_ACTION_TARGET_ARRIVED_EVENT, handleArrived);
  return () => window.removeEventListener(CHAT_ACTION_TARGET_ARRIVED_EVENT, handleArrived);
}

/** 카드 변경과 스크롤은 별개다. 도착 신호·현재 정렬·모든 카드 상태를 함께 확인한다. */
export async function runPortfolioResearchDetailsControl(
  input: PortfolioResearchDetailsControlInput,
  navigateRoute: (route: string, options?: ChatActionNavigationOptions) => void,
  signal: AbortSignal = new AbortController().signal,
  environment: ResearchDetailsControlEnvironment = {
    read: readResearchDetailsSnapshot,
    readCurrentYear: readCurrentResearchYear,
    publish: publishPortfolioResearchDetailsRequest,
    subscribe: subscribeToResearchArrival,
    now: () => performance.now(),
    wait: waitForAbortableDelay,
    basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
    minimumDelayMs: 500,
    timeoutMs: 8_000,
  },
): Promise<Record<string, unknown>> {
  if (signal.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
  // 펼침·접기가 레이아웃을 바꾸기 전에 한 번만 읽는다. 연도 지정은 현재 위치보다 우선한다.
  const position = (input.target === 'all' ? environment.readCurrentYear?.(environment.basePath) : null)
    ?? input.target;
  const route = researchDetailsRoute(position);
  const startedAt = environment.now();
  const expectedAnchor = route.slice(route.indexOf('#') + 1);
  let arrived = false;
  // 동기·모션 없는 이동도 놓치지 않도록 요청 게시와 이동보다 먼저 구독한다.
  const unsubscribe = environment.subscribe(anchor => {
    if (anchor === expectedAnchor) arrived = true;
  });
  const expanded = input.action === 'expand';
  const navigationController = new AbortController();
  const cancelNavigation = () => navigationController.abort();
  signal.addEventListener('abort', cancelNavigation, { once: true });
  const isRequestedStateReady = (snapshot: ResearchDetailsSnapshot) =>
    navigationPathMatches(route, snapshot.pathname, environment.basePath)
      && snapshot.targetReady && snapshot.expanded.length > 0
      && snapshot.expanded.every(value => value === expanded);
  let applied = false;
  try {
    // 다른 페이지에서도 도착 즉시 적용하도록 저장소와 이벤트에 먼저 남긴다.
    environment.publish(input.action, input.target === 'all' ? undefined : input.target);
    navigateRoute(route, {
      signal: navigationController.signal,
      // React 커밋 이전의 옛 위치가 이미 정렬돼 있어도 조기도착하지 않는다.
      isTargetReady: () => isRequestedStateReady(environment.read(input.target, position)),
    });
    while (!signal.aborted) {
      const snapshot = environment.read(input.target, position);
      const elapsed = environment.now() - startedAt;
      const ready = arrived && isRequestedStateReady(snapshot) && snapshot.targetAligned;
      if (ready && elapsed >= environment.minimumDelayMs && elapsed <= environment.timeoutMs) { applied = true; break; }
      if (elapsed >= environment.timeoutMs) break;
      await environment.wait(Math.min(50, environment.timeoutMs - elapsed), signal);
    }
    if (signal.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
  } finally {
    unsubscribe();
    signal.removeEventListener('abort', cancelNavigation);
    cancelNavigation();
  }
  const label = `${input.target === 'all' ? '연구 여정 전체' : input.target === '2011'
    ? '학창 시절 연구' : `${input.target}년 연구`} 상세 ${expanded ? '펼치기' : '접기'}`;
  return {
    ok: applied, status: applied ? 'applied' : 'failed', ...input, route, label,
    message: applied ? `${label}를 화면에서 확인했습니다.` : '연구 상세 변경이 화면에 반영되지 않았습니다.',
  };
}
