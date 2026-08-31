'use client';

import { ACTION_ROUTES } from '@/features/chat/constants';
import type {
  ChatPortfolioResearchYear,
  ChatPortfolioViewState,
  ChatPortfolioViewAction,
} from '@/features/chat/types';

export const PORTFOLIO_VIEW_ACTIONS = [
  'main',
  'overview',
  'resume',
  'cover-letter',
  'research',
  'research-2022',
  'research-2023',
  'research-2024',
  'research-2025',
  'research-2026',
  'log',
  'expand-research-details',
  'collapse-research-details',
  'expand-research-year-details',
  'collapse-research-year-details',
] as const;

export const PORTFOLIO_RESEARCH_YEARS = [
  '2022',
  '2023',
  '2024',
  '2025',
  '2026',
] as const;

export type PortfolioViewAction = ChatPortfolioViewAction;
export type PortfolioResearchYear = ChatPortfolioResearchYear;
export type PortfolioResearchDetailsMode = 'expand' | 'collapse';

export const PORTFOLIO_RESEARCH_DETAILS_EVENT =
  'portfolio:research-details-control';

const RESEARCH_DETAILS_STORAGE_KEY =
  'portfolio-pending-research-details-control';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export interface PortfolioResearchDetailsRequest {
  mode: PortfolioResearchDetailsMode;
  year?: PortfolioResearchYear;
}

export interface PortfolioViewTarget {
  action: PortfolioViewAction;
  route: string;
  message: string;
  researchDetails?: PortfolioResearchDetailsMode;
  researchYear?: PortfolioResearchYear;
}

const VIEW_TARGETS: Readonly<Record<PortfolioViewAction, PortfolioViewTarget>> = {
  main: {
    action: 'main',
    route: '/home#hero-title',
    message: '메인 페이지로 이동을 시작했습니다.',
  },
  overview: {
    action: 'overview',
    route: ACTION_ROUTES.overview,
    message: '소개 페이지로 이동을 시작했습니다.',
  },
  resume: {
    action: 'resume',
    route: ACTION_ROUTES.resume,
    message: '이력서 페이지로 이동을 시작했습니다.',
  },
  'cover-letter': {
    action: 'cover-letter',
    route: ACTION_ROUTES.cover_letter,
    message: '자기소개서 페이지로 이동을 시작했습니다.',
  },
  research: {
    action: 'research',
    route: ACTION_ROUTES.research_timeline,
    message: '연구 경험 페이지로 이동을 시작했습니다.',
  },
  'research-2022': {
    action: 'research-2022',
    route: '/about-me/research#research-year-2022',
    message: '연구 경험의 2022년 위치로 이동을 시작했습니다.',
  },
  'research-2023': {
    action: 'research-2023',
    route: '/about-me/research#research-year-2023',
    message: '연구 경험의 2023년 위치로 이동을 시작했습니다.',
  },
  'research-2024': {
    action: 'research-2024',
    route: '/about-me/research#research-year-2024',
    message: '연구 경험의 2024년 위치로 이동을 시작했습니다.',
  },
  'research-2025': {
    action: 'research-2025',
    route: '/about-me/research#research-year-2025',
    message: '연구 경험의 2025년 위치로 이동을 시작했습니다.',
  },
  'research-2026': {
    action: 'research-2026',
    route: '/about-me/research#research-year-2026',
    message: '연구 경험의 2026년·현재 위치로 이동을 시작했습니다.',
  },
  log: {
    action: 'log',
    route: ACTION_ROUTES.log,
    message: '기록 페이지로 이동을 시작했습니다.',
  },
  'expand-research-details': {
    action: 'expand-research-details',
    route: ACTION_ROUTES.research_timeline,
    message: '연구 여정으로 이동해 모든 상세 내용을 펼쳤습니다.',
    researchDetails: 'expand',
  },
  'collapse-research-details': {
    action: 'collapse-research-details',
    route: ACTION_ROUTES.research_timeline,
    message: '연구 여정으로 이동해 모든 상세 내용을 접었습니다.',
    researchDetails: 'collapse',
  },
  'expand-research-year-details': {
    action: 'expand-research-year-details',
    route: ACTION_ROUTES.research_timeline,
    message: '선택한 연도의 연구 상세 내용을 펼쳤습니다.',
    researchDetails: 'expand',
  },
  'collapse-research-year-details': {
    action: 'collapse-research-year-details',
    route: ACTION_ROUTES.research_timeline,
    message: '선택한 연도의 연구 상세 내용을 접었습니다.',
    researchDetails: 'collapse',
  },
};

const YEAR_DETAIL_ACTIONS: ReadonlySet<PortfolioViewAction> = new Set([
  'expand-research-year-details',
  'collapse-research-year-details',
]);

export function isPortfolioViewAction(value: unknown): value is PortfolioViewAction {
  return (
    typeof value === 'string' &&
    (PORTFOLIO_VIEW_ACTIONS as readonly string[]).includes(value)
  );
}

export function isPortfolioResearchYear(value: unknown): value is PortfolioResearchYear {
  return (
    typeof value === 'string' &&
    (PORTFOLIO_RESEARCH_YEARS as readonly string[]).includes(value)
  );
}

export function portfolioViewActionRequiresYear(
  action: PortfolioViewAction,
): boolean {
  return YEAR_DETAIL_ACTIONS.has(action);
}

export function resolvePortfolioViewTarget(
  action: PortfolioViewAction,
  year?: PortfolioResearchYear,
): PortfolioViewTarget {
  const requiresYear = portfolioViewActionRequiresYear(action);
  if (requiresYear && !year) {
    throw new TypeError('연도별 연구 상세 제어에는 연도가 필요합니다.');
  }
  if (!requiresYear && year) {
    throw new TypeError('이 화면 제어 동작에는 연도를 지정할 수 없습니다.');
  }
  const target = VIEW_TARGETS[action];
  if (!year) return target;
  return {
    ...target,
    route: `/about-me/research#research-year-${year}`,
    message: `${year}년 연구 상세 내용을 ${target.researchDetails === 'expand' ? '펼쳤습니다' : '접었습니다'}.`,
    researchYear: year,
  };
}

export function publishPortfolioResearchDetailsRequest(
  mode: PortfolioResearchDetailsMode,
  year?: PortfolioResearchYear,
): void {
  const detail: PortfolioResearchDetailsRequest = {
    mode,
    ...(year ? { year } : {}),
  };
  window.sessionStorage.setItem(
    RESEARCH_DETAILS_STORAGE_KEY,
    JSON.stringify(detail),
  );
  window.dispatchEvent(
    new CustomEvent<PortfolioResearchDetailsRequest>(
      PORTFOLIO_RESEARCH_DETAILS_EVENT,
      { detail },
    ),
  );
}

export function consumePortfolioResearchDetailsRequest(): PortfolioResearchDetailsRequest | null {
  const raw = window.sessionStorage.getItem(RESEARCH_DETAILS_STORAGE_KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(RESEARCH_DETAILS_STORAGE_KEY);
  try {
    const parsed = JSON.parse(raw) as Partial<PortfolioResearchDetailsRequest>;
    if (parsed.mode !== 'expand' && parsed.mode !== 'collapse') return null;
    if (parsed.year !== undefined && !isPortfolioResearchYear(parsed.year)) {
      return null;
    }
    return {
      mode: parsed.mode,
      ...(parsed.year ? { year: parsed.year } : {}),
    };
  } catch {
    return null;
  }
}

function portfolioPageFromPathname(
  pathname: string,
): ChatPortfolioViewState['page'] {
  const normalized = pathname.length > 1
    ? pathname.replace(/\/+$/u, '')
    : pathname;
  const path = basePath && normalized.startsWith(basePath)
    ? normalized.slice(basePath.length) || '/'
    : normalized;
  if (path === '/') return 'landing';
  if (path === '/home') return 'main';
  if (path === '/about-me') return 'overview';
  if (path.startsWith('/about-me/resume')) return 'resume';
  if (path.startsWith('/about-me/cover-letter')) return 'cover-letter';
  if (path.startsWith('/about-me/research')) return 'research';
  if (path.startsWith('/about-me/log')) return 'log';
  if (path.startsWith('/settings')) return 'settings';
  return 'unknown';
}

export function readPortfolioViewState(pathname: string): ChatPortfolioViewState {
  const page = portfolioPageFromPathname(pathname);
  let rawAnchor = '';
  try {
    rawAnchor = decodeURIComponent(window.location.hash.replace(/^#/u, ''));
  } catch {
    rawAnchor = '';
  }
  const anchor = rawAnchor && rawAnchor.length <= 160 ? rawAnchor : null;
  const yearMatch = anchor?.match(/^research-year-(2022|2023|2024|2025|2026)$/u);
  const researchYear = yearMatch?.[1] && isPortfolioResearchYear(yearMatch[1])
    ? yearMatch[1]
    : null;

  let researchDetails: ChatPortfolioViewState['researchDetails'] = null;
  if (page === 'research') {
    const details = Array.from(
      document.querySelectorAll<HTMLElement>('.timeline-card-detail'),
    );
    if (details.length > 0) {
      const expandedYears = new Set<PortfolioResearchYear>();
      let expanded = 0;
      for (const detail of details) {
        const isExpanded =
          detail.classList.contains('is-open') ||
          detail.getAttribute('aria-hidden') === 'false';
        if (!isExpanded) continue;
        expanded += 1;
        const cardText = detail.parentElement?.textContent ?? '';
        const cardYear = cardText.match(/(?:2022|2023|2024|2025|2026)/u)?.[0];
        if (isPortfolioResearchYear(cardYear)) expandedYears.add(cardYear);
      }
      researchDetails = {
        expanded,
        total: details.length,
        expandedYears: [...expandedYears],
      };
    }
  }

  return { page, anchor, researchYear, researchDetails };
}

export function runPortfolioViewAction(
  action: PortfolioViewAction,
  navigateRoute: (route: string) => void,
  year?: PortfolioResearchYear,
): PortfolioViewTarget {
  const target = resolvePortfolioViewTarget(action, year);
  if (target.researchDetails) {
    publishPortfolioResearchDetailsRequest(
      target.researchDetails,
      target.researchYear,
    );
  }
  navigateRoute(target.route);
  return target;
}
