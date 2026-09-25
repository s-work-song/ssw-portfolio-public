/** 실험 갤러리의 공개 메타데이터. 미확인 제작 정보와 결과는 채우지 않는다. */
export type AgentExperiment = {
  id: string;
  category: '2D 게임 제작' | '3D 게임 제작' | 'Blender 3D 에셋 제작' | 'SVG 제작';
  title: string;
  description: string;
  focus: string[];
  demoUrl?: string;
  demoLabel?: string;
  images?: Array<{ src: string; alt: string; caption: string }>;
  models?: string[];
};

export const agentExperiments: AgentExperiment[] = [
  {
    id: 'svg-illustrations',
    category: 'SVG 제작',
    title: 'SVG 일러스트 제작',
    description: 'SVG 도형과 그라디언트를 조합해 게임패드와 물이 반쯤 담긴 유리잔을 표현한 벡터 일러스트입니다.',
    focus: ['벡터 일러스트', '도형·그라디언트', '해상도 독립'],
    images: [
      {
        src: '/images/agent-experiments/svg/gamepad.svg',
        alt: '아이보리색 본체와 검은색 그립 및 여러 색상의 버튼으로 구성한 입체적인 SVG 게임패드',
        caption: '도형과 그라디언트로 표현한 입체적인 게임패드',
      },
      {
        src: '/images/agent-experiments/svg/half-full-glass.svg',
        alt: '밝은 회색 탁자 위에 물이 절반 높이까지 담긴 투명한 SVG 유리잔',
        caption: '투명도와 반사광을 표현한 반쯤 찬 유리잔',
      },
    ],
  },
  {
    id: 'planet-defense',
    category: '2D 게임 제작',
    title: 'Planet Defense',
    description: 'GPT로 제작한 이미지 리소스를 활용하고, 자동 요격과 액티브 스킬, 웨이브 사이의 방어망 정비를 결합한 행성 방어 게임입니다.',
    focus: ['전투 시스템', '성장·강화', 'GPT 이미지'],
    demoUrl: 'https://ssw-planet-defense.swsongab11572.chatgpt.site/',
    images: [
      {
        src: '/images/agent-experiments/planet-defense-battle.webp',
        alt: '행성 주변의 방어 유닛이 여러 방향에서 접근하는 적을 요격하는 Planet Defense 전투 화면',
        caption: '행성을 둘러싼 방어망이 적을 요격하는 전투',
      },
      {
        src: '/images/agent-experiments/planet-defense-upgrade.webp',
        alt: '세 번째 웨이브를 마친 뒤 방어 병기와 코어 및 액티브 스킬을 선택하는 Planet Defense 화면',
        caption: '웨이브 사이 방어망을 정비하고 강화하는 선택',
      },
    ],
  },
  {
    id: 'aqua-guardian',
    category: '2D 게임 제작',
    title: '물고기 키우기',
    description: 'GPT로 제작한 이미지 리소스를 활용해 물고기 육성과 재화 수집, 침입자 방어를 결합한 수족관 게임입니다. 배경음악은 Gemini를 통해 Lyria 3로 제작했습니다.',
    focus: ['육성·경제', 'GPT 이미지', 'Lyria 3 BGM'],
    demoUrl: 'https://aqua-guardian.swsongab11572.chatgpt.site/',
    images: [
      {
        src: '/images/agent-experiments/fish-raising-tank.webp',
        alt: '두 마리 물고기에게 먹이를 주며 재화를 모으는 물고기 키우기 수조 화면',
        caption: '물고기에게 먹이를 주고 재화를 모으는 수조',
      },
      {
        src: '/images/agent-experiments/fish-raising-market.webp',
        alt: '여러 어종과 먹이 진화 및 방어 능력을 구입할 수 있는 물고기 키우기 생태 상점 화면',
        caption: '어종과 먹이·방어 능력을 관리하는 생태 상점',
      },
    ],
  },
  {
    id: 'project-game-collection-platform',
    category: '2D 게임 제작',
    title: '게임 모음 플랫폼',
    description: '오목·스네이크 같은 2D 브라우저 게임을 한곳에 모으고, 게임 기록과 랭킹 기능을 구성한 웹 플랫폼입니다.',
    focus: ['2D 브라우저 게임', '게임 모음', '기록·랭킹'],
    images: [
      {
        src: '/images/projects/game-collection/ssw-web-games-main.webp',
        alt: '2048·오목·스네이크 게임 카드와 오늘의 게임을 보여주는 게임 모음 플랫폼 메인 화면',
        caption: '여러 브라우저 게임을 한곳에서 탐색하는 메인 화면',
      },
    ],
  },
  {
    id: 'flight-simulator-experiment',
    category: '3D 게임 제작',
    title: '비행 시뮬레이터',
    description: 'Three.js와 WebGL을 이용해 활주로 이륙과 비행 조작, 계기 HUD를 구현한 브라우저 3D 비행 시뮬레이터입니다.',
    focus: ['Three.js', 'WebGL', '3D 비행 조작'],
    demoUrl: 'https://skyward-flight-simulator.swsongab11572.chatgpt.site/',
    images: [
      {
        src: '/images/projects/game-collection/ssw-web-games-flight-simulator.webp',
        alt: '활주로에서 이륙하는 전투기와 비행 계기 HUD가 표시된 비행 시뮬레이터 화면',
        caption: '활주로 이륙과 비행 계기 HUD를 구현한 브라우저 3D 게임',
      },
    ],
  },
  {
    id: 'fps-model-comparison',
    category: '3D 게임 제작',
    title: 'FPS 제작 테스트',
    description: '같은 제작 과제를 모델별로 진행하고, 결과 화면과 구현 내용을 비교할 예정입니다.',
    focus: ['공통 과제', '모델별 결과', '개입 과정'],
    models: ['Opus 5', 'Fable 5.1', 'Astra'],
  },
  {
    id: 'blender-3d-assets',
    category: 'Blender 3D 에셋 제작',
    title: 'Blender 3D 에셋 제작',
    description: 'Blender로 제작한 3D 모델과 리깅·애니메이션 결과를 정리하고 비교할 자리입니다.',
    focus: ['3D 모델링', '리깅·애니메이션', '게임 리소스'],
  },
];
