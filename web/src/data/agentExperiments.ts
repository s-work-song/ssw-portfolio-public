export type AgentExperimentVideo = { src: string; poster?: string; caption?: string };
export type AgentExperimentImage = { src: string; alt: string; caption: string };
export type AgentExperimentModelCredit = {
  purpose?: '코드' | '2D 에셋' | '배경음악' | '워크플로우와 프롬프트' | '프롬프트' | '이미지' | '영상' | '위 영상' | '아래 영상' | 'Blender 모델링' | '가전' | '음식 · 도넛' | '음식 · 와플' | '음식 · 마카롱' | 'Claude' | 'GPT' | 'Grok' | 'Gemini';
  models: string[];
  via?: string;
};

/** 실험 갤러리의 공개 메타데이터. 미확인 제작 정보와 결과는 채우지 않는다. */
export type AgentExperiment = {
  id: string;
  category: '2D 게임 제작' | '3D 게임 제작' | 'Blender 3D 에셋 제작' | 'SVG 제작' | '영상물' | 'ComfyUI 활용';
  title: string;
  description: string;
  focus: string[];
  /** 데이터와 구현을 보존하면서 갤러리 노출만 숨긴다. */
  hidden?: boolean;
  demoUrl?: string;
  demoLabel?: string;
  images?: AgentExperimentImage[];
  /** 참고 이미지와 구현 결과처럼 제작 단계가 다른 이미지를 별도 블록으로 표시한다. */
  imageGroups?: Array<{
    title: string;
    description?: string;
    modelCredits: AgentExperimentModelCredit[];
    images: AgentExperimentImage[];
  }>;
  /** 이미지 슬라이더와 설명 사이에서 독립적으로 재생할 BGM. */
  audio?: { src: string; title: string; model: string; via?: string; caption: string };
  /** 모델별 애니메이션을 동시에 비교한다. 파일이 없는 칸은 준비 중으로 표시한다. */
  animationGroups?: Array<{
    label: 'Claude' | 'GPT' | 'Grok·Gemini';
    items: Array<{ model: string | null; image?: { src: string; alt: string } }>;
  }>;
  /** 공개 폴더에 실제 파일이 있는 다운로드만 등록한다. */
  downloads?: Array<{ src: string; label: string }>;
  /** 공개 폴더에 실제 파일이 있는 영상만 등록한다. */
  video?: AgentExperimentVideo;
  /** 같은 작업의 모델별 영상을 등록 순서대로 한 열에 표시한다. */
  videos?: Array<{ label: string; model: string; video: AgentExperimentVideo }>;
  /** 실제 제작에 사용한 모델. 비교 화면용 models와 구분한다. */
  modelCredits?: AgentExperimentModelCredit[];
  models?: string[];
};

export const agentExperiments: AgentExperiment[] = [
  {
    id: 'svg-illustrations',
    category: 'SVG 제작',
    title: 'SVG 일러스트 제작',
    description: 'SVG 도형과 그라디언트를 조합해 게임패드와 물이 반쯤 담긴 유리잔을 표현한 벡터 일러스트입니다.',
    focus: ['벡터 일러스트', '도형·그라디언트', '해상도 독립'],
    modelCredits: [{ models: ['GPT-6 Astra'] }],
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
    id: 'claude-pelican-svg-animation',
    category: 'SVG 제작',
    title: '자전거 타는 펠리컨 애니메이션',
    description: 'Claude 3종과 GPT-6 3종, Grok 4.7, Gemini 3.8 Flash에 동일한 프롬프트를 각각 단 한 번 입력해 얻은 펠리컨 SVG 애니메이션 결과를 비교합니다.',
    focus: ['SVG 애니메이션', '모델별 비교', '펠리컨'],
    modelCredits: [
      { purpose: 'Claude', models: ['Fable 5.1', 'Opus 5.5', 'Sonnet 5.5'] },
      { purpose: 'GPT', models: ['GPT-6 Astra', 'GPT-6 Sol', 'GPT-6 Luna'] },
      { purpose: 'Grok', models: ['Grok 4.7'] },
      { purpose: 'Gemini', models: ['Gemini 3.8 Flash'] },
    ],
    animationGroups: [
      {
        label: 'Claude',
        items: [
          { model: 'Fable 5.1', image: { src: '/images/agent-experiments/svg/pelican/01-fable-5-1.svg', alt: 'Fable 5.1로 제작한 자전거 타는 펠리컨 SVG 애니메이션' } },
          { model: 'Opus 5.5', image: { src: '/images/agent-experiments/svg/pelican/02-opus-5-5.svg', alt: 'Opus 5.5로 제작한 자전거 타는 펠리컨 SVG 애니메이션' } },
          { model: 'Sonnet 5.5', image: { src: '/images/agent-experiments/svg/pelican/03-sonnet-5-5.svg', alt: 'Sonnet 5.5로 제작한 자전거 타는 펠리컨 SVG 애니메이션' } },
        ],
      },
      {
        label: 'GPT',
        items: [
          { model: 'GPT-6 Astra', image: { src: '/images/agent-experiments/svg/pelican/05-gpt-6-astra.svg', alt: 'GPT-6 Astra로 제작한 자전거 타는 펠리컨 SVG 애니메이션' } },
          { model: 'GPT-6 Sol', image: { src: '/images/agent-experiments/svg/pelican/06-gpt-6-sol.svg', alt: 'GPT-6 Sol로 제작한 자전거 타는 펠리컨 SVG 애니메이션' } },
          { model: 'GPT-6 Luna', image: { src: '/images/agent-experiments/svg/pelican/04-gpt-6-luna.svg', alt: 'GPT-6 Luna로 제작한 자전거 타는 펠리컨 SVG 애니메이션' } },
        ],
      },
      {
        label: 'Grok·Gemini',
        items: [
          { model: 'Grok 4.7', image: { src: '/images/agent-experiments/svg/pelican/08-grok-4-7.svg', alt: 'Grok 4.7로 제작한 자전거 타는 펠리컨 SVG 애니메이션' } },
          { model: 'Gemini 3.8 Flash', image: { src: '/images/agent-experiments/svg/pelican/07-gemini-3-8-flash.svg', alt: 'Gemini 3.8 Flash로 제작한 자전거 타는 펠리컨 SVG 애니메이션' } },
          { model: null },
        ],
      },
    ],
  },
  {
    id: 'planet-defense',
    category: '2D 게임 제작',
    title: 'Planet Defense',
    description: 'GPT로 제작한 이미지 리소스를 활용하고, 자동 요격과 액티브 스킬, 웨이브 사이의 방어망 정비를 결합한 행성 방어 게임입니다.',
    focus: ['전투 시스템', '성장·강화', 'GPT 이미지'],
    modelCredits: [
      { purpose: '코드', models: ['GPT-5.6 Sol'] },
      { purpose: '2D 에셋', models: ['GPT Image 2'] },
    ],
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
    modelCredits: [
      { purpose: '코드', models: ['GPT-5.6 Sol'] },
      { purpose: '2D 에셋', models: ['GPT Image 2'] },
      { purpose: '배경음악', models: ['Lyria 3'], via: 'Gemini' },
    ],
    demoUrl: 'https://aqua-guardian.swsongab11572.chatgpt.site/',
    audio: {
      src: '/media/agent-experiments/aqua-guardian/the-saltwater-hour.mp3',
      title: 'The Saltwater Hour',
      model: 'Lyria 3',
      via: 'Gemini',
      caption: '물고기 키우기에 사용한 배경음악',
    },
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
    modelCredits: [{ models: ['Fable 5', 'Opus 4.8', 'GPT-5.6 Sol', 'GPT Image 2'] }],
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
    modelCredits: [{ models: ['Opus 5', 'GPT-5.6 Sol'] }],
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
    id: 'siege-warfare',
    category: '3D 게임 제작',
    title: '공성전 (Siege Warfare)',
    description: '발리스타·투석기·트레뷰셋으로 성문과 탑, 본성을 공략하는 3D 브라우저 게임입니다. 성벽 블록의 물리적 파괴와 레벨별 목표를 구현했습니다.',
    focus: ['3D 공성전', '물리 기반 성벽 파괴', '공성 무기 조작'],
    modelCredits: [{ models: ['Opus 5', 'GPT-5.6 Sol'] }],
    demoUrl: 'https://ssw-siege-warfare.swsongab11572.chatgpt.site/',
    images: [
      {
        src: '/images/agent-experiments/siege-warfare/01-ballista-wide.jpg',
        alt: '발리스타를 조준해 성문을 공략하는 공성전 레벨 1 플레이 화면',
        caption: '발리스타로 성문을 공략하는 레벨 1',
      },
      {
        src: '/images/agent-experiments/siege-warfare/02-trebuchet-impact.png',
        alt: '트레뷰셋 포탄에 맞은 본성 성벽의 블록이 무너지고 흩어지는 레벨 3 플레이 화면',
        caption: '트레뷰셋 포격으로 본성 성벽이 무너지는 장면',
      },
    ],
  },
  {
    id: 'blender-medieval-weapons',
    category: 'Blender 3D 에셋 제작',
    title: '중세 무기',
    description: '검·폴암·방패 등 중세 무기 에셋을 종류별로 정리하고 셰이딩과 와이어프레임 작업 화면을 함께 보여줍니다.',
    focus: ['중세 무기', 'Blender 3D', '셰이딩·와이어프레임'],
    modelCredits: [{ models: ['Opus 5.5'] }],
    images: [
      {
        src: '/images/agent-experiments/blender-medieval-weapons/05-scale-comparison.jpg',
        alt: '검과 장병기 및 방패를 같은 축척으로 나란히 세운 중세 무기고 화면',
        caption: '중세 무기고 — 무기와 방패의 축척 비교',
      },
      {
        src: '/images/agent-experiments/blender-medieval-weapons/01-catalog.jpg',
        alt: '검과 철퇴 등 중세 무기 렌더 카드를 세 열로 보여주는 전체 목록 화면',
        caption: '중세 무기 에셋의 전체 목록',
      },
      {
        src: '/images/agent-experiments/blender-medieval-weapons/02-weapons-detail.jpg',
        alt: '할버드와 플랜지드 메이스, 워해머를 나란히 보여주는 3D 렌더',
        caption: '할버드·플랜지드 메이스·워해머 상세',
      },
      {
        src: '/images/agent-experiments/blender-medieval-weapons/03-shields.jpg',
        alt: '카이트 실드와 원형 방패, 히터 실드의 앞면과 뒷면을 비교하는 3D 렌더',
        caption: '형태와 무늬가 다른 방패 렌더',
      },
      {
        src: '/images/agent-experiments/blender-medieval-weapons/04-shading-wireframe.jpg',
        alt: '검 모델의 완성 셰이딩과 삼각형 메시 와이어프레임을 좌우로 비교한 화면',
        caption: '검의 셰이딩과 와이어프레임 비교',
      },
    ],
  },
  {
    id: 'blender-food',
    category: 'Blender 3D 에셋 제작',
    title: '음식·가전',
    description: '가전 세 종류와 모델별로 제작한 도넛·와플·마카롱 렌더를 함께 소개합니다.',
    focus: ['음식', '가전', 'Blender 3D'],
    modelCredits: [
      { purpose: '가전', models: ['GPT-6 Astra'] },
      { purpose: '음식 · 도넛', models: ['GPT-6 Astra'] },
      { purpose: '음식 · 와플', models: ['Grok 4.6'] },
      { purpose: '음식 · 마카롱', models: ['Opus 5.5'] },
    ],
    images: [
      {
        src: '/images/agent-experiments/blender-food/01-mixer.png',
        alt: '투명한 유리 용기와 금속 조작부가 보이는 믹서 렌더',
        caption: '믹서 · GPT-6 Astra',
      },
      {
        src: '/images/agent-experiments/blender-food/02-waffle-maker.png',
        alt: '원형 격자판을 열어 둔 와플 메이커 렌더',
        caption: '와플 메이커 · GPT-6 Astra',
      },
      {
        src: '/images/agent-experiments/blender-food/03-toaster.png',
        alt: '두 개의 투입구와 측면 레버가 보이는 금속 토스터 렌더',
        caption: '토스터 · GPT-6 Astra',
      },
      {
        src: '/images/agent-experiments/blender-food/04-donut-gpt-6-astra.png',
        alt: '분홍색 아이싱과 스프링클이 올라간 도넛 렌더',
        caption: '도넛 · GPT-6 Astra',
      },
      {
        src: '/images/agent-experiments/blender-food/05-waffle-grok-4-6.png',
        alt: '흰 접시에 올린 둥근 와플 렌더',
        caption: '와플 · Grok 4.6',
      },
      {
        src: '/images/agent-experiments/blender-food/06-macaron-opus-5-5.png',
        alt: '흰 접시에 담긴 여러 색상의 마카롱 렌더',
        caption: '마카롱 · Opus 5.5',
      },
    ],
    downloads: [
      { src: '/models/agent-experiments/blender-food/kitchen-mixer.blend', label: '믹서' },
      { src: '/models/agent-experiments/blender-food/kitchen-waffle-maker.blend', label: '와플 메이커' },
      { src: '/models/agent-experiments/blender-food/kitchen-toaster.blend', label: '토스터' },
    ],
  },
  {
    id: 'blender-subway',
    category: 'Blender 3D 에셋 제작',
    title: '지하철',
    description: '승강장·열차·개찰구를 포함한 지하철역 공간을 단면과 내부 시점으로 보여줍니다.',
    focus: ['지하철역 공간', '승강장·열차', '개찰구'],
    modelCredits: [{ models: ['GPT-6 Astra'] }],
    images: [
      {
        src: '/images/agent-experiments/blender-subway/01-station-cutaway.png',
        alt: '승강장과 열차, 개찰구가 한눈에 보이는 지하철역의 등각 단면 이미지',
        caption: '지하철역 구조와 열차를 한눈에 보는 단면',
      },
      {
        src: '/images/agent-experiments/blender-subway/02-platform.png',
        alt: '스크린도어와 기둥, 대기 공간이 길게 이어지는 지하철 승강장 내부',
        caption: '스크린도어가 설치된 승강장 내부',
      },
      {
        src: '/images/agent-experiments/blender-subway/03-ticket-gates.png',
        alt: '여러 개의 개찰구와 휠체어용 통로가 보이는 지하철역 입구',
        caption: '일반 개찰구와 접근성 통로',
      },
    ],
  },
  {
    id: 'blender-city',
    category: 'Blender 3D 에셋 제작',
    title: '도시 거리',
    description: '왕복 6차선 도로와 고층 빌딩, 한글 상가 간판·신호등·가로수로 구성한 가상의 한국 도심 「한빛대로」입니다. 대로 전경과 조감도, 눈높이 1.7m의 보행자 시점으로 공간을 살펴봅니다.',
    focus: ['한국 도심 환경', '왕복 6차선', '보행자 시점'],
    modelCredits: [{ models: ['GPT-6 Astra'] }],
    images: [
      {
        src: '/images/agent-experiments/blender-city/01_city_overview.jpg',
        alt: '6차선 대로 양쪽으로 서로 다른 높이의 고층 건물이 배치된 가상 한국 도심의 조감도',
        caption: '전체 조감도 — 도로와 고층 업무지구의 배치',
      },
      {
        src: '/images/agent-experiments/blender-city/02_boulevard_hero.jpg',
        alt: '고층 빌딩과 한글 상가 간판 사이로 왕복 6차선 도로와 차량이 이어지는 한빛대로 전경',
        caption: '한빛대로 전경 — 고층 빌딩과 왕복 6차선 도로',
      },
      {
        src: '/images/agent-experiments/blender-city/03_road_intersection.jpg',
        alt: '한국 도심 교차로의 신호등과 횡단보도, 파란 시내버스와 주황색 택시가 보이는 도로 시점',
        caption: '교차로와 도로 — 횡단보도·신호등·차량',
      },
      {
        src: '/images/agent-experiments/blender-city/04_sidewalk_west.jpg',
        alt: '은행과 커피숍의 한글 간판을 왼쪽에 두고 가로수가 늘어선 서측 인도를 바라보는 시점',
        caption: '서측 인도 — 눈높이 1.7m의 보행자 시점',
      },
      {
        src: '/images/agent-experiments/blender-city/05_sidewalk_east.jpg',
        alt: '한글 상가와 가로수, 버스정류장과 파란 시내버스가 보이는 동측 인도',
        caption: '동측 인도 — 상가와 가로수·버스정류장',
      },
      {
        src: '/images/agent-experiments/blender-city/06_crosswalk_corner.jpg',
        alt: '한빛대로 도로명판과 보행 신호등, 점자블록과 횡단보도 너머의 고층 건물이 보이는 교차로 모서리',
        caption: '횡단보도 모서리 — 도로명판과 보행 시설물',
      },
    ],
  },
  {
    id: 'blender-office',
    category: 'Blender 3D 에셋 제작',
    title: '사무실',
    description: 'GPT-6 Astra로 프롬프트를 작성해 GPT Image 2.5로 사무실 이미지를 먼저 생성하고, 이를 바탕으로 GPT-6 Astra가 공간 배치·가구·재질을 Blender로 모델링했습니다. 참고 이미지와 실제 Blender 구현 결과를 별도 블록으로 나누어 보여줍니다.',
    focus: ['이미지 기반 모델링', '사무실', 'Blender 3D'],
    modelCredits: [
      { purpose: '프롬프트', models: ['GPT-6 Astra'] },
      { purpose: '이미지', models: ['GPT Image 2.5'] },
      { purpose: 'Blender 모델링', models: ['GPT-6 Astra'] },
    ],
    imageGroups: [
      {
        title: '생성한 참고 이미지',
        description: 'Blender 모델링 전에 생성한 공간 시안입니다.',
        modelCredits: [
          { purpose: '프롬프트', models: ['GPT-6 Astra'] },
          { purpose: '이미지', models: ['GPT Image 2.5'] },
        ],
        images: [{
          src: '/images/agent-experiments/blender-office/01-reference.png',
          alt: '낮은 파티션과 책상, 서류장·복합기·정수기와 안쪽 회의실이 있는 사무실의 사전 생성 참고 이미지',
          caption: '먼저 생성한 참고 이미지 · Blender 구현 결과 아님',
        }],
      },
      {
        title: 'Blender 구현 결과',
        description: '참고 이미지를 바탕으로 제작한 3D 공간의 실제 렌더입니다.',
        modelCredits: [{ purpose: 'Blender 모델링', models: ['GPT-6 Astra'] }],
        images: [
          {
            src: '/images/agent-experiments/blender-office/02-entrance.jpg',
            alt: '입구에서 바라본 Blender 사무실 모델링의 책상·회색 파티션과 서류장·복합기·정수기, 안쪽 회의실',
            caption: 'Blender 구현 — 참고 이미지의 구도를 따른 입구 전경',
          },
          {
            src: '/images/agent-experiments/blender-office/03-workstation-detail.jpg',
            alt: 'Blender로 모델링한 사무실의 모니터·키보드·파일철과 낮은 파티션, 메시 의자 상세',
            caption: 'Blender 구현 — 책상·파티션·사무용 의자 상세',
          },
          {
            src: '/images/agent-experiments/blender-office/04-reverse-aisle.jpg',
            alt: 'Blender 사무실 안쪽에서 입구를 바라본 업무 공간과 중앙 통로, 블라인드 창 전경',
            caption: 'Blender 구현 — 안쪽에서 입구 방향으로 바라본 전경',
          },
          {
            src: '/images/agent-experiments/blender-office/05-meeting-room.jpg',
            alt: 'Blender로 모델링한 사무실 안쪽의 유리 칸막이와 테이블·의자·화이트보드가 있는 작은 회의실',
            caption: 'Blender 구현 — 사무실 안쪽의 작은 회의실',
          },
        ],
      },
    ],
  },
  {
    id: 'motion-graphics',
    category: '영상물',
    title: '모션그래픽',
    description: 'Opus 5.5와 GPT-6 Astra를 활용해 제작한 모션그래픽 영상입니다. 각 영상 위에 제작 모델을 표시했습니다.',
    focus: ['모션그래픽', '영상 제작'],
    modelCredits: [
      { purpose: '위 영상', models: ['Opus 5.5'] },
      { purpose: '아래 영상', models: ['GPT-6 Astra'] },
    ],
    videos: [
      {
        label: '위 영상',
        model: 'Opus 5.5',
        video: {
          src: '/media/agent-experiments/motion-graphics/main.mp4',
          poster: '/media/agent-experiments/motion-graphics/poster.jpg',
        },
      },
      {
        label: '아래 영상',
        model: 'GPT-6 Astra',
        video: {
          src: '/media/agent-experiments/motion-graphics/astra.mp4',
          poster: '/media/agent-experiments/motion-graphics/astra-poster.jpg',
        },
      },
    ],
  },
  {
    id: 'spaceship-simulation',
    category: '영상물',
    title: '우주선 시뮬레이션',
    description: '우주선 콕핏 HUD와 행성 접근 장면을 담은 시뮬레이션 영상입니다.',
    focus: ['우주선 시뮬레이션', '콕핏 HUD'],
    modelCredits: [{ models: ['Opus 5.5'] }],
    video: {
      src: '/media/agent-experiments/spaceship-simulation/main.mp4',
      poster: '/media/agent-experiments/spaceship-simulation/poster.jpg',
      caption: '콕핏 HUD에서 바라보는 행성 접근 장면',
    },
  },
  {
    id: 'comfyui-qwen-wan',
    category: 'ComfyUI 활용',
    title: 'ComfyUI 이미지 → 5초 영상',
    description: 'GPT-6 Sol이 ComfyUI 워크플로우와 프롬프트를 구성하고, Qwen Image 2512 FP8 E4M3FN으로 이미지를 생성한 뒤 Wan 2.2 I2V 14B FP8로 5초 영상을 제작했습니다.',
    focus: ['ComfyUI', '이미지 생성', '이미지→영상'],
    modelCredits: [
      { purpose: '워크플로우와 프롬프트', models: ['GPT-6 Sol'] },
      { purpose: '이미지', models: ['Qwen Image 2512 FP8 E4M3FN'] },
      { purpose: '영상', models: ['Wan 2.2 I2V 14B FP8'] },
    ],
    images: [
      {
        src: '/images/agent-experiments/comfyui/cafe-qwen-image-2512.png',
        alt: '비 오는 저녁 거리의 S-WORK COFFEE 카페 이미지',
        caption: 'Qwen Image 2512로 생성한 카페 이미지',
      },
    ],
    video: {
      src: '/media/agent-experiments/comfyui-qwen-wan/cafe-i2v-5s.mp4',
      poster: '/images/agent-experiments/comfyui/cafe-qwen-image-2512.png',
      caption: 'Wan 2.2 I2V로 이미지에서 생성한 5초 영상',
    },
  },
  {
    id: 'comfyui-gpt-image2-wan',
    category: 'ComfyUI 활용',
    title: 'GPT Image 2 → 5초 영상',
    description: 'GPT Image 2로 생성한 행성 탐사 이미지를 ComfyUI에서 Wan 2.2 I2V 14B FP8로 5초 영상으로 확장했습니다.',
    focus: ['GPT Image 2', 'ComfyUI', '이미지→영상'],
    modelCredits: [
      { purpose: '이미지', models: ['GPT Image 2'] },
      { purpose: '영상', models: ['Wan 2.2 I2V 14B FP8'] },
    ],
    images: [
      {
        src: '/images/agent-experiments/comfyui/astronaut-gpt-image-2.png',
        alt: '우주비행사가 외계 행성의 암석 지형에서 우주선과 고리 행성을 바라보는 이미지',
        caption: 'GPT Image 2로 생성한 행성 탐사 이미지',
      },
    ],
    video: {
      src: '/media/agent-experiments/comfyui-gpt-image2-wan/astronaut-i2v-5s.mp4',
      poster: '/images/agent-experiments/comfyui/astronaut-gpt-image-2.png',
      caption: 'Wan 2.2 I2V로 이미지에서 생성한 5초 영상',
    },
  },
  {
    id: 'fps-model-comparison',
    hidden: true,
    category: '3D 게임 제작',
    title: 'FPS 제작 테스트',
    description: '같은 제작 과제를 모델별로 진행하고, 결과 화면과 구현 내용을 비교할 예정입니다.',
    focus: ['공통 과제', '모델별 결과', '개입 과정'],
    models: ['Opus 5', 'Fable 5.1', 'Astra'],
  },
  {
    id: 'blender-3d-assets',
    hidden: true,
    category: 'Blender 3D 에셋 제작',
    title: 'Blender 3D 에셋 제작',
    description: 'Blender로 제작한 3D 모델과 리깅·애니메이션 결과를 정리하고 비교할 자리입니다.',
    focus: ['3D 모델링', '리깅·애니메이션', '게임 리소스'],
  },
];
