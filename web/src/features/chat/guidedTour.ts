/**
 * 안내 투어의 단계 정의와 저장 키, 상태 타입을 모아 둔 순수 데이터 모듈이다.
 *
 * "무엇을 어떤 순서로 보여 줄지"만 담고, 진행 상태를 바꾸는 로직과 DOM 강조는
 * useGuidedTour가 맡는다. 브라우저 API를 쓰지 않으므로 훅·카드 컴포넌트 어느
 * 쪽에서 불러도 부작용이 없다.
 */
import type { ActionId } from "./types";

/**
 * 투어 정의의 판(version)이다.
 *
 * 단계 구성을 바꿀 때 이 숫자를 올린다. 아래 두 저장 키에 그대로 섞여 들어가므로,
 * 예전 판에서 저장한 진행 상태가 새 단계 목록에 잘못 적용되는 일 없이 버려진다.
 */
export const GUIDED_TOUR_VERSION = 4;
/** 투어를 안내한 적이 있는지 기억하는 localStorage 키다. 값은 started·completed·dismissed 중 하나다. */
export const GUIDED_TOUR_VISIT_KEY = `portfolio-guided-tour:v${GUIDED_TOUR_VERSION}:visit`;
/** 진행 중인 투어 상태를 탭 단위로 이어 붙이는 sessionStorage 키다. 페이지 이동으로 훅이 다시 마운트돼도 단계가 유지된다. */
export const GUIDED_TOUR_SESSION_KEY = `portfolio-guided-tour:v${GUIDED_TOUR_VERSION}:session`;

/** 투어 전체의 진행 상태다. `idle`은 아직 시작하지 않았거나 도중에 종료한 상태다. */
export type GuidedTourStatus = "idle" | "active" | "completed";
/**
 * 질문 체험이 걸린 단계에서 지금 어디까지 왔는지 나타낸다.
 *
 * `ready`는 체험 없이 바로 넘어갈 수 있는 단계, `waiting-for-ai`는 방문자가
 * 강조된 버튼을 누르길 기다리는 상태, `answering`은 답변을 받는 중,
 * `answered`는 답변 확인까지 끝난 상태다.
 */
export type GuidedTourInteraction =
  | "ready"
  | "waiting-for-ai"
  | "answering"
  | "answered";

/** 투어가 강조할 수 있는 화면 요소 식별자다. DOM의 `data-guided-tour-target` 속성 값과 1:1로 대응한다. */
export type GuidedTourTargetId =
  | "cover-letter-overview-ask-ai"
  | "research-optimization-ask-ai"
  | "log-ai-options-ask-ai"
  | "log-overview";

/**
 * 투어 한 단계의 정의다.
 *
 * actionId는 그 단계에서 이동할 콘텐츠 위치이고, targetId가 있으면 도착한
 * 화면에서 그 요소를 강조한다. requiresQuestion이 true인 단계는 방문자가 직접
 * 버튼을 눌러 답변을 받아야 진행이 풀리고, targetId만 있는 단계는 강조만 하고
 * 진행을 막지 않는다. highlightDurationMs를 주면 그 시간이 지난 뒤 강조를
 * 스스로 거둔다.
 */
export interface GuidedTourStep {
  id:
    | "overview"
    | "past-work"
    | "projects"
    | "resume"
    | "cover-letter"
    | "research-timeline"
    | "research-optimization"
    | "research-cpu"
    | "research-memory"
    | "research-serialization"
    | "research-tools"
    | "log";
  title: string;
  message: string;
  actionId: ActionId;
  targetId?: GuidedTourTargetId;
  requiresQuestion?: boolean;
  highlightDurationMs?: number;
}

/** 투어 진행 상태 한 벌이다. 이 모양 그대로 sessionStorage에 직렬화된다. */
export interface GuidedTourState {
  status: GuidedTourStatus;
  stepIndex: number;
  interaction: GuidedTourInteraction;
}

/** 투어를 시작하지 않은 초기 상태다. 방문자가 투어를 중단할 때도 이 값으로 되돌린다. */
export const IDLE_GUIDED_TOUR_STATE: GuidedTourState = {
  status: "idle",
  stepIndex: 0,
  interaction: "ready",
};

/**
 * 방문자를 데려갈 단계 목록이다. 배열 순서가 곧 진행 순서다.
 *
 * 소개에서 시작해 이력서·자기소개서·연구 경험을 거쳐 기록으로 끝나는 흐름이며,
 * 질문 체험은 자기소개서 단계 하나에만 걸어 투어가 중간에 막히는 지점을 최소화했다.
 * 단계를 더하거나 순서를 바꾸면 GUIDED_TOUR_VERSION도 함께 올려야 저장된
 * stepIndex가 엉뚱한 단계를 가리키지 않는다.
 */
export const GUIDED_TOUR_STEPS: readonly GuidedTourStep[] = [
  {
    id: "overview",
    title: "소개 페이지",
    message:
      "포트폴리오의 전체 구성을 먼저 살펴볼게요. 소개, 이력서, 자기소개서, 연구 경험과 기록을 순서대로 둘러봅니다.",
    actionId: "overview",
  },
  {
    id: "past-work",
    title: "과거 작업 아카이브",
    message:
      "에이전틱 코딩을 본격적으로 활용하기 전에 직접 손으로 만들고 사용했던 작업과 실험을 살펴봅니다.",
    actionId: "past_work_archive",
  },
  {
    id: "projects",
    title: "AI 에이전트들과 협업한 프로젝트",
    message:
      "요구사항과 운영 조건에 맞춰 구조를 선택하고, AI 에이전트의 구현 결과를 직접 리뷰하고 검증하며 진행한 공개 프로젝트를 살펴봅니다.",
    actionId: "project_overview",
  },
  {
    id: "resume",
    title: "이력서",
    message:
      "실무 경력, 맡았던 역할과 주력 기술은 이력서에서 확인할 수 있어요. 세부 경력보다 먼저 전체 흐름을 훑어봅니다.",
    actionId: "resume",
  },
  {
    id: "cover-letter",
    title: "자기소개서와 AI 질문",
    message:
      "자기소개서 상단 소개 카드의 ‘AI에게 물어보기’를 눌러 개발 철학과 경험의 흐름을 챗봇으로 확인해 보세요.",
    actionId: "cover_letter",
    targetId: "cover-letter-overview-ask-ai",
    requiresQuestion: true,
  },
  {
    id: "research-timeline",
    title: "연구 여정",
    message:
      "하드웨어 탐구에서 소프트웨어 최적화와 AI 에이전트 활용으로 이어진 연구 흐름을 먼저 살펴봅니다.",
    actionId: "research_timeline",
  },
  {
    id: "research-optimization",
    title: "성능 최적화 · 개요",
    message:
      "성능 최적화 연구를 개요, CPU·SIMD, 메모리·파일 I/O, 직렬화·전송의 네 단계로 나눈 전체 구성을 확인합니다.",
    actionId: "research_optimization",
    targetId: "research-optimization-ask-ai",
  },
  {
    id: "research-cpu",
    title: "성능 최적화 · CPU와 SIMD",
    message:
      "분기 예측, 브랜치리스 처리와 AVX2 SIMD 벡터화 실험을 정리한 영역입니다.",
    actionId: "research_cpu",
  },
  {
    id: "research-memory",
    title: "성능 최적화 · 메모리와 파일 I/O",
    message:
      "데이터 배치와 캐시 효율, 메모리 매핑 파일과 스트림 I/O를 비교한 실험을 살펴봅니다.",
    actionId: "research_memory",
  },
  {
    id: "research-serialization",
    title: "성능 최적화 · 직렬화와 전송",
    message:
      "직렬화 방식과 데이터 압축·패킹에 따른 처리 비용과 전송 크기를 비교한 영역입니다.",
    actionId: "research_serialization",
  },
  {
    id: "research-tools",
    title: "도구와 AI 접목",
    message:
      "업무용 도구 제작과 AI 모델·에이전트 오케스트레이션을 실제 작업에 접목한 경험을 확인합니다.",
    actionId: "research_tools",
  },
  {
    id: "log",
    title: "기록",
    message:
      "개인적인 생각과 회고, 기술적 성찰을 모은 기록 목록입니다. 검색과 태그를 이용해 관심 있는 주제를 이어서 살펴볼 수 있어요.",
    actionId: "log",
    targetId: "log-overview",
    highlightDurationMs: 1_800,
  },
] as const;

/**
 * 어떤 단계에 들어갈 때 시작할 interaction 값을 고른다.
 *
 * 강조 대상이 있으면서 질문 체험까지 요구하는 단계만 `waiting-for-ai`로 시작해
 * "다음" 버튼을 잠그고, 나머지는 모두 곧바로 넘어갈 수 있는 `ready`다.
 * step이 undefined여도 안전하게 `ready`를 돌려주므로 범위를 벗어난 인덱스로
 * 불러도 예외가 나지 않는다.
 */
export function guidedTourInteractionForStep(
  step: GuidedTourStep | undefined,
): GuidedTourInteraction {
  return step?.targetId && step.requiresQuestion ? "waiting-for-ai" : "ready";
}

/**
 * 현재 상태가 가리키는 단계를 돌려준다.
 *
 * 진행 중(`active`)이 아니면 undefined다. stepIndex가 목록 범위를 벗어난
 * 경우에도 undefined가 나오므로 호출부에서 따로 범위를 검사하지 않는다.
 */
export function currentGuidedTourStep(
  state: GuidedTourState,
): GuidedTourStep | undefined {
  return state.status === "active"
    ? GUIDED_TOUR_STEPS[state.stepIndex]
    : undefined;
}
