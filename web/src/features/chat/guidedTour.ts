/**
 * 안내 투어의 단계 정의와 저장 키, 상태 타입을 모아 둔 순수 데이터 모듈이다.
 *
 * "무엇을 어떤 순서로 보여 줄지"만 담고, 진행 상태를 바꾸는 로직과 DOM 강조는
 * useGuidedTour가 맡는다. 브라우저 API를 쓰지 않으므로 훅·카드 컴포넌트 어느
 * 쪽에서 불러도 부작용이 없다.
 */
import type { ActionId } from "./types";
import { aiWorkflowStages } from "../../data/aiWorkflow.ts";

/**
 * 투어 정의의 판(version)이다.
 *
 * 단계 구성을 바꿀 때 이 숫자를 올린다. 아래 두 저장 키에 그대로 섞여 들어가므로,
 * 예전 판에서 저장한 진행 상태가 새 단계 목록에 잘못 적용되는 일 없이 버려진다.
 */
export const GUIDED_TOUR_VERSION = 7;
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
  | "si-terminology-notice"
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
    | "si-terminology"
    | "projects"
    | "agent-experiments"
    | "experiments-svg"
    | "experiments-2d-games"
    | "experiments-3d-games"
    | "experiments-blender"
    | "experiments-videos"
    | "experiments-comfyui"
    | "resume"
    | "cover-letter"
    | "cover-letter-story"
    | "cover-letter-career-turning-point"
    | "research-timeline"
    | "research-year-2011"
    | "research-year-2022"
    | "research-year-2023"
    | "research-year-2024"
    | "research-year-2025"
    | "research-year-2026"
    | "research-optimization"
    | "research-cpu"
    | "research-memory"
    | "research-serialization"
    | "research-tools"
    | "si-levels"
    | `si-level-${(typeof aiWorkflowStages)[number]["id"]}`
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

/** 본문과 같은 단계 데이터를 사용하고, 각 단계를 프런트 이동 액션에 연결한다. */
const SI_STAGE_ACTIONS = {
  chat: "si_level_chat",
  "read-only": "si_level_read_only",
  implementation: "si_level_implementation",
  tools: "si_level_tools",
  orchestration: "si_level_orchestration",
} as const satisfies Record<(typeof aiWorkflowStages)[number]["id"], ActionId>;

/**
 * 방문자를 데려갈 단계 목록이다. 배열 순서가 곧 진행 순서다.
 *
 * 소개에서 시작해 이력서·자기소개서·연구 경험·SI 활용 단계를 거쳐 기록으로 끝나는 흐름이며,
 * 질문 체험은 자기소개서 단계 하나에만 걸어 투어가 중간에 막히는 지점을 최소화했다.
 * 단계를 더하거나 순서를 바꾸면 GUIDED_TOUR_VERSION도 함께 올려야 저장된
 * stepIndex가 엉뚱한 단계를 가리키지 않는다.
 */
export const GUIDED_TOUR_STEPS: readonly GuidedTourStep[] = [
  {
    id: "overview",
    title: "소개 페이지",
    message:
      "포트폴리오의 전체 구성을 먼저 살펴볼게요. 소개, 이력서, 자기소개서, 연구 경험, SI 활용 단계와 기록을 순서대로 둘러봅니다.",
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
    id: "si-terminology",
    title: "SI 표기 안내",
    message: "이 사이트에서 SI라는 표현을 사용하는 배경입니다. 개인적인 사용 경험과 앞으로의 기대를 담은 안내를 읽어 보세요.",
    actionId: "si_terminology",
    targetId: "si-terminology-notice",
    highlightDurationMs: 1_800,
  },
  {
    id: "projects",
    title: "AI 에이전트들과 협업한 프로젝트",
    message:
      "요구사항과 운영 조건에 맞춰 구조를 선택하고, AI 에이전트의 구현 결과를 직접 리뷰하고 검증하며 진행한 공개 프로젝트를 살펴봅니다.",
    actionId: "project_overview",
  },
  {
    id: "agent-experiments",
    title: "AI 에이전트 성능·활용 실험",
    message:
      "AI 활용과 모델 성능을 취미로 실험하며 얻은 결과를 모은 공간입니다. 먼저 실험의 목적과 작업 방식을 읽고, 다음 단계부터 여섯 대분류를 차례로 살펴볼게요.",
    actionId: "agent_experiments",
  },
  {
    id: "experiments-svg",
    title: "AI 실험 · SVG 제작",
    message: "SVG 일러스트와 자전거 타는 펠리컨 애니메이션을 살펴보세요. 같은 프롬프트로 얻은 모델별 결과도 비교할 수 있어요.",
    actionId: "agent_experiments_svg",
  },
  {
    id: "experiments-2d-games",
    title: "AI 활용 · 2D 게임 실험",
    message: "Planet Defense와 물고기 키우기 등 2D 게임 작업물입니다. 코드·이미지·음악에 활용한 모델과 결과를 확인해 보세요.",
    actionId: "agent_experiments_2d_games",
  },
  {
    id: "experiments-3d-games",
    title: "AI 활용 · 3D 게임 실험",
    message: "비행 시뮬레이터와 공성전처럼 공간과 물리 동작을 다룬 3D 게임 작업물입니다. 캡처를 보거나 연결된 게임을 직접 실행해 볼 수 있어요.",
    actionId: "agent_experiments_3d_games",
  },
  {
    id: "experiments-blender",
    title: "AI 실험 · Blender",
    message: "무기·음식과 가전·지하철·도시·사무실 모델링을 모았습니다. 제작 모델과 렌더 이미지를 확인하고, 사무실의 참고 이미지와 구현 결과도 비교해 보세요.",
    actionId: "agent_experiments_blender",
  },
  {
    id: "experiments-videos",
    title: "AI 실험 · 영상물",
    message: "모션그래픽, 우주선 시뮬레이션, 키보드 분해도와 모션 도감입니다. 관심 있는 작업을 선택해 재생하고 제작 모델을 확인해 보세요.",
    actionId: "agent_experiments_videos",
  },
  {
    id: "experiments-comfyui",
    title: "AI 실험 · ComfyUI 활용",
    message: "Qwen Image와 GPT Image로 만든 이미지를 Wan I2V 모델로 5초 영상으로 확장한 사례입니다. 원본 이미지와 생성 영상을 함께 살펴보세요.",
    actionId: "agent_experiments_comfyui",
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
    id: "cover-letter-story",
    title: "자기소개서 · 탐구심과 개발 경험",
    message: "학창 시절의 하드웨어 탐구에서 소프트웨어 개발과 성능 최적화로 이어진 경험입니다. 스스로 문제를 정의하고 해결해 온 과정을 살펴보세요.",
    actionId: "cover_letter_story",
  },
  {
    id: "cover-letter-career-turning-point",
    title: "자기소개서 · 경력의 전환점",
    message: "직장생활을 멈췄던 배경, 학습과 실험을 이어가며 정리한 생각, 다시 시작하려는 이유를 차례로 읽어 보세요.",
    actionId: "cover_letter_career_turning_point",
  },
  {
    id: "research-timeline",
    title: "연구 여정",
    message:
      "하드웨어 탐구에서 소프트웨어 최적화와 AI 에이전트 활용으로 이어진 연구 흐름을 먼저 살펴봅니다.",
    actionId: "research_timeline",
  },
  {
    id: "research-year-2011",
    title: "연구 여정 · 학창 시절",
    message: "CPU 오버클럭과 SSD RAID, 그래픽 카드 병렬 구성으로 하드웨어의 성능과 안정성을 직접 측정하던 시기입니다.",
    actionId: "research_year_2011",
  },
  {
    id: "research-year-2022",
    title: "연구 여정 · 2022년",
    message: "VR·AR 콘텐츠 개발을 배우며 C#의 저수준 문법과 비동기 처리, 객체 지향 설계를 실험한 과정을 살펴봅니다.",
    actionId: "research_year_2022",
  },
  {
    id: "research-year-2023",
    title: "연구 여정 · 2023년",
    message: "단위 테스트와 프로파일링, 데이터 지향 설계를 연구하고 C++·언리얼 엔진과 Windows API로 탐구 범위를 넓혔습니다.",
    actionId: "research_year_2023",
  },
  {
    id: "research-year-2024",
    title: "연구 여정 · 2024년",
    message: "WPF·MVVM 업무 도구를 만들고 .NET 메모리 할당, 바이너리 직렬화와 압축을 비교하며 성능을 개선한 기록입니다.",
    actionId: "research_year_2024",
  },
  {
    id: "research-year-2025",
    title: "연구 여정 · 2025년",
    message: "SIMD와 GPU 가속을 학습하고 BenchmarkDotNet으로 성능을 측정했습니다. PDF 이미지 매칭 도구처럼 실제 업무에 쓴 결과물도 확인해 보세요.",
    actionId: "research_year_2025",
  },
  {
    id: "research-year-2026",
    title: "연구 여정 · 2026년부터 현재",
    message: "오픈 웨이트 모델 실행 환경을 구성하고, 장기간 세션과 여러 에이전트의 협업을 실험하는 시기입니다. MCP·플러그인과 리소스·게임 제작으로 활용 범위를 넓히고 있습니다.",
    actionId: "research_year_2026",
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
    id: "si-levels",
    title: "SI 활용 단계 소개",
    message: "채팅부터 여러 에이전트의 협업까지, SI를 활용하는 다섯 단계를 살펴봅니다. 나와 우리 팀·조직은 어느 단계로 작업하는지 생각해 보세요.",
    actionId: "si_levels",
  },
  ...aiWorkflowStages.map((stage) => ({
    id: `si-level-${stage.id}` as const,
    title: `SI 활용 ${stage.number} · ${stage.shortTitle}`,
    message: stage.description,
    actionId: SI_STAGE_ACTIONS[stage.id],
  })),
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
