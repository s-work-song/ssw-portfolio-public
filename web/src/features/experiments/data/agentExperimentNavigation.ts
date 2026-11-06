import type { AgentExperiment } from './agentExperiments';

/** 소개 설명과 대분류 탭은 작품별 앵커와 분리해 이동·강조한다. */
export const AGENT_EXPERIMENT_INTRO_ANCHOR = 'agent-experiments-intro';
/** 분류(하위 탭) 앵커. 대분류에 분류가 하나뿐이면 대분류 탭이 이 앵커를 쓴다. */
export const AGENT_EXPERIMENT_CATEGORY_ANCHORS = {
  'SVG 제작': 'agent-experiments-svg',
  'WebGL': 'agent-experiments-webgl',
  '2D 게임 실험': 'agent-experiments-2d-games',
  '3D 게임 실험': 'agent-experiments-3d-games',
  'Blender 3D 에셋 제작': 'agent-experiments-blender',
  '영상물': 'agent-experiments-videos',
  'ComfyUI 활용': 'agent-experiments-comfyui',
  '앱·도구 실험': 'agent-experiments-apps',
} as const satisfies Record<AgentExperiment['category'], string>;

export type AgentExperimentGroup = {
  label: string;
  /** 하위 탭이 있는 대분류만 별도 앵커를 둔다. 하나뿐이면 그 분류 앵커를 쓴다. */
  anchor: string;
  categories: readonly AgentExperiment['category'][];
};

/** 대분류 탭 순서와 하위 탭 구성. 하위 탭 순서는 categories 순서를 따른다. */
export const AGENT_EXPERIMENT_GROUPS = [
  { label: '2D 실험', anchor: 'agent-experiments-2d', categories: ['SVG 제작', '2D 게임 실험', 'ComfyUI 활용'] },
  { label: '3D 실험', anchor: 'agent-experiments-3d', categories: ['WebGL', '3D 게임 실험', 'Blender 3D 에셋 제작'] },
  { label: '영상물', anchor: AGENT_EXPERIMENT_CATEGORY_ANCHORS['영상물'], categories: ['영상물'] },
  { label: '앱·도구 실험', anchor: AGENT_EXPERIMENT_CATEGORY_ANCHORS['앱·도구 실험'], categories: ['앱·도구 실험'] },
] as const satisfies readonly AgentExperimentGroup[];

/** 하위 탭에 보이는 짧은 이름. */
export const AGENT_EXPERIMENT_CATEGORY_TAB_LABELS: Record<AgentExperiment['category'], string> = {
  'SVG 제작': 'SVG',
  'WebGL': 'WebGL',
  '2D 게임 실험': '2D 게임',
  '3D 게임 실험': '3D 게임',
  'Blender 3D 에셋 제작': 'Blender',
  '영상물': '영상물',
  'ComfyUI 활용': 'ComfyUI',
  '앱·도구 실험': '앱·도구 실험',
};

export function agentExperimentGroupFor(category: AgentExperiment['category']): AgentExperimentGroup {
  return AGENT_EXPERIMENT_GROUPS.find((group) =>
    (group.categories as readonly string[]).includes(category))!;
}

/** 대분류·분류는 첫 공개 작품을 선택하고, 기존 작품별 직접 링크도 유지한다. */
export function agentExperimentForAnchor(
  experiments: readonly AgentExperiment[],
  anchor: string,
): AgentExperiment | undefined {
  const category = Object.entries(AGENT_EXPERIMENT_CATEGORY_ANCHORS)
    .find(([, value]) => value === anchor)?.[0];
  const group = AGENT_EXPERIMENT_GROUPS.find((candidate) => candidate.anchor === anchor);
  const categories: readonly string[] = category ? [category] : group?.categories ?? [];
  const visible = experiments.filter((item) => !item.hidden);
  if (!categories.length) return visible.find((item) => item.id === anchor);
  for (const value of categories) {
    const first = visible.find((item) => item.category === value);
    if (first) return first;
  }
  return undefined;
}
