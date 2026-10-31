'use client';

/**
 * "지금 무엇을 보고 있는가"를 DOM에서 읽고, 화면 이동·연구 상세 제어 지시를
 * 실제 경로와 이벤트로 옮기는 모듈이다.
 *
 * 모델은 화면을 직접 볼 수 없으므로 이 모듈이 만드는 요약이 곧 모델의 눈이다.
 * 그래서 읽을 때는 URL 해시 같은 "선언된 상태"보다 실제로 보이는 것을 우선하고,
 * 쓸 때는 허용 목록 안의 경로만 만든다.
 */
import { ACTION_ROUTES } from '../chat/constants.ts';
import { AGENT_EXPERIMENT_VIEW_TARGETS, type AgentExperimentViewAction } from '../experiments/data/agentExperimentViewTargets.ts';
import { readAgentExperimentAnchor } from '../portfolio-tools/experimentNavigation.ts';
import {
  PORTFOLIO_RESEARCH_YEARS,
  PORTFOLIO_VIEW_ACTIONS,
  YEAR_DETAIL_ACTIONS,
  LEGACY_RESEARCH_DETAIL_ACTIONS,
  isAllowed,
} from '../portfolio-tools/schema.ts';
import type {
  ChatPortfolioResearchTab,
  ChatPortfolioResearchYear,
  ChatPortfolioViewState,
  ChatPortfolioViewAction,
} from '@/features/chat/types';

export { PORTFOLIO_VIEW_ACTIONS, PORTFOLIO_RESEARCH_YEARS };

/** 연구 패널의 DOM id 접미사에서 탭 식별자로 가는 표다. */
const RESEARCH_TAB_BY_PANEL_ID: Readonly<Record<string, ChatPortfolioResearchTab>> = {
  overview: 'timeline',
  optimization: 'optimization',
  cpu: 'cpu',
  memory: 'memory',
  serialization: 'serialization',
  meta: 'tools',
  'open-weight': 'open-weight',
};

/** 앵커 id에서 그 앵커가 속한 연구 탭으로 가는 표다. */
const RESEARCH_TAB_BY_ANCHOR: Readonly<Record<string, ChatPortfolioResearchTab>> = {
  'research-timeline-overview': 'timeline',
  'research-timeline': 'timeline',
  'research-panel-overview': 'timeline',
  'research-optimization-overview': 'optimization',
  'research-optimization-caution': 'optimization',
  'research-benchmark-code': 'optimization',
  'research-panel-optimization': 'optimization',
  'research-cpu-simd': 'cpu',
  'research-counting-sort': 'cpu',
  'research-panel-cpu': 'cpu',
  'research-memory-layout': 'memory',
  'research-memory-mmf': 'memory',
  'research-panel-memory': 'memory',
  'research-serialization-packing': 'serialization',
  'research-serialization-bandwidth': 'serialization',
  'research-panel-serialization': 'serialization',
  'research-tools-ai': 'tools',
  'research-ai-verification': 'tools',
  'research-panel-meta': 'tools',
  'research-chatbot-architecture': 'open-weight',
  'research-training-data': 'open-weight',
  'research-training-line': 'open-weight',
  'research-training-examples': 'open-weight',
  'research-panel-open-weight': 'open-weight',
};

/** 내부 레거시 UI 어댑터만 예전 상세 액션을 해석한다. 공개 스키마와 분리한다. */
export type PortfolioViewAction = ChatPortfolioViewAction | (typeof LEGACY_RESEARCH_DETAIL_ACTIONS)[number];
export type PortfolioResearchYear = ChatPortfolioResearchYear;
/** 연구 상세를 펼칠지 접을지다. */
export type PortfolioResearchDetailsMode = 'expand' | 'collapse';

/** 연구 상세 펼침·접기 지시를 연구 페이지에 전달하는 브라우저 이벤트 이름이다. */
export const PORTFOLIO_RESEARCH_DETAILS_EVENT =
  'portfolio:research-details-control';

/** 페이지 이동 뒤에도 지시가 살아남도록 잠시 담아 두는 sessionStorage 키다. */
const RESEARCH_DETAILS_STORAGE_KEY =
  'portfolio-pending-research-details-control';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
/** 서버로 보낼 수 있는 앵커 형태다. 이 밖의 해시는 없는 것으로 본다. */
const ANCHOR_PATTERN = /^[\w-]{1,64}$/u;

/** 연구 페이지로 보내는 상세 제어 지시다. */
export interface PortfolioResearchDetailsRequest {
  mode: PortfolioResearchDetailsMode;
  year?: PortfolioResearchYear;
}

/** 화면 제어 동작 하나가 도달할 목적지와 사용자에게 보고할 문구다. */
export interface PortfolioViewTarget {
  action: PortfolioViewAction;
  route: string;
  message: string;
  /**
   * 목적지를 가리키는 짧은 명사구다.
   *
   * `message`에서 "…로 이동을 시작했습니다"를 뺀 형태로, 화면의 도구 결과
   * 상태 줄("도구 호출 · {label}")과 서버 도구 결과(publicResult.label)가
   * 같은 문구를 쓰도록 여기 한 곳에 둔다.
   */
  label: string;
  researchDetails?: PortfolioResearchDetailsMode;
  researchYear?: PortfolioResearchYear;
}

/**
 * 화면 제어 동작에서 실제 목적지로 가는 표다.
 * 여기에 없는 동작은 애초에 허용 목록을 통과하지 못하므로, 이 표가 도구가
 * 만들 수 있는 경로의 상한이다.
 */
const EXPERIMENT_VIEW_TARGETS = Object.fromEntries(AGENT_EXPERIMENT_VIEW_TARGETS.map((target) => [target.action, {
  action: target.action, route: target.route, label: target.label, message: `${target.label}(으)로 이동을 시작했습니다.`,
}])) as Record<AgentExperimentViewAction, PortfolioViewTarget>;

const VIEW_TARGETS: Readonly<Record<PortfolioViewAction, PortfolioViewTarget>> = {
  ...EXPERIMENT_VIEW_TARGETS,
  main: {
    action: 'main',
    route: ACTION_ROUTES.overview,
    message: '소개 Overview로 이동을 시작했습니다.',
    label: '소개 Overview',
  },
  overview: {
    action: 'overview',
    route: ACTION_ROUTES.overview,
    message: '소개 페이지로 이동을 시작했습니다.',
    label: '소개 페이지',
  },
  resume: {
    action: 'resume',
    route: ACTION_ROUTES.resume,
    message: '이력서 페이지로 이동을 시작했습니다.',
    label: '이력서 페이지',
  },
  'cover-letter': {
    action: 'cover-letter',
    route: ACTION_ROUTES.cover_letter,
    message: '자기소개서 페이지로 이동을 시작했습니다.',
    label: '자기소개서 페이지',
  },
  research: {
    action: 'research',
    route: ACTION_ROUTES.research,
    message: '연구 경험 페이지로 이동을 시작했습니다.',
    label: '연구 경험 페이지',
  },
  'research-timeline': {
    action: 'research-timeline',
    route: ACTION_ROUTES.research_timeline,
    message: '연구 경험의 연구 여정 탭으로 이동을 시작했습니다.',
    label: '연구 경험의 연구 여정 탭',
  },
  'research-optimization': {
    action: 'research-optimization',
    route: ACTION_ROUTES.research_optimization,
    message: '연구 경험의 성능 최적화 탭으로 이동을 시작했습니다.',
    label: '연구 경험의 성능 최적화 탭',
  },
  'research-cpu': {
    action: 'research-cpu',
    route: ACTION_ROUTES.research_cpu,
    message: '성능 최적화의 CPU & SIMD 탭으로 이동을 시작했습니다.',
    label: '성능 최적화의 CPU & SIMD 탭',
  },
  'research-memory': {
    action: 'research-memory',
    route: ACTION_ROUTES.research_memory,
    message: '성능 최적화의 메모리 & 파일 I/O 탭으로 이동을 시작했습니다.',
    label: '성능 최적화의 메모리 & 파일 I/O 탭',
  },
  'research-serialization': {
    action: 'research-serialization',
    route: ACTION_ROUTES.research_serialization,
    message: '성능 최적화의 직렬화 & 전송 탭으로 이동을 시작했습니다.',
    label: '성능 최적화의 직렬화 & 전송 탭',
  },
  'research-tools': {
    action: 'research-tools',
    route: ACTION_ROUTES.research_tools,
    message: '연구 경험의 도구 & SI 접목 탭으로 이동을 시작했습니다.',
    label: '연구 경험의 도구 & SI 접목 탭',
  },
  'research-open-weight': {
    action: 'research-open-weight',
    route: ACTION_ROUTES.research_open_weight,
    message: '연구 경험의 오픈웨이트 모델 실험 탭으로 이동을 시작했습니다.',
    label: '연구 경험의 오픈웨이트 모델 실험 탭',
  },
  'research-chatbot-architecture': {
    action: 'research-chatbot-architecture',
    route: ACTION_ROUTES.research_chatbot_architecture,
    message: '오픈웨이트 모델 실험 탭의 챗봇 구조 실험 카드로 이동을 시작했습니다.',
    label: '오픈웨이트 모델 실험 탭의 챗봇 구조 실험 카드',
  },
  'research-training-data': {
    action: 'research-training-data',
    route: ACTION_ROUTES.research_training_data,
    message: '오픈웨이트 모델 실험 탭의 학습 데이터 형식 카드로 이동을 시작했습니다.',
    label: '오픈웨이트 모델 실험 탭의 학습 데이터 형식 카드',
  },
  'research-training-examples': {
    action: 'research-training-examples',
    route: ACTION_ROUTES.research_training_examples,
    message: '오픈웨이트 모델 실험 탭의 학습 데이터 예시 카드로 이동을 시작했습니다.',
    label: '오픈웨이트 모델 실험 탭의 학습 데이터 예시 카드',
  },
  'research-2011': {
    action: 'research-2011',
    route: '/about-me/research#research-year-2011',
    message: '연구 경험의 학창 시절 위치로 이동을 시작했습니다.',
    label: '연구 경험의 학창 시절 위치',
  },
  'research-2022': {
    action: 'research-2022',
    route: '/about-me/research#research-year-2022',
    message: '연구 경험의 2022년 위치로 이동을 시작했습니다.',
    label: '연구 경험의 2022년 위치',
  },
  'research-2023': {
    action: 'research-2023',
    route: '/about-me/research#research-year-2023',
    message: '연구 경험의 2023년 위치로 이동을 시작했습니다.',
    label: '연구 경험의 2023년 위치',
  },
  'research-2024': {
    action: 'research-2024',
    route: '/about-me/research#research-year-2024',
    message: '연구 경험의 2024년 위치로 이동을 시작했습니다.',
    label: '연구 경험의 2024년 위치',
  },
  'research-2025': {
    action: 'research-2025',
    route: '/about-me/research#research-year-2025',
    message: '연구 경험의 2025년 위치로 이동을 시작했습니다.',
    label: '연구 경험의 2025년 위치',
  },
  'research-2026': {
    action: 'research-2026',
    route: '/about-me/research#research-year-2026',
    message: '연구 경험의 2026년·현재 위치로 이동을 시작했습니다.',
    label: '연구 경험의 2026년·현재 위치',
  },
  log: {
    action: 'log',
    route: ACTION_ROUTES.log,
    message: '기록 페이지로 이동을 시작했습니다.',
    label: '기록 페이지',
  },
  architecture: {
    action: 'architecture',
    route: ACTION_ROUTES.architecture,
    message: '개발·배포 환경 페이지로 이동을 시작했습니다.',
    label: '개발·배포 환경 페이지',
  },
  'development-environment': {
    action: 'development-environment',
    route: ACTION_ROUTES.development_environment,
    message: '개발 환경 탭으로 이동을 시작했습니다.',
    label: '개발 환경 탭',
  },
  'deployment-overview': {
    action: 'deployment-overview',
    route: ACTION_ROUTES.deployment_overview,
    message: '배포 구성 탭으로 이동을 시작했습니다.',
    label: '배포 구성 탭',
  },
  'migration-memory-history': {
    action: 'migration-memory-history',
    route: ACTION_ROUTES.migration_memory_history,
    message: '공용 인프라의 Rust 전환 메모리 비교로 이동을 시작했습니다.',
    label: '공용 인프라의 Rust 전환 메모리 비교',
  },
  'infrastructure-optimization': {
    action: 'infrastructure-optimization', route: ACTION_ROUTES.infrastructure_optimization,
    label: '인프라 최적화 탭', message: '인프라 최적화 탭으로 이동을 시작했습니다.',
  },
  'si-levels': {
    action: 'si-levels', route: ACTION_ROUTES.si_levels,
    label: 'SI 활용 단계 소개', message: 'SI 활용 단계 소개로 이동을 시작했습니다.',
  },
  'si-level-chat': {
    action: 'si-level-chat', route: ACTION_ROUTES.si_level_chat,
    label: 'SI 활용 01단계 · 챗봇과 대화', message: 'SI 활용 01단계 · 챗봇과 대화로 이동을 시작했습니다.',
  },
  'si-level-read-only': {
    action: 'si-level-read-only', route: ACTION_ROUTES.si_level_read_only,
    label: 'SI 활용 02단계 · 조회·분석 위임', message: 'SI 활용 02단계 · 조회·분석 위임으로 이동을 시작했습니다.',
  },
  'si-level-implementation': {
    action: 'si-level-implementation', route: ACTION_ROUTES.si_level_implementation,
    label: 'SI 활용 03단계 · 구현 위임', message: 'SI 활용 03단계 · 구현 위임으로 이동을 시작했습니다.',
  },
  'si-level-tools': {
    action: 'si-level-tools', route: ACTION_ROUTES.si_level_tools,
    label: 'SI 활용 04단계 · MCP·CLI 도구 활용', message: 'SI 활용 04단계 · MCP·CLI 도구 활용으로 이동을 시작했습니다.',
  },
  'si-level-orchestration': {
    action: 'si-level-orchestration', route: ACTION_ROUTES.si_level_orchestration,
    label: 'SI 활용 05단계 · 여러 에이전트 협업 조율', message: 'SI 활용 05단계 · 여러 에이전트 협업 조율로 이동을 시작했습니다.',
  },
  'si-learning': {
    action: 'si-learning', route: ACTION_ROUTES.si_learning,
    label: 'SI 활용 · 배우는 데 쓰기', message: 'SI 활용 · 배우는 데 쓰기로 이동을 시작했습니다.',
  },
  'si-tools-ffmpeg': {
    action: 'si-tools-ffmpeg', route: ACTION_ROUTES.si_tools_ffmpeg,
    label: 'FFmpeg·컨택트 시트 활용 사례', message: 'FFmpeg·컨택트 시트 활용 사례로 이동을 시작했습니다.',
  },
  'si-session-messaging': {
    action: 'si-session-messaging', route: ACTION_ROUTES.si_session_messaging,
    label: '대표 세션 간 메시지 협업 사례', message: '대표 세션 간 메시지 협업 사례로 이동을 시작했습니다.',
  },
  'expand-research-details': {
    action: 'expand-research-details',
    route: ACTION_ROUTES.research_timeline,
    message: '연구 여정으로 이동해 모든 상세 내용을 펼쳤습니다.',
    label: '연구 여정 전체 상세 펼치기',
    researchDetails: 'expand',
  },
  'collapse-research-details': {
    action: 'collapse-research-details',
    route: ACTION_ROUTES.research_timeline,
    message: '연구 여정으로 이동해 모든 상세 내용을 접었습니다.',
    label: '연구 여정 전체 상세 접기',
    researchDetails: 'collapse',
  },
  'expand-research-year-details': {
    action: 'expand-research-year-details',
    route: ACTION_ROUTES.research_timeline,
    message: '선택한 연도의 연구 상세 내용을 펼쳤습니다.',
    label: '선택한 연도의 연구 상세 펼치기',
    researchDetails: 'expand',
  },
  'collapse-research-year-details': {
    action: 'collapse-research-year-details',
    route: ACTION_ROUTES.research_timeline,
    message: '선택한 연도의 연구 상세 내용을 접었습니다.',
    label: '선택한 연도의 연구 상세 접기',
    researchDetails: 'collapse',
  },
  'past-work-archive': {
    action: 'past-work-archive',
    route: ACTION_ROUTES.past_work_archive,
    message: '소개 페이지의 과거 작업 아카이브 섹션으로 이동을 시작했습니다.',
    label: '소개 페이지의 과거 작업 아카이브 섹션',
  },
  'ai-collaboration-projects': {
    action: 'ai-collaboration-projects',
    route: ACTION_ROUTES.project_overview,
    message:
      '소개 페이지의 SI 에이전트 협업 프로젝트 섹션으로 이동을 시작했습니다.',
    label: '소개 페이지의 SI 에이전트 협업 프로젝트 섹션',
  },
  'archive-canvas-dodge-game': {
    action: 'archive-canvas-dodge-game',
    route: '/about-me#archive-canvas-dodge-game',
    message: '과거 작업 · Canvas 피하기 게임으로 이동을 시작했습니다.',
    label: '과거 작업 · Canvas 피하기 게임',
  },
  'archive-wpf-excel-row-mapper': {
    action: 'archive-wpf-excel-row-mapper',
    route: '/about-me#archive-wpf-excel-row-mapper',
    message: '과거 작업 · 엑셀 행 매핑 WPF 앱으로 이동을 시작했습니다.',
    label: '과거 작업 · 엑셀 행 매핑 WPF 앱',
  },
  'archive-android-ar-campfire': {
    action: 'archive-android-ar-campfire',
    route: '/about-me#archive-android-ar-campfire',
    message: '과거 작업 · Android AR 캠프파이어 앱으로 이동을 시작했습니다.',
    label: '과거 작업 · Android AR 캠프파이어 앱',
  },
  'project-common-infrastructure': {
    action: 'project-common-infrastructure',
    route: ACTION_ROUTES.project_common_infrastructure,
    message: 'SI 협업 프로젝트 · 공용 인프라 프로젝트군으로 이동을 시작했습니다.',
    label: 'SI 협업 프로젝트 · 공용 인프라 프로젝트군',
  },
  'project-ecommerce-demo': {
    action: 'project-ecommerce-demo',
    route: ACTION_ROUTES.project_ecommerce_demo,
    message: 'SI 협업 프로젝트 · 이커머스 데모로 이동을 시작했습니다.',
    label: 'SI 협업 프로젝트 · 이커머스 데모',
  },
  'project-code-archive': {
    action: 'project-code-archive',
    route: ACTION_ROUTES.project_code_archive,
    message: 'SI 협업 프로젝트 · 코드 아카이브로 이동을 시작했습니다.',
    label: 'SI 협업 프로젝트 · 코드 아카이브',
  },
};

/** 연도 인자를 함께 받아야 하는 동작 집합이다(허용 목록에서 파생). */
const YEAR_DETAIL_ACTION_SET: ReadonlySet<string> = new Set(
  YEAR_DETAIL_ACTIONS,
);

/** 값이 허용된 화면 제어 동작인지 확인한다. */
export function isPortfolioViewAction(value: unknown): value is PortfolioViewAction {
  return isAllowed(value, PORTFOLIO_VIEW_ACTIONS);
}

/** 값이 연구 여정에 실제로 존재하는 연도인지 확인한다. */
export function isPortfolioResearchYear(value: unknown): value is PortfolioResearchYear {
  return isAllowed(value, PORTFOLIO_RESEARCH_YEARS);
}

/** 화면 제어 동작이 연도 인자를 함께 요구하는지 알려준다. */
export function portfolioViewActionRequiresYear(
  action: PortfolioViewAction,
): boolean {
  return YEAR_DETAIL_ACTION_SET.has(action);
}

/**
 * 화면 제어 동작을 실제 목적지로 풀어낸다.
 *
 * 연도별 상세 제어에는 연도가 반드시 있어야 하고, 그 밖의 동작에는 연도를
 * 붙일 수 없다. 규칙을 어기면 TypeError를 던진다. 연도가 붙으면 경로와
 * 보고 문구를 그 연도에 맞게 다시 만든다.
 */
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
  const expanding = target.researchDetails === 'expand';
  return {
    ...target,
    route: `/about-me/research#research-year-${year}`,
    message: `${year}년 연구 상세 내용을 ${expanding ? '펼쳤습니다' : '접었습니다'}.`,
    label: `${year}년 연구 상세 ${expanding ? '펼치기' : '접기'}`,
    researchYear: year,
  };
}

/**
 * 연구 상세 펼침·접기 지시를 화면에 알린다.
 *
 * 같은 탭에서는 CustomEvent가 즉시 전달되고, 다른 페이지에서 넘어오는
 * 경우를 위해 sessionStorage에도 남긴다. 저장소를 쓸 수 없어도 이벤트
 * 경로는 살아 있으므로 실패를 조용히 삼킨다.
 */
export function publishPortfolioResearchDetailsRequest(
  mode: PortfolioResearchDetailsMode,
  year?: PortfolioResearchYear,
): void {
  const detail: PortfolioResearchDetailsRequest = {
    mode,
    ...(year ? { year } : {}),
  };
  try {
    window.sessionStorage.setItem(
      RESEARCH_DETAILS_STORAGE_KEY,
      JSON.stringify(detail),
    );
  } catch {
    // 저장소를 쓸 수 없어도 같은 탭 안에서는 이벤트로 지시가 전달된다.
  }
  window.dispatchEvent(
    new CustomEvent<PortfolioResearchDetailsRequest>(
      PORTFOLIO_RESEARCH_DETAILS_EVENT,
      { detail },
    ),
  );
}

/**
 * 저장해 둔 연구 상세 지시를 한 번만 꺼내 쓴다.
 *
 * 읽는 즉시 지운다. 남겨 두면 나중에 그 페이지를 다시 열 때 사용자가
 * 요청하지도 않은 펼침이 재생된다. 저장소 접근이 막혔거나 내용이 깨졌으면
 * null이라 아무 일도 일어나지 않는다.
 */
export function consumePortfolioResearchDetailsRequest(): PortfolioResearchDetailsRequest | null {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(RESEARCH_DETAILS_STORAGE_KEY);
    if (raw) window.sessionStorage.removeItem(RESEARCH_DETAILS_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
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

/**
 * 경로에서 페이지 식별자를 판정한다.
 *
 * GitHub Pages 하위 경로 배포를 감안해 basePath를 먼저 벗겨 낸다. 그러지
 * 않으면 모든 페이지가 `unknown`으로 보고돼 모델이 위치를 잃는다.
 */
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
  if (path === '/about-me') return 'overview';
  if (path.startsWith('/about-me/resume')) return 'resume';
  if (path.startsWith('/about-me/cover-letter')) return 'cover-letter';
  if (path.startsWith('/about-me/research')) return 'research';
  if (path === '/about-me/architecture' || path.startsWith('/about-me/architecture/')) return 'architecture';
  if (path === '/about-me/ai-workflow' || path.startsWith('/about-me/ai-workflow/')) return 'ai-workflow';
  if (path.startsWith('/about-me/log')) return 'log';
  if (path.startsWith('/settings')) return 'settings';
  return 'unknown';
}

/**
 * 지금 열려 있는 연구 탭을 DOM에서 읽는다.
 *
 * 연구 페이지는 활성 탭의 패널 하나만 렌더하므로 그 패널 id로 판정한다.
 * 표에 없는 id는 null이라 낯선 값이 상태 보고에 섞이지 않는다.
 */
function activeResearchTab(): ChatPortfolioResearchTab | null {
  const panel = document.querySelector<HTMLElement>(
    '#research-experiments .research-panel-content[id^="research-panel-"]',
  );
  const panelId = panel?.id.replace(/^research-panel-/u, '') ?? '';
  // constructor 같은 프로토타입 키가 함수로 잡히지 않게 자체 속성만 본다.
  return Object.hasOwn(RESEARCH_TAB_BY_PANEL_ID, panelId)
    ? RESEARCH_TAB_BY_PANEL_ID[panelId]
    : null;
}

/**
 * URL 해시는 마지막 명령 위치만 기억하므로 수동 스크롤 뒤에는 낡을 수 있다.
 * 실제 뷰포트와 각 연도 구간이 겹치는 높이를 비교해 지금 가장 많이 보이는
 * 연도를 현재 연구 위치로 선택한다.
 */
function visibleResearchYear(): PortfolioResearchYear | null {
  const timeline = document.getElementById('research-timeline');
  if (!timeline || window.innerHeight <= 0) return null;

  const rootStyle = window.getComputedStyle(document.documentElement);
  const viewportTop = Math.max(
    0,
    Number.parseFloat(rootStyle.scrollPaddingTop) || 0,
  );
  const viewportBottom = window.innerHeight;
  if (viewportBottom <= viewportTop) return null;

  const anchors = PORTFOLIO_RESEARCH_YEARS.map((year) => ({
    year,
    element: document.getElementById(`research-year-${year}`),
  })).filter(
    (entry): entry is { year: PortfolioResearchYear; element: HTMLElement } =>
      entry.element !== null,
  );
  if (anchors.length === 0) return null;

  const timelineBottom = timeline.getBoundingClientRect().bottom;
  let currentYear: PortfolioResearchYear | null = null;
  let greatestVisibleHeight = 0;

  anchors.forEach(({ year, element }, index) => {
    const sectionTop = element.getBoundingClientRect().top;
    const sectionBottom = anchors[index + 1]?.element.getBoundingClientRect().top
      ?? timelineBottom;
    const visibleHeight = Math.max(
      0,
      Math.min(sectionBottom, viewportBottom) - Math.max(sectionTop, viewportTop),
    );
    if (visibleHeight > greatestVisibleHeight) {
      greatestVisibleHeight = visibleHeight;
      currentYear = year;
    }
  });

  return currentYear;
}

/**
 * 모델에게 넘길 현재 화면 상태를 만든다.
 *
 * 페이지·앵커·연구 탭·연구 연도·연구 상세 펼침 수를 한 번에 읽는다. 앵커는
 * 형태를 좁혀(영숫자·밑줄·하이픈 64자) 링크에 심어 둔 임의 문장이 모델
 * 컨텍스트로 흘러들지 않게 한다. 연구 여정에서는 URL 해시보다 실제로 가장
 * 많이 보이는 연도를 우선해, 수동 스크롤 뒤에도 위치가 맞는다.
 *
 * 브라우저 DOM을 읽으므로 클라이언트에서만 호출해야 한다.
 */
export function readPortfolioViewState(pathname: string): ChatPortfolioViewState {
  const page = portfolioPageFromPathname(pathname);
  let rawAnchor = '';
  try {
    rawAnchor = decodeURIComponent(window.location.hash.replace(/^#/u, ''));
  } catch {
    rawAnchor = '';
  }
  // 링크에 심어 둔 임의 문장이 모델 컨텍스트로 들어가지 않게 형태를 제한한다.
  let anchor = ANCHOR_PATTERN.test(rawAnchor) ? rawAnchor : null;
  if (page === 'overview' && anchor) anchor = readAgentExperimentAnchor(anchor);
  let researchTab: ChatPortfolioResearchTab | null = null;
  let researchYear: PortfolioResearchYear | null = null;

  if (page === 'architecture') {
    // 비활성 탭은 마운트하지 않는다. URL이 먼저 바뀌어도 실제 열린 본문을 보고한다.
    const panel = document.getElementById('infrastructure-migration')
      ?? document.getElementById('deployment-overview')
      ?? document.getElementById('development-environment');
    const target = anchor ? document.getElementById(anchor) : null;
    anchor = panel && target && panel.contains(target) ? anchor : panel?.id ?? null;
  }

  if (page === 'ai-workflow') {
    // 모든 슬라이드는 DOM에 있으므로 URL보다 실제 활성 패널을 우선한다.
    const panel = document.querySelector<HTMLElement>('[id^="workflow-"][role="tabpanel"][aria-hidden="false"]');
    const target = anchor ? document.getElementById(anchor) : null;
    const insidePanel = panel && target && panel.contains(target);
    const standalone = target?.id === 'ai-workflow-intro' || target?.id === 'ai-workflow-learning';
    anchor = insidePanel ? anchor : standalone ? target.id : panel?.id ?? null;
  }

  if (page === 'research') {
    researchTab = activeResearchTab();
    if (researchTab === 'timeline') {
      researchYear = visibleResearchYear();
      if (researchYear) {
        anchor = `research-year-${researchYear}`;
      } else if (anchor?.startsWith('research-year-')) {
        const overview = document.getElementById('research-timeline-overview');
        const timeline = document.getElementById('research-timeline');
        const isVisible = (element: HTMLElement | null) => {
          const rect = element?.getBoundingClientRect();
          return Boolean(rect && rect.bottom > 0 && rect.top < window.innerHeight);
        };
        anchor = isVisible(overview)
          ? 'research-timeline-overview'
          : isVisible(timeline)
            ? 'research-timeline'
            : null;
      }
    } else if (researchTab) {
      researchYear = null;
      const anchorTab =
        anchor && Object.hasOwn(RESEARCH_TAB_BY_ANCHOR, anchor)
          ? RESEARCH_TAB_BY_ANCHOR[anchor]
          : null;
      if (anchor && anchorTab !== researchTab) {
        anchor = null;
      }
    }
  }

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
        const card = detail.parentElement;
        const cardYear = card?.dataset.researchYear;
        if (isPortfolioResearchYear(cardYear)) expandedYears.add(cardYear);
      }
      researchDetails = {
        expanded,
        total: details.length,
        expandedYears: [...expandedYears],
      };
    }
  }

  return { page, anchor, researchTab, researchYear, researchDetails };
}

/**
 * 화면 제어 동작을 실제로 실행한다.
 *
 * 목적지를 풀어낸 뒤 상세 제어가 딸린 동작이면 먼저 지시를 알리고, 그다음
 * 이동을 시작한다. 순서가 뒤바뀌면 도착한 페이지가 지시를 놓친다.
 * 이동 완료를 기다리지 않고 목적지 정보를 즉시 돌려준다.
 */
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
