import type { AgentExperiment } from './agentExperiments';

/** 소개 설명과 대분류 탭은 작품별 앵커와 분리해 이동·강조한다. */
export const AGENT_EXPERIMENT_INTRO_ANCHOR = 'agent-experiments-intro';
export const AGENT_EXPERIMENT_CATEGORY_ANCHORS = {
  'SVG 제작': 'agent-experiments-svg',
  '2D 게임 제작': 'agent-experiments-2d-games',
  '3D 게임 제작': 'agent-experiments-3d-games',
  'Blender 3D 에셋 제작': 'agent-experiments-blender',
  '영상물': 'agent-experiments-videos',
  'ComfyUI 활용': 'agent-experiments-comfyui',
} as const satisfies Record<AgentExperiment['category'], string>;

/** 대분류는 첫 공개 작품을 선택하고, 기존 작품별 직접 링크도 유지한다. */
export function agentExperimentForAnchor(
  experiments: readonly AgentExperiment[],
  anchor: string,
): AgentExperiment | undefined {
  const category = Object.entries(AGENT_EXPERIMENT_CATEGORY_ANCHORS)
    .find(([, value]) => value === anchor)?.[0];
  return experiments.find((item) => !item.hidden
    && (category ? item.category === category : item.id === anchor));
}
