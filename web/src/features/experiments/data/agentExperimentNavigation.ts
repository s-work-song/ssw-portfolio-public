import type { AgentExperiment } from './agentExperiments';

/** 소개 설명과 대분류 탭은 작품별 앵커와 분리해 이동·강조한다. */
export const AGENT_EXPERIMENT_INTRO_ANCHOR = 'agent-experiments-intro';
/** 분류(하위 탭) 앵커. 대분류에 분류가 하나뿐이면 대분류 탭이 이 앵커를 쓴다. */
export const AGENT_EXPERIMENT_CATEGORY_ANCHORS = {
  'SVG 제작': 'agent-experiments-svg',
  'WebGL': 'agent-experiments-webgl',
  '2D 게임 실험': 'agent-experiments-2d-games',
  '3D 게임 실험': 'agent-experiments-3d-games',
  '리깅': 'agent-experiments-rigging',
  'Blender 3D 에셋 제작': 'agent-experiments-blender',
  '영상물': 'agent-experiments-videos',
  'ComfyUI 활용': 'agent-experiments-comfyui',
  '앱·도구 실험': 'agent-experiments-apps',
  '포템킨 빌리지': 'agent-experiments-potemkin',
} as const satisfies Record<AgentExperiment['category'], string>;

export type AgentExperimentGroup = {
  label: string;
  /** 하위 탭이 있는 대분류만 별도 앵커를 둔다. 하나뿐이면 그 분류 앵커를 쓴다. */
  anchor: string;
  categories: readonly AgentExperiment['category'][];
  /** 대분류를 고르면 작품 목록 위에 보이는 짧은 안내. 항목 하나가 한 문단이고, `**구절**`은 굵게 보인다. */
  description?: readonly string[];
  /** 설명 아래 주의 색 카드로 보이는 글. 항목 하나가 한 문단이다. */
  notice?: { title: string; paragraphs: readonly string[] };
  /** 카드 아래 작은 글씨로 덧붙이는 한 줄. */
  footnote?: string;
  relatedLog?: { slug: string; label: string };
};

/** 대분류 탭 순서와 하위 탭 구성. 하위 탭 순서는 categories 순서를 따른다. 공개 작품이 없는 대분류는 탭을 만들지 않는다. */
export const AGENT_EXPERIMENT_GROUPS: readonly AgentExperimentGroup[] = [
  { label: '2D 실험', anchor: 'agent-experiments-2d', categories: ['SVG 제작', 'ComfyUI 활용'] },
  { label: '3D 실험', anchor: 'agent-experiments-3d', categories: ['WebGL', 'Blender 3D 에셋 제작', '리깅'] },
  { label: '게임', anchor: 'agent-experiments-games', categories: ['2D 게임 실험', '3D 게임 실험'] },
  { label: '영상물', anchor: AGENT_EXPERIMENT_CATEGORY_ANCHORS['영상물'], categories: ['영상물'] },
  { label: '앱·도구 실험', anchor: AGENT_EXPERIMENT_CATEGORY_ANCHORS['앱·도구 실험'], categories: ['앱·도구 실험'] },
  {
    label: '포템킨 빌리지',
    anchor: AGENT_EXPERIMENT_CATEGORY_ANCHORS['포템킨 빌리지'],
    categories: ['포템킨 빌리지'],
    description: [
      '**포템킨 빌리지**는 겉면만 그럴듯하게 꾸민 가짜 마을에서 나온 말로, **겉만 번듯하고 실체는 없는 것**을 가리킵니다.',
    ],
    notice: {
      title: '왜 만들었나',
      paragraphs: [
        '이런 화면의 상당수는 사기이거나 강의를 팔기 위한 홍보입니다. 대개는 관심 없이 지나가지만, 드물게 결정권자의 자리에서 이런 화면을 보고 업무에 적용하려는 경우가 있었습니다.',
        'SI 에이전트 성능이 다양한 분야에서 활용할 수 있을 만큼 좋아진 것은 사실이지만, 여전히 한계가 있고 본질적으로 대체할 수 없는 부분도 있습니다. 운영하면서 생길 트래픽과 API 비용도 무시할 수 없습니다. 그런데 이런 점을 따져 보지 않은 채 상당한 금액을 들여 이런 식의 자동화를 만들어 달라는 의뢰를 받은 적도 있습니다.',
        '에이전트를 활용하면 이런 화면은 이제 누구나 만들 수 있고, 그만큼 속이기도 쉬워졌습니다. 화면만 보고 믿지 않도록 경각심을 갖자는 뜻에서, 그리고 실제로 만들면 어느 정도 공수가 드는지 궁금해서 직접 만들어 봤습니다.',
      ],
    },
    footnote: '등장하는 제품·회사·수치는 모두 가상입니다.',
    relatedLog: { slug: 'do-not-trust-plausible-screens-alone', label: '포템킨 빌리지에 대한 생각' },
  },
];

/** 분류 탭 위에 따로 두는 대표 실험. 갤러리 분류에 넣지 않고 소개 아래 한 장의 카드로 보인다. */
export const AGENT_EXPERIMENT_SHOWCASE = {
  id: 'portfolio-plaza',
  anchor: 'agent-experiments-plaza',
  eyebrow: '대표 실험',
  title: '3D 포트폴리오 광장',
  description: [
    '이 사이트의 내용을 걸어 다니며 둘러보는 3D 공간입니다. 전시관에는 작품과 소개가 걸려 있고, 상영관에서는 실험 영상을, 카페 주크박스에서는 직접 만든 음악을 들을 수 있습니다.',
    '날씨와 계절, 하루의 시간이 바뀝니다. three.js로 SI 에이전트와 함께 만들었습니다.',
  ],
  url: 'https://pf-samples.sworksong.workers.dev/plaza/',
  linkLabel: '광장 둘러보기',
  note: '받는 양이 많은 편이라 와이파이에서 여는 것을 권합니다.',
  images: [
    { src: '/images/agent-experiments/portfolio-plaza/plaza-fountain.webp', alt: '분수 광장 너머로 상영관과 전시관이 보이는 3D 포트폴리오 광장', caption: '분수 광장' },
    { src: '/images/agent-experiments/portfolio-plaza/plaza-yard-path.webp', alt: '길 양옆 울타리 안에 다연장로켓·전차·헬기 모델과 설명판이 늘어선 야외 전시장', caption: '야외 전시장' },
    { src: '/images/agent-experiments/portfolio-plaza/plaza-yard-tank.webp', alt: '울타리 안 받침 위에 놓인 주력전차 모델과 설명판', caption: '야외 전시장 · 주력전차' },
    { src: '/images/agent-experiments/portfolio-plaza/plaza-cafe-window.webp', alt: '통창 너머로 광장이 보이는 카페 안의 긴 의자와 탁자', caption: '주크박스 카페' },
    { src: '/images/agent-experiments/portfolio-plaza/plaza-cafe-counter.webp', alt: '카페 출입문과 커피 머신이 놓인 카운터', caption: '주크박스 카페 · 카운터' },
  ],
};

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
  '포템킨 빌리지': '포템킨 빌리지',
  '리깅': '리깅',
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
