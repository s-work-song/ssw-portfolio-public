import {
  ToolDefinition,
  assertOnlyKeys,
  emptyInputDefinition,
  enumObjectSchema,
  isAllowed,
  type InputDefinition,
} from './contract.ts';
import { AGENT_EXPERIMENT_VIEW_ACTIONS } from '../experiments/data/agentExperimentViewTargets.ts';

/** `control_portfolio_view`가 받을 수 있는 화면 제어 동작이다. */
export const PORTFOLIO_VIEW_ACTIONS = [
  'main', 'overview', 'resume', 'cover-letter', 'research', 'research-timeline',
  'research-optimization', 'research-cpu', 'research-memory', 'research-serialization',
  'research-tools', 'research-chatbot-architecture', 'research-2011', 'research-2022', 'research-2023',
  'research-2024', 'research-2025', 'research-2026', 'log',
  'architecture', 'development-environment', 'deployment-overview', 'migration-memory-history',
  'infrastructure-optimization', 'si-levels', 'si-level-chat', 'si-level-read-only',
  'si-level-implementation', 'si-level-tools', 'si-level-orchestration',
  'si-tools-ffmpeg', 'si-session-messaging',
  'past-work-archive', 'ai-collaboration-projects', 'archive-canvas-dodge-game',
  'archive-wpf-excel-row-mapper', 'archive-android-ar-campfire',
  'project-common-infrastructure', 'project-ecommerce-demo',
  'project-code-archive',
  ...AGENT_EXPERIMENT_VIEW_ACTIONS,
] as const;
export const PORTFOLIO_RESEARCH_YEARS = ['2011', '2022', '2023', '2024', '2025', '2026'] as const;
export const PORTFOLIO_RESEARCH_DETAILS_ACTIONS = ['expand', 'collapse'] as const;
export const PORTFOLIO_RESEARCH_DETAILS_TARGETS = ['all', ...PORTFOLIO_RESEARCH_YEARS] as const;
/** 내부 UI 호환용. 새 모델/WebMCP 입력에는 등록하지 않는다. */
export const LEGACY_RESEARCH_DETAIL_ACTIONS = [
  'expand-research-details', 'collapse-research-details',
  'expand-research-year-details', 'collapse-research-year-details',
] as const;
export const PORTFOLIO_RESEARCH_TABS = [
  'timeline', 'optimization', 'cpu', 'memory', 'serialization', 'tools',
] as const;
export const YEAR_DETAIL_ACTIONS = [
  'expand-research-year-details', 'collapse-research-year-details',
] as const;
export const PORTFOLIO_PAGE_IDS = [
  'landing', 'main', 'overview', 'resume', 'cover-letter', 'research', 'log',
  'architecture', 'ai-workflow', 'settings', 'unknown',
] as const;

export type PortfolioViewActionId = (typeof PORTFOLIO_VIEW_ACTIONS)[number];
export type PortfolioResearchYearId = (typeof PORTFOLIO_RESEARCH_YEARS)[number];
export type PortfolioResearchTabId = (typeof PORTFOLIO_RESEARCH_TABS)[number];
export type PortfolioPageId = (typeof PORTFOLIO_PAGE_IDS)[number];
export interface PortfolioViewControlInput {
  action: PortfolioViewActionId;
}
export interface PortfolioResearchDetailsControlInput {
  action: (typeof PORTFOLIO_RESEARCH_DETAILS_ACTIONS)[number];
  target: (typeof PORTFOLIO_RESEARCH_DETAILS_TARGETS)[number];
}

export function viewActionRequiresYear(action: string): boolean {
  return (YEAR_DETAIL_ACTIONS as readonly string[]).includes(action);
}

/** 이동과 상세 제어를 분리해 이동에는 action 하나만 허용한다. */
export const portfolioViewControlInput: InputDefinition<PortfolioViewControlInput> = {
  schema: enumObjectSchema({
    action: {
      values: PORTFOLIO_VIEW_ACTIONS,
      description: '화면 이동 전용. 연구 경험 성능 최적화 탭의 research-optimization은 최적화 개요, research-cpu는 CPU & SIMD, research-memory는 메모리 & 파일 I/O, research-serialization은 직렬화 & 전송. research-chatbot-architecture는 도구 & SI 접목 탭의 오픈웨이트 모델 챗봇 구조 실험 카드. architecture는 개발·배포 환경, development-environment는 개발 환경, deployment-overview는 배포 구성, infrastructure-optimization은 인프라 최적화, migration-memory-history는 공용 인프라의 Rust 전환 메모리 비교(연구의 메모리 최적화가 아님). 번호 없는 SI 활용 단계 소개는 si-levels, 명시한 01~05단계만 si-level-*, si-tools-ffmpeg는 컨택트 시트, si-session-messaging은 대표 세션 협업 사례. agent-experiments는 SI 실험 소개, agent-experiments-*는 7분류, agent-experiment-*는 공개 개별 실험 소개 카드다. 외부 게임 실행이나 음원 재생은 하지 않는다. research-2011은 학창 시절 연구 경험. 상세 펼침·접기는 control_portfolio_research_details를 사용한다.',
    },
  }, ['action']),
  parse(input) {
    assertOnlyKeys(input, ['action']);
    if (!isAllowed(input.action, PORTFOLIO_VIEW_ACTIONS)) {
      throw new TypeError('지원하지 않는 포트폴리오 화면 제어 동작입니다.');
    }
    return { action: input.action };
  },
};

export const portfolioResearchDetailsControlInput: InputDefinition<PortfolioResearchDetailsControlInput> = {
  schema: enumObjectSchema({
    action: { values: PORTFOLIO_RESEARCH_DETAILS_ACTIONS, description: 'expand는 펼치기, collapse는 접기' },
    target: { values: PORTFOLIO_RESEARCH_DETAILS_TARGETS, description: 'all은 연구 여정 전체, 2011은 학창 시절, 나머지는 지정 연도' },
  }, ['action', 'target']),
  parse(input) {
    assertOnlyKeys(input, ['action', 'target']);
    if (!isAllowed(input.action, PORTFOLIO_RESEARCH_DETAILS_ACTIONS)
      || !isAllowed(input.target, PORTFOLIO_RESEARCH_DETAILS_TARGETS)) {
      throw new TypeError('연구 상세 제어의 동작 또는 대상이 올바르지 않습니다.');
    }
    return { action: input.action, target: input.target };
  },
};

/** 화면을 읽고 제어하는 UI 도구 정의다. */
export const PORTFOLIO_VIEW_TOOL_DEFINITIONS = [
  new ToolDefinition('get_portfolio_view_state', emptyInputDefinition('현재 화면 상태 조회')),
  new ToolDefinition('control_portfolio_view', portfolioViewControlInput),
  new ToolDefinition('control_portfolio_research_details', portfolioResearchDetailsControlInput),
  new ToolDefinition('open_portfolio_settings', emptyInputDefinition('설정 페이지 열기')),
] as const;
