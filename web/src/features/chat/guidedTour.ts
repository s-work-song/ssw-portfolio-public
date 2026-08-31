import type { ActionId } from "./types";

export const GUIDED_TOUR_VERSION = 4;
export const GUIDED_TOUR_VISIT_KEY = `portfolio-guided-tour:v${GUIDED_TOUR_VERSION}:visit`;
export const GUIDED_TOUR_SESSION_KEY = `portfolio-guided-tour:v${GUIDED_TOUR_VERSION}:session`;

export type GuidedTourStatus = "idle" | "active" | "completed";
export type GuidedTourInteraction =
  | "ready"
  | "waiting-for-ai"
  | "answering"
  | "answered";

export type GuidedTourTargetId =
  | "cover-letter-overview-ask-ai"
  | "research-optimization-ask-ai"
  | "log-ai-options-ask-ai"
  | "log-overview";

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

export interface GuidedTourState {
  status: GuidedTourStatus;
  stepIndex: number;
  interaction: GuidedTourInteraction;
}

export const IDLE_GUIDED_TOUR_STATE: GuidedTourState = {
  status: "idle",
  stepIndex: 0,
  interaction: "ready",
};

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

export function guidedTourInteractionForStep(
  step: GuidedTourStep | undefined,
): GuidedTourInteraction {
  return step?.targetId && step.requiresQuestion ? "waiting-for-ai" : "ready";
}

export function currentGuidedTourStep(
  state: GuidedTourState,
): GuidedTourStep | undefined {
  return state.status === "active"
    ? GUIDED_TOUR_STEPS[state.stepIndex]
    : undefined;
}
