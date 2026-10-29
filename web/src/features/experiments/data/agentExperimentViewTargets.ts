import { AGENT_EXPERIMENT_CATEGORY_ANCHORS, AGENT_EXPERIMENT_INTRO_ANCHOR } from './agentExperimentNavigation.ts';

/** 공개 이동 계약만 담는 경량 목록이다. 원문/미디어 목록과의 일치는 테스트가 확인한다. */
export const PUBLIC_AGENT_EXPERIMENT_TARGETS = [
  { id: 'svg-illustrations', title: 'SVG 일러스트 제작', category: 'SVG 제작' },
  { id: 'claude-pelican-svg-animation', title: '자전거 타는 펠리컨 애니메이션', category: 'SVG 제작' },
  { id: 'exploded-atlas', title: '분해도 도감', category: 'WebGL' },
  { id: 'iced-latte', title: '얼음 동동 라떼', category: 'WebGL' },
  { id: 'dot-board', title: '전광판 시뮬레이터', category: 'WebGL' },
  { id: 'planet-defense', title: 'Planet Defense', category: '2D 게임 실험' },
  { id: 'aqua-guardian', title: '물고기 키우기', category: '2D 게임 실험' },
  { id: 'oscillo-rhythm-game', title: 'OSCILLO · 2D 리듬게임', category: '2D 게임 실험' },
  { id: 'flight-simulator-experiment', title: '비행 시뮬레이터', category: '3D 게임 실험' },
  { id: 'siege-warfare', title: '공성전 (Siege Warfare)', category: '3D 게임 실험' },
  { id: 'noeul-circuit', title: '노을서킷 · 3D 레이싱 게임', category: '3D 게임 실험' },
  { id: 'hand-joint-rigging', title: '손 관절 리깅 실험', category: '3D 게임 실험' },
  { id: 'first-person-hand-sword', title: '1인칭 손·검 훈련장', category: '3D 게임 실험' },
  { id: 'frostpass-fantasy-rpg', title: '서리고개 · 1인칭 판타지 RPG', category: '3D 게임 실험' },
  { id: 'modern-warfare-sample', title: '현대전 샘플', category: '3D 게임 실험' },
  { id: 'blender-medieval-weapons', title: '중세 무기', category: 'Blender 3D 에셋 제작' },
  { id: 'blender-food', title: '음식·가전', category: 'Blender 3D 에셋 제작' },
  { id: 'blender-subway', title: '지하철', category: 'Blender 3D 에셋 제작' },
  { id: 'blender-city', title: '도시 거리', category: 'Blender 3D 에셋 제작' },
  { id: 'blender-office', title: '사무실', category: 'Blender 3D 에셋 제작' },
  { id: 'motion-graphics', title: '모션그래픽 · Opus 5.5', category: '영상물' },
  { id: 'motion-graphics-astra', title: '모션그래픽 · GPT-6 Astra', category: '영상물' },
  { id: 'spaceship-simulation', title: '우주선 시뮬레이션', category: '영상물' },
  { id: 'keyboard-exploded-view', title: '키보드 분해도 영상', category: '영상물' },
  { id: 'motion-atlas', title: '모션 도감', category: '영상물' },
  { id: 'comfyui-qwen-wan', title: 'ComfyUI 이미지 → 5초 영상', category: 'ComfyUI 활용' },
  { id: 'comfyui-gpt-image2-wan', title: '행성 탐사 이미지 → 5초 영상', category: 'ComfyUI 활용' },
] as const;

const ITEM_ACTIONS = PUBLIC_AGENT_EXPERIMENT_TARGETS.map(({ id }) => `agent-experiment-${id}` as const);
export const AGENT_EXPERIMENT_VIEW_ACTIONS = [
  'agent-experiments', ...Object.values(AGENT_EXPERIMENT_CATEGORY_ANCHORS), ...ITEM_ACTIONS,
] as const;
export type AgentExperimentViewAction = (typeof AGENT_EXPERIMENT_VIEW_ACTIONS)[number];
export type PublicAgentExperimentTarget = (typeof PUBLIC_AGENT_EXPERIMENT_TARGETS)[number];
export type AgentExperimentCategory = PublicAgentExperimentTarget['category'];

export interface AgentExperimentViewTarget {
  action: AgentExperimentViewAction;
  anchor: string;
  route: string;
  label: string;
  kind: 'intro' | 'category' | 'item';
  category?: AgentExperimentCategory;
  itemId?: PublicAgentExperimentTarget['id'];
}

export const AGENT_EXPERIMENT_VIEW_TARGETS: readonly AgentExperimentViewTarget[] = [
  { action: 'agent-experiments', anchor: AGENT_EXPERIMENT_INTRO_ANCHOR,
    route: `/about-me#${AGENT_EXPERIMENT_INTRO_ANCHOR}`, label: 'SI 활용 실험 소개', kind: 'intro' },
  ...Object.entries(AGENT_EXPERIMENT_CATEGORY_ANCHORS).map(([category, anchor]) => ({
    action: anchor, anchor, route: `/about-me#${anchor}`, label: category, kind: 'category' as const,
    category: category as AgentExperimentCategory,
    itemId: PUBLIC_AGENT_EXPERIMENT_TARGETS.find((item) => item.category === category)!.id,
  })),
  ...PUBLIC_AGENT_EXPERIMENT_TARGETS.map(({ id, title, category }) => ({
    action: `agent-experiment-${id}` as const, anchor: id, route: `/about-me#${id}`,
    label: title, kind: 'item' as const, category, itemId: id,
  })),
];

/** 알 수 없는 ID·숨김 항목·외부 URL은 이동 대상이 아니다. */
export function agentExperimentViewTargetForAnchor(anchor: string): AgentExperimentViewTarget | undefined {
  return AGENT_EXPERIMENT_VIEW_TARGETS.find((target) => target.anchor === anchor);
}
