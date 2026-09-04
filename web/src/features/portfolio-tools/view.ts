import {
  ToolDefinition,
  assertOnlyKeys,
  emptyInputDefinition,
  enumObjectSchema,
  isAllowed,
  type InputDefinition,
} from './contract.ts';

/** `control_portfolio_view`가 받을 수 있는 화면 제어 동작이다. */
export const PORTFOLIO_VIEW_ACTIONS = [
  'main', 'overview', 'resume', 'cover-letter', 'research', 'research-timeline',
  'research-optimization', 'research-tools', 'research-2022', 'research-2023',
  'research-2024', 'research-2025', 'research-2026', 'log',
  'expand-research-details', 'collapse-research-details',
  'expand-research-year-details', 'collapse-research-year-details',
  'past-work-archive', 'ai-collaboration-projects', 'archive-canvas-dodge-game',
  'archive-wpf-excel-row-mapper', 'archive-android-ar-campfire',
  'project-common-infrastructure', 'project-ecommerce-demo',
  'project-game-collection-platform', 'project-code-archive',
] as const;
export const PORTFOLIO_RESEARCH_YEARS = ['2022', '2023', '2024', '2025', '2026'] as const;
export const PORTFOLIO_RESEARCH_TABS = [
  'timeline', 'optimization', 'cpu', 'memory', 'serialization', 'tools',
] as const;
export const YEAR_DETAIL_ACTIONS = [
  'expand-research-year-details', 'collapse-research-year-details',
] as const;
export const PORTFOLIO_PAGE_IDS = [
  'landing', 'main', 'overview', 'resume', 'cover-letter', 'research', 'log',
  'settings', 'unknown',
] as const;

export type PortfolioViewActionId = (typeof PORTFOLIO_VIEW_ACTIONS)[number];
export type PortfolioResearchYearId = (typeof PORTFOLIO_RESEARCH_YEARS)[number];
export type PortfolioResearchTabId = (typeof PORTFOLIO_RESEARCH_TABS)[number];
export type PortfolioPageId = (typeof PORTFOLIO_PAGE_IDS)[number];
export interface PortfolioViewControlInput {
  action: PortfolioViewActionId;
  year?: PortfolioResearchYearId;
}

export function viewActionRequiresYear(action: PortfolioViewActionId): boolean {
  return (YEAR_DETAIL_ACTIONS as readonly string[]).includes(action);
}

/** action/year의 enum schema와 조건부 year 검증을 하나의 input definition으로 묶는다. */
export const portfolioViewControlInput: InputDefinition<PortfolioViewControlInput> = {
  schema: enumObjectSchema({
    action: {
      values: PORTFOLIO_VIEW_ACTIONS,
      description: '화면 이동, 전체 연구 상세 제어 또는 연도별 연구 상세 제어 동작',
    },
    year: {
      values: PORTFOLIO_RESEARCH_YEARS,
      description: 'expand-research-year-details 또는 collapse-research-year-details일 때 반드시 지정할 연구 연도',
    },
  }, ['action']),
  parse(input) {
    assertOnlyKeys(input, ['action', 'year']);
    if (!isAllowed(input.action, PORTFOLIO_VIEW_ACTIONS)) {
      throw new TypeError('지원하지 않는 포트폴리오 화면 제어 동작입니다.');
    }
    const action = input.action;
    const rawYear = input.year;
    const year = isAllowed(rawYear, PORTFOLIO_RESEARCH_YEARS) ? rawYear : undefined;
    if ((viewActionRequiresYear(action) && !year)
      || (!viewActionRequiresYear(action) && rawYear !== undefined)) {
      throw new TypeError('연도별 연구 상세 제어의 연도 인자가 올바르지 않습니다.');
    }
    return year ? { action, year } : { action };
  },
};

/** 화면을 읽고 제어하는 UI 도구 정의다. */
export const PORTFOLIO_VIEW_TOOL_DEFINITIONS = [
  new ToolDefinition('get_portfolio_view_state', emptyInputDefinition('현재 화면 상태 조회')),
  new ToolDefinition('control_portfolio_view', portfolioViewControlInput),
  new ToolDefinition('open_portfolio_settings', emptyInputDefinition('설정 페이지 열기')),
] as const;
