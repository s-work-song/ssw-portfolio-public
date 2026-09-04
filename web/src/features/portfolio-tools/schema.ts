/**
 * 포트폴리오 UI 도구의 공개 단일 진입점이다.
 *
 * 허용값과 도구 정의는 settings/view 도메인에 두고, 여기서는 기존 소비자가
 * 한 경로로 접근할 수 있도록 합친다. `ToolDefinition`의 input은 런타임
 * 검증·JSON Schema·TypeScript 입력 타입을 같은 정의에서 파생한다.
 */
import { ToolRegistry } from './contract.ts';
import {
  ACCENTS,
  CHAT_FONTS,
  CHAT_FONT_SIZES,
  CHAT_LAYOUTS,
  CHAT_STREAM_ANIMATIONS,
  PORTFOLIO_SETTINGS_TOOL_DEFINITIONS,
  THEMES,
  THEME_MODES,
  type PortfolioAccent,
  type PortfolioChatFont,
  type PortfolioChatFontSize,
  type PortfolioChatLayout,
  type PortfolioStreamAnimation,
  type PortfolioTheme,
  type PortfolioThemeMode,
} from './settings.ts';
import {
  PORTFOLIO_PAGE_IDS,
  PORTFOLIO_RESEARCH_TABS,
  PORTFOLIO_RESEARCH_YEARS,
  PORTFOLIO_VIEW_ACTIONS,
  PORTFOLIO_VIEW_TOOL_DEFINITIONS,
  YEAR_DETAIL_ACTIONS,
  portfolioViewControlInput,
  viewActionRequiresYear,
  type PortfolioPageId,
  type PortfolioResearchTabId,
  type PortfolioResearchYearId,
  type PortfolioViewActionId,
  type PortfolioViewControlInput,
} from './view.ts';

export {
  ACCENTS,
  CHAT_FONTS,
  CHAT_FONT_SIZES,
  CHAT_LAYOUTS,
  CHAT_STREAM_ANIMATIONS,
  PORTFOLIO_PAGE_IDS,
  PORTFOLIO_RESEARCH_TABS,
  PORTFOLIO_RESEARCH_YEARS,
  PORTFOLIO_VIEW_ACTIONS,
  THEMES,
  THEME_MODES,
  YEAR_DETAIL_ACTIONS,
  viewActionRequiresYear,
};
export type {
  PortfolioAccent,
  PortfolioChatFont,
  PortfolioChatFontSize,
  PortfolioChatLayout,
  PortfolioPageId,
  PortfolioResearchTabId,
  PortfolioResearchYearId,
  PortfolioStreamAnimation,
  PortfolioTheme,
  PortfolioThemeMode,
  PortfolioViewActionId,
  PortfolioViewControlInput,
};
export {
  assertInputObject,
  assertOnlyKeys,
  emptyInputDefinition,
  enumInputDefinition,
  isAllowed,
  isRecord,
  isString,
  ToolDefinition,
  ToolRegistry,
  type InputDefinition,
  type JsonObjectSchema,
} from './contract.ts';

const portfolioUiToolDefinitions = [
  ...PORTFOLIO_SETTINGS_TOOL_DEFINITIONS,
  ...PORTFOLIO_VIEW_TOOL_DEFINITIONS,
] as const;

export const PORTFOLIO_UI_TOOL_REGISTRY = new ToolRegistry(portfolioUiToolDefinitions);

/** 챗봇과 WebMCP가 함께 쓰는 포트폴리오 UI 도구 이름이다. */
export type PortfolioUiToolName = (typeof portfolioUiToolDefinitions)[number]['name'];
export const PORTFOLIO_UI_TOOL_NAMES = Object.freeze(
  PORTFOLIO_UI_TOOL_REGISTRY.definitions.map(({ name }) => name),
) as readonly PortfolioUiToolName[];

/** WebMCP 등록과 UI 실행기가 같은 definition map을 사용한다. */
export const PORTFOLIO_UI_TOOLS = PORTFOLIO_UI_TOOL_REGISTRY.byName;

/** 이전 서버 응답의 도구 이름만 정규화한다. 새 등록에는 별칭을 노출하지 않는다. */
const LEGACY_TOOL_NAMES = new Map(
  [...PORTFOLIO_UI_TOOL_NAMES, 'cycle_portfolio_accent']
    .map((name) => [name.replaceAll('_', '-'), name]),
);

export function normalizePortfolioToolName(name: unknown): string | null {
  return typeof name === 'string' ? LEGACY_TOOL_NAMES.get(name) ?? name : null;
}

/** 기존 파서 소비자를 위한 호환 export다. */
export const readViewControlInput = portfolioViewControlInput.parse;
