export type AgentExperimentVideo = {
  src: string;
  poster?: string;
  caption?: string;
  /** 지정한 영상에만 같은 MP4 파일을 내려받는 버튼을 표시한다. */
  downloadName?: string;
};
export type AgentExperimentImage = {
  src: string;
  alt: string;
  caption: string;
  /** 사진별 헤더가 필요할 때만 작품명과 기존 제작 모델 항목을 연결한다. */
  title?: string;
  modelCreditPurpose?: NonNullable<AgentExperimentModelCredit['purpose']>;
};
export type AgentExperimentModelCredit = {
  purpose?: '코드' | '2D 에셋' | '배경음악' | '음원' | '워크플로우와 프롬프트' | '프롬프트' | '이미지' | '영상' | '위 영상' | '아래 영상' | 'Blender 모델링' | '가전' | '음식 · 도넛' | '음식 · 와플' | '음식 · 마카롱' | 'Claude' | 'GPT' | 'Grok' | 'Gemini';
  models: string[];
  via?: string;
};

export type AgentExperimentAudioPreview = {
  src: string;
  title: string;
  album: string;
  durationSeconds: number;
};

/** 실험 갤러리의 공개 메타데이터. 미확인 제작 정보와 결과는 채우지 않는다. */
export type AgentExperiment = {
  id: string;
  category: '2D 게임 실험' | '3D 게임 실험' | 'Blender 3D 에셋 제작' | 'SVG 제작' | 'WebGL' | '영상물' | 'ComfyUI 활용' | '앱·도구 실험' | '포템킨 빌리지' | '리깅';
  title: string;
  description: string;
  /** 비교에 사용한 입력 원문. 설명과 분리해 인용 박스로 표시한다. */
  prompt?: string;
  focus: string[];
  /** 데이터와 구현을 보존하면서 갤러리 노출만 숨긴다. */
  hidden?: boolean;
  demoUrl?: string;
  demoLabel?: string;
  /** 같은 샘플 안의 다른 실행 화면처럼, 직접 실행 링크 옆에 덧붙이는 외부 링크. */
  extraLinks?: Array<{ url: string; label: string }>;
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
  /** 공개 MP3 프리뷰를 앨범별로 선택하고 단일 플레이어에서 재생한다. */
  audioPreviews?: AgentExperimentAudioPreview[];
  /** 모델별 애니메이션을 동시에 비교한다. 파일이 없는 칸은 준비 중으로 표시한다. */
  animationGroups?: Array<{
    label: 'Claude' | 'GPT' | 'Gemini·Grok';
    items: Array<{ model: string | null; image?: { src: string; alt: string } }>;
  }>;
  /** 공개 폴더에 실제 파일이 있는 다운로드만 등록한다. */
  downloads?: Array<{ src: string; label: string }>;
  /** 공개 폴더에 실제 파일이 있는 영상만 등록한다. */
  video?: AgentExperimentVideo;
  /** 사이트와 격리해 실행하는 HTML 작품. MP4는 다운로드로만 연결한다. */
  htmlPreview?: { src: string; layout?: 'viewport'; download?: { src: string; filename: string } };
  /** 같은 작업의 모델별 영상을 등록 순서대로 한 열에 표시한다. */
  videos?: Array<{ label: string; model: string; video: AgentExperimentVideo }>;
  /** 실제 제작에 사용한 모델. 비교 화면용 models와 구분한다. */
  modelCredits?: AgentExperimentModelCredit[];
  models?: string[];
  /** 포템킨 빌리지(패러디)의 겉과 속. 가상 제품·수치임을 본문에 밝힌다. */
  parody?: { surface: string; reality: string };
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
    description: '여러 모델에 동일한 프롬프트를 각각 단 한 번 입력해 얻은 펠리컨 SVG 애니메이션 결과를 비교합니다.',
    prompt: '자전거 타는 펠리컨을 재생되는 svg로 그려봐 모델 테스트니까 서브에이전트 쓰지말고 직접해',
    focus: ['SVG 애니메이션', '모델별 비교', '펠리컨'],
    modelCredits: [
      { purpose: 'Claude', models: ['Fable 5.1', 'Opus 5.5', 'Sonnet 5.5'] },
      { purpose: 'GPT', models: ['GPT-6 Astra', 'GPT-6 Sol', 'GPT-6 Luna'] },
      { purpose: 'Gemini', models: ['Gemini 4 Argon', 'Gemini 3.8 Flash'] },
      { purpose: 'Grok', models: ['Grok 4.7'] },
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
        label: 'Gemini·Grok',
        items: [
          { model: 'Gemini 4 Argon', image: { src: '/images/agent-experiments/svg/pelican/09-gemini-4-argon.svg', alt: 'Gemini 4 Argon으로 제작한 자전거 타는 펠리컨 SVG 애니메이션' } },
          { model: 'Gemini 3.8 Flash', image: { src: '/images/agent-experiments/svg/pelican/07-gemini-3-8-flash.svg', alt: 'Gemini 3.8 Flash로 제작한 자전거 타는 펠리컨 SVG 애니메이션' } },
          { model: 'Grok 4.7', image: { src: '/images/agent-experiments/svg/pelican/08-grok-4-7.svg', alt: 'Grok 4.7로 제작한 자전거 타는 펠리컨 SVG 애니메이션' } },
        ],
      },
    ],
  },
  {
    id: 'exploded-atlas',
    category: 'WebGL',
    title: '분해도 도감',
    description: '기계 장치를 3D로 돌려 보고, 부품을 분해하거나 작동시켜 구조와 움직임을 살펴보는 WebGL 도감입니다.',
    focus: ['3D 분해도', '회전·분해·작동', 'WebGL'],
    demoUrl: 'https://pf-samples.sworksong.workers.dev/3d/webgl/exploded-atlas/',
    images: [
      {
        src: '/images/agent-experiments/exploded-atlas/01-exploded-overview.jpg',
        alt: '기계 장치를 3D 분해도로 살펴보는 분해도 도감 실행 화면',
        caption: '기계 장치의 구조와 움직임을 살펴보는 WebGL 도감',
      },
    ],
  },
  {
    id: 'iced-latte',
    category: 'WebGL',
    title: '얼음 동동 라떼',
    description: '얼음·커피·우유를 섞으며 유리잔의 반사와 유체가 섞이는 시각효과를 살펴보는 카페라떼 시뮬레이션입니다.',
    focus: ['카페라떼 시뮬레이션', '유리잔 반사', '혼합 시각효과'],
    demoUrl: 'https://pf-samples.sworksong.workers.dev/3d/webgl/iced-latte/',
    images: [
      {
        src: '/images/agent-experiments/iced-latte/01-latte-overview.jpg',
        alt: '얼음이 들어간 유리잔 속 커피와 우유의 혼합을 표현한 얼음 동동 라떼 실행 화면',
        caption: '유리잔의 반사와 음료가 섞이는 시각효과 실험',
      },
    ],
  },
  {
    id: 'dot-board',
    category: 'WebGL',
    title: '전광판 시뮬레이터',
    description: '문구와 연출을 바꾸고 2D·3D 렌더링, 도트 패널과 구동·전력 옵션을 조절해 보는 브라우저 전광판 시뮬레이터입니다.',
    focus: ['문구·연출', '2D·3D 렌더링', '도트 패널·구동 옵션'],
    demoUrl: 'https://pf-samples.sworksong.workers.dev/3d/webgl/dot-board/',
    images: [
      {
        src: '/images/agent-experiments/dot-board/01-dot-board.jpg',
        alt: '현재 시각을 표시하는 초록색 LED 전광판의 정면 화면과 LED 색·색 깊이·디더링·세로 도트 설정',
        caption: '초록 LED 시계 연출 · 패널·메모리 설정',
      },
      {
        src: '/images/agent-experiments/dot-board/02-panel-view.jpg',
        alt: '전광판을 분해하고 회전해 1~9번 번호로 표시된 패널 구조와 설정을 살펴보는 3D 화면',
        caption: '분해·회전한 전광판의 번호별 패널 구조',
      },
    ],
  },
  {
    id: 'phase-smoke',
    category: 'WebGL',
    title: '연기 이동 실험',
    description: '사람 캐릭터가 연기로 흩어졌다가 목적지에서 재구성되는 WebGL2 시각효과 실험입니다. 바닥 클릭·터치나 좌표 입력으로 순간이동하고, 연기·바람 흩날림·디졸브 효과와 흐름·밀도·색·속도를 비교할 수 있습니다. 입자 기반 유체 근사를 사용하며, WebGL2 지원 브라우저에서 PC WASD와 모바일 스틱 조작을 제공합니다.',
    focus: ['연기 순간이동', '입자 기반 유체 근사', '효과·흐름 조절', 'WebGL2'],
    demoUrl: 'https://pf-samples.sworksong.workers.dev/3d/webgl/phase-smoke/',
    images: [
      {
        src: '/images/agent-experiments/phase-smoke/01-dissolve-reform.webp',
        alt: '바람 흩날림 효과로 사람 캐릭터가 한쪽부터 연기로 날려 가고, 연기 덩어리로 이동한 뒤, 목적지에서 도착한 순서대로 다시 몸이 만들어지는 세 장면을 나란히 놓은 그림',
        caption: '바람 흩날림 · 흩어짐 → 이동 → 재구성',
      },
      {
        src: '/images/agent-experiments/phase-smoke/02-travel.webp',
        alt: '어두운 실험 레벨 바닥에서 출발 고리를 떠난 연기가 목적지 고리에 서 있는 캐릭터 몸으로 빨려 들어가며 재구성되는 전체 화면',
        caption: '실험 레벨 · 목적지에서 다시 합쳐지는 순간',
      },
    ],
  },
  {
    id: 'planet-defense',
    category: '2D 게임 실험',
    title: 'Planet Defense',
    description: 'AI·SI 에이전트로 제작한 이미지 리소스를 활용하고, 자동 요격과 액티브 스킬, 웨이브 사이의 방어망 정비를 결합한 행성 방어 게임입니다.',
    focus: ['전투 시스템', '성장·강화', 'AI·SI 이미지'],
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
    category: '2D 게임 실험',
    title: '물고기 키우기',
    description: 'AI·SI 에이전트로 제작한 이미지 리소스를 활용해 물고기 육성과 재화 수집, 침입자 방어를 결합한 수족관 게임입니다.',
    focus: ['육성·경제', 'AI·SI 이미지', '배경음악'],
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
    id: 'oscillo-rhythm-game',
    category: '2D 게임 실험',
    title: 'OSCILLO · 2D 리듬게임',
    description: '앨범·곡과 난이도를 선택하고, 음악에 맞춰 내려오는 노트를 4개 레인에서 입력하는 브라우저 리듬게임입니다. PC에서는 D·F·J·K 키를, 모바일에서는 레인 터치를 사용합니다.',
    focus: ['4레인 리듬게임', '앨범·곡·난이도 선택', '키보드·터치 입력'],
    modelCredits: [
      { purpose: '코드', models: ['Opus 5.5'] },
      { purpose: '음원', models: ['다양한 모델 혼합'] },
    ],
    demoUrl: 'https://pf-samples.sworksong.workers.dev/games/2d/oscillo/',
    audioPreviews: [
      { title: 'Neon Highway', album: 'Opus 5.5', src: 'https://pf-samples.sworksong.workers.dev/games/2d/oscillo/previews/neon-highway.30bff6f87e82.mp3', durationSeconds: 13 },
      { title: 'Pixel Picnic', album: 'Opus 5.5', src: 'https://pf-samples.sworksong.workers.dev/games/2d/oscillo/previews/pixel-picnic.b942f6527a59.mp3', durationSeconds: 13 },
      { title: 'Overclock', album: 'Opus 5.5', src: 'https://pf-samples.sworksong.workers.dev/games/2d/oscillo/previews/overclock.e7b29385bb2a.mp3', durationSeconds: 13 },
      { title: 'Midnight Weight', album: 'Lyria 3.5', src: 'https://pf-samples.sworksong.workers.dev/games/2d/oscillo/previews/midnight-weight.20f79edd89da.mp3', durationSeconds: 13 },
      { title: 'After the Great Ascent', album: 'Lyria 3.5', src: 'https://pf-samples.sworksong.workers.dev/games/2d/oscillo/previews/after-the-great-ascent.9e51d493779b.mp3', durationSeconds: 13 },
      { title: 'The High Noon Hustle', album: 'Lyria 3.5', src: 'https://pf-samples.sworksong.workers.dev/games/2d/oscillo/previews/the-high-noon-hustle.416ff5c5bb1f.mp3', durationSeconds: 13 },
      { title: '내 눈물 속에 갇힌 너', album: 'Lyria 3.5 보컬', src: 'https://pf-samples.sworksong.workers.dev/games/2d/oscillo/previews/trapped-in-my-tears.b2689a0bcb46.mp3', durationSeconds: 13 },
      { title: '하얀 입김', album: 'Lyria 3.5 보컬', src: 'https://pf-samples.sworksong.workers.dev/games/2d/oscillo/previews/white-breath.6032598e16c4.mp3', durationSeconds: 13 },
      { title: '새벽의 끝에서', album: 'Lyria 3.5 보컬', src: 'https://pf-samples.sworksong.workers.dev/games/2d/oscillo/previews/at-the-end-of-dawn.3ca8ab97a927.mp3', durationSeconds: 13 },
      { title: 'Medley 01', album: 'Lyria 3.0 보컬 메들리 · 밈 가사', src: 'https://pf-samples.sworksong.workers.dev/games/2d/oscillo/previews/medley-01.c5d210be3559.mp3', durationSeconds: 13 },
      { title: '웹 퍼블리셔 메들리', album: 'Lyria 3.0 보컬 메들리 · 밈 가사', src: 'https://pf-samples.sworksong.workers.dev/games/2d/oscillo/previews/web-publisher-medley.82d183de34da.mp3', durationSeconds: 13 },
      { title: '개발밈 메들리', album: 'Lyria 3.0 보컬 메들리 · 밈 가사', src: 'https://pf-samples.sworksong.workers.dev/games/2d/oscillo/previews/dev-meme-medley.52895475ab7d.mp3', durationSeconds: 13 },
      { title: '보안 메들리', album: 'Lyria 3.0 보컬 메들리 · 밈 가사', src: 'https://pf-samples.sworksong.workers.dev/games/2d/oscillo/previews/security-medley.4364a987c109.mp3', durationSeconds: 13 },
      { title: '흐르는 빛의 항해', album: 'Lyria 3.0 보컬 메들리 · 밈 가사', src: 'https://pf-samples.sworksong.workers.dev/games/2d/oscillo/previews/flowing-light-voyage.86d8cbd67b6c.mp3', durationSeconds: 13 },
      { title: 'IRON OVERHAUL', album: 'GPT Dots 리메이크', src: 'https://pf-samples.sworksong.workers.dev/games/2d/oscillo/previews/iron-overhaul.36a988772853.mp3', durationSeconds: 13 },
      { title: 'LOW B GRAVITY', album: 'GPT Dots 리메이크', src: 'https://pf-samples.sworksong.workers.dev/games/2d/oscillo/previews/low-b-gravity.98117d5d2864.mp3', durationSeconds: 13 },
      { title: 'Iron Wall March', album: 'GPT Dots 리메이크', src: 'https://pf-samples.sworksong.workers.dev/games/2d/oscillo/previews/iron-wall-march.c723ea54155f.mp3', durationSeconds: 13 },
    ],
    images: [
      {
        src: '/images/agent-experiments/oscillo/01-song-selection.jpg',
        alt: '앨범 디스크와 수록곡 목록, 난이도 및 PLAY 버튼을 보여주는 OSCILLO 리듬게임의 곡 선택 화면',
        caption: '앨범과 곡, 난이도를 고르는 선택 화면',
      },
      {
        src: '/images/agent-experiments/oscillo/02-gameplay.jpg',
        alt: 'D·F·J·K 키에 대응하는 4개 레인으로 노트가 내려오는 OSCILLO 리듬게임 플레이 화면',
        caption: '4개 레인과 타이밍 판정을 사용하는 플레이 화면',
      },
    ],
  },
  {
    id: 'flight-simulator-experiment',
    category: '3D 게임 실험',
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
    category: '3D 게임 실험',
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
        src: '/images/agent-experiments/siege-warfare/02-trebuchet-impact.webp',
        alt: '트레뷰셋 포탄에 맞은 본성 성벽의 블록이 무너지고 흩어지는 레벨 3 플레이 화면',
        caption: '트레뷰셋 포격으로 본성 성벽이 무너지는 장면',
      },
    ],
  },
  {
    id: 'noeul-circuit',
    category: '3D 게임 실험',
    title: '노을서킷 · 3D 레이싱 게임',
    description: '트랙과 차량을 선택해 달리는 브라우저 3D 레이싱 게임입니다. 스피드전과 아이템전을 선택해 레이스를 즐길 수 있습니다.',
    focus: ['3D 레이싱', '트랙·차량 선택', '스피드전·아이템전'],
    demoUrl: 'https://pf-samples.sworksong.workers.dev/games/3d/noeul-circuit/',
    images: [
      {
        src: '/images/agent-experiments/noeul-circuit/01-race-setup.jpg',
        alt: '트랙과 차량 및 경기 모드를 선택하는 노을서킷 3D 레이싱 게임의 준비 화면',
        caption: '트랙·차량·경기 모드를 선택하는 레이스 준비',
      },
      {
        src: '/images/agent-experiments/noeul-circuit/02-racing.jpg',
        alt: '트랙에서 차량을 주행하는 노을서킷 3D 레이싱 게임의 플레이 화면',
        caption: '선택한 차량으로 트랙을 달리는 3D 레이싱',
      },
    ],
  },
  {
    id: 'hand-joint-rigging',
    category: '리깅',
    title: '손 관절 리깅 실험',
    description: '외부 3D 모델 없이 손·팔의 메시와 관절, 스키닝 가중치를 코드로 구성한 리깅 실험입니다. 자세·애니메이션 전환과 손끝 IK, 물체 쥐기·타격을 조작하고, 관절 구조와 가중치를 시각화해 확인할 수 있습니다. 같은 리그를 활용한 1인칭 화면도 제공하며, 데스크톱 키보드·마우스로 조작합니다.',
    focus: ['절차적 손·팔 제작', '관절 리깅·스키닝', '자세·IK·파지 실험'],
    modelCredits: [{ models: ['Fable 5', 'Opus 5', 'GPT-5.6 Sol'] }],
    demoUrl: 'https://ssw-hand-joint-rigging.swsongab11572.chatgpt.site',
    images: [
      {
        src: '/images/agent-experiments/hand-joint-rigging/01-hand-overview.jpg',
        alt: '손 관절 리깅 실험의 제어 패널과 코드로 제작한 손·팔의 펼침 자세 클로즈업',
        caption: '절차적으로 제작한 손·팔과 자세 전환 제어 패널',
      },
      {
        src: '/images/agent-experiments/hand-joint-rigging/02-hand-wireframe.jpg',
        alt: '와이어프레임 모드에서 손바닥과 손가락을 구성하는 삼각형 메시를 보여 주는 손 리깅 화면',
        caption: '손바닥·손가락의 삼각형 메시를 확인하는 와이어프레임',
      },
      {
        src: '/images/agent-experiments/hand-joint-rigging/03-fingertip-ik.jpg',
        alt: '작업면 위 구슬 목표에 손끝을 도달시키고 오차를 표시하는 IK 실험 화면',
        caption: '손끝 IK 목표 도달과 오차 확인',
      },
    ],
  },
  {
    id: 'first-person-hand-sword',
    category: '리깅',
    title: '손·검 잡기 실험',
    description: '손과 검의 형상부터 손가락 관절, 스키닝 가중치와 쥐기 자세를 코드로 직접 구성한 1인칭 3D 훈련장입니다. 훈련장을 이동하며 더미에 검과 주먹 동작을 시험하고, 손의 관절과 변형을 확인할 수 있습니다.',
    focus: ['자체 제작 손·검', '손가락 리깅·스키닝', '1인칭 조작·타격'],
    modelCredits: [{ models: ['GPT-5.6 Sol', 'GPT-6.1 Sol'] }],
    demoUrl: 'https://ssw-hand-sword-training.swsongab11572.chatgpt.site',
    images: [
      {
        src: '/images/agent-experiments/first-person-hand-sword/01-training-overview.jpg',
        alt: '직접 제작한 검과 양팔, 훈련용 더미를 보여 주는 1인칭 훈련장 실행 화면',
        caption: '검 장착 상태의 1인칭 훈련장과 조작·타격 UI',
      },
      {
        src: '/images/agent-experiments/first-person-hand-sword/02-hand-rig.jpg',
        alt: '손을 펼친 상태에서 손목과 손가락 관절의 연결을 표시한 훈련장 화면',
        caption: '손 펼치기와 관절 표시로 확인하는 손 리그의 연결 구조',
      },
    ],
  },
  {
    id: 'blender-motion-atlas',
    category: '리깅',
    title: '모션 아틀라스 · 애니메이션 도감',
    description: 'Blender 파이썬 스크립트로 동물·몬스터·휴머노이드 모델을 만들고 뼈대(리그)를 심어 동작까지 만든 RPG 애니메이션 도감입니다. 동물 22종 104개, 몬스터 15종 71개, 휴머노이드 197개(무기·농사·낚시·여가 장비 110개, 일상·탐험 48개, 파티 연출 32개 포함)로 동작은 모두 372개이고, 샘플 페이지에서 동작마다 3D로 돌려 보며 0.25×부터 2×까지 속도를 바꿔 볼 수 있습니다. 말은 27본 리그 하나로 여덟 동작을 함께 쓰고, 드래곤은 날갯짓·활공·브레스를 따로 만들었습니다. 종마다 기본색 외에 대체 색 두 가지를 고를 수 있고, 고른 색은 재생 화면의 모델에 바로 입혀집니다. 야영지·갈대밭·장터의 RPG 장면 3편과 콘셉트아트 37종, 새 체형을 구상한 리그 연구 10종도 함께 있습니다. 휴머노이드는 뼈 이름만 Mixamo 규칙을 따랐고 동작 데이터는 가져오지 않았습니다. 모델·동작·그림 모두 AI·SI 에이전트로 만들었고, 콘셉트아트와 리그 연구 그림은 GPT 이미지로 그렸습니다.',
    focus: ['Blender 절차 생성 · 리깅 → GLB', '동작 372개 · RPG 장면 3편', '종마다 대체 색 2종'],
    modelCredits: [
      { purpose: '이미지', models: ['GPT 이미지'] },
    ],
    demoUrl: 'https://pf-samples.sworksong.workers.dev/3d/blender/motion-atlas/',
    demoLabel: '애니메이션 도감 열기',
    extraLinks: [{ url: 'https://pf-samples.sworksong.workers.dev/3d/blender/motion-atlas/#scenes', label: 'RPG 장면 열기' }],
    imageGroups: [
      {
        title: 'Blender 리깅·애니메이션 결과',
        description: '도감에 실린 GLB를 렌더한 장면과 동작 반복 미리보기입니다.',
        modelCredits: [],
        images: [
          {
            src: '/images/agent-experiments/blender-motion-atlas/01-camp.webp',
            alt: '별이 뜬 밤 침엽수 숲 앞 모닥불 곁에 여행자와 여우가 앉아 있고, 오른쪽에 주황색 드래곤이 날개를 펴고 내려앉는 로우폴리 장면',
            caption: 'RPG 장면 · 야영지에 내려앉은 드래곤',
          },
          {
            src: '/images/agent-experiments/blender-motion-atlas/02-dragon-wingbeat.webp',
            alt: '밝은 배경 앞에서 정면을 보고 두 막날개를 위아래로 퍼덕이는 주황색 드래곤의 반복 미리보기',
            caption: '드래곤 날갯짓 · 반복 미리보기',
          },
          {
            src: '/images/agent-experiments/blender-motion-atlas/03-horse-gallop.webp',
            alt: '갈기와 꼬리를 날리며 네 다리로 질주하는 밤색 말의 반복 미리보기',
            caption: '말 달리기(갤럽) · 27본 리그 공유',
          },
          {
            src: '/images/agent-experiments/blender-motion-atlas/04-market.webp',
            alt: '천막과 기와지붕 가게가 늘어선 장터 마당에서 한 사람은 짐을 머리 위로 들고 다른 사람은 수레를 미는 장면',
            caption: 'RPG 장면 · 장터',
          },
        ],
      },
      {
        title: '콘셉트아트 · 리그 연구',
        description: '모델링 전에 외형과 새 체형의 골격을 구상한 그림입니다.',
        modelCredits: [{ purpose: '이미지', models: ['GPT 이미지'] }],
        images: [
          {
            src: '/images/agent-experiments/blender-motion-atlas/05-golem-concept.webp',
            alt: '이끼 낀 둥근 돌들이 웅크린 더미에서 일어나 긴 팔로 땅을 짚고 걷는 자세까지 세 단계로 그린 자연 골렘 콘셉트아트',
            caption: '콘셉트아트 · 자연 골렘 휴면·기상·보행',
          },
          {
            src: '/images/agent-experiments/blender-motion-atlas/06-centaur-study.webp',
            alt: '조끼를 입고 꽃이 꽂힌 가죽 가방을 멘 켄타우로스가 네 다리로 성큼 걷는 리그 연구 그림',
            caption: '리그 연구 · 켄타우로스',
          },
        ],
      },
    ],
  },
  {
    id: 'frostpass-fantasy-rpg',
    category: '3D 게임 실험',
    title: '서리고개 · 1인칭 판타지 RPG',
    description: 'Three.js와 WebGL로 구현한 브라우저 1인칭 판타지 RPG입니다. 마을을 탐험하고 검과 마법으로 전투하며, 캐릭터 능력치·장비와 퀘스트를 확인할 수 있습니다.',
    focus: ['1인칭 탐험·전투', '캐릭터 능력치·장비', '퀘스트'],
    modelCredits: [{ models: ['Opus 5.5'] }],
    demoUrl: 'https://pf-samples.sworksong.workers.dev/games/3d/frostpass/',
    images: [
      {
        src: '/images/agent-experiments/frostpass-fantasy-rpg/01-gameplay.jpg',
        alt: '검을 든 1인칭 시점에서 마을 마구간의 주민과 말을 바라보며 대화 안내·미니맵·퀘스트를 표시하는 서리고개 화면',
        caption: '마을 마구간 탐험 · 주민 대화 안내와 미니맵·퀘스트',
      },
      {
        src: '/images/agent-experiments/frostpass-fantasy-rpg/02-character.jpg',
        alt: '서리고개 캐릭터 메뉴의 능력치 탭에서 레벨과 힘·민첩·지능·활력 및 체력·마력·기력 상태를 확인하는 화면',
        caption: '캐릭터 능력치 · 레벨과 기본 능력·현재 상태',
      },
    ],
  },
  {
    id: 'limen-portal',
    category: '3D 게임 실험',
    title: '포탈 실험',
    description: '두 포탈로 공간을 연결하는 Three.js 기반 1인칭 실험입니다. 벽·바닥·천장 사이를 이동하며 시선과 속도의 보존, 포탈 안에 다른 포탈이 보이는 중첩 뷰를 살펴볼 수 있습니다. PC WASD·마우스와 터치 조작을 제공합니다.',
    focus: ['1인칭 포탈 이동', '시선·속도 보존', '중첩 포탈 뷰'],
    demoUrl: 'https://pf-samples.sworksong.workers.dev/games/3d/limen-portal/',
    images: [
      {
        src: '/images/agent-experiments/limen-portal/01-both-portals.webp',
        alt: '벽의 주황 포탈 안으로 반대편 방이 보이고, 왼쪽 벽에 파란 포탈이 함께 보이는 1인칭 화면',
        caption: '두 포탈 · 주황 포탈 너머로 이어진 공간',
      },
      {
        src: '/images/agent-experiments/limen-portal/02-chamber.webp',
        alt: '실험실 안쪽 벽의 파란 포탈과 오른쪽 벽의 주황 포탈을 포탈 건을 든 채 바라본 1인칭 화면',
        caption: '실험실 전경 · 파란 포탈과 주황 포탈',
      },
    ],
  },
  {
    id: 'modern-warfare-sample',
    category: '3D 게임 실험',
    title: '현대전 샘플',
    description: '현대전 장비의 모델과 조작을 확인하는 브라우저 3D 샘플입니다. 전차·자주포·다연장로켓과 전투기·공격 헬기·폭격기를 선택하고, 지상 장비의 주행·조준·발포와 항공기의 아케이드 비행을 시험할 수 있습니다. 스킨과 애니메이션 클립, 속도·방위·장전 등의 상태를 함께 확인합니다. 제작 과정에서는 모델링 도구인 Blender를 보조적으로 활용했습니다.',
    focus: ['지상·항공 장비', '주행·조준·발포', '아케이드 비행', '모델링 도구 · Blender'],
    modelCredits: [{ models: ['Opus 5.5'] }],
    demoUrl: 'https://pf-samples.sworksong.workers.dev/games/3d/modern-warfare/',
    images: [
      {
        src: '/images/agent-experiments/modern-warfare-sample/01-tank-range.jpg',
        alt: '현대전 샘플에서 주력전차와 거리별 표적, 지형 및 장전 정보를 보여 주는 사격장 화면',
        caption: '전차 사격장 · 표적 거리와 조작·장전 정보',
      },
      {
        src: '/images/agent-experiments/modern-warfare-sample/02-fighter-runway.jpg',
        alt: '활주로 이륙 위치의 전투기와 속도·방위·고도·무장 상태를 표시한 현대전 샘플 화면',
        caption: '전투기 활주로 · 비행 계기와 무장 상태',
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
        src: '/images/agent-experiments/blender-medieval-weapons/04-shading-wireframe.jpg',
        alt: '검 모델의 완성 셰이딩과 삼각형 메시 와이어프레임을 좌우로 비교한 화면',
        caption: '검의 셰이딩과 와이어프레임 비교',
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
        src: '/images/agent-experiments/blender-medieval-weapons/01-catalog.jpg',
        alt: '검과 철퇴 등 중세 무기 렌더 카드를 세 열로 보여주는 전체 목록 화면',
        caption: '중세 무기 에셋의 전체 목록',
      },
      {
        src: '/images/agent-experiments/blender-medieval-weapons/05-scale-comparison.jpg',
        alt: '검과 장병기 및 방패를 같은 축척으로 나란히 세운 중세 무기고 화면',
        caption: '중세 무기고 — 무기와 방패의 축척 비교',
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
        src: '/images/agent-experiments/blender-food/01-mixer.webp',
        title: '믹서',
        modelCreditPurpose: '가전',
        alt: '투명한 유리 용기와 금속 조작부가 보이는 믹서 렌더',
        caption: '믹서 · GPT-6 Astra',
      },
      {
        src: '/images/agent-experiments/blender-food/02-waffle-maker.webp',
        title: '와플 메이커',
        modelCreditPurpose: '가전',
        alt: '원형 격자판을 열어 둔 와플 메이커 렌더',
        caption: '와플 메이커 · GPT-6 Astra',
      },
      {
        src: '/images/agent-experiments/blender-food/03-toaster.webp',
        title: '토스터',
        modelCreditPurpose: '가전',
        alt: '두 개의 투입구와 측면 레버가 보이는 금속 토스터 렌더',
        caption: '토스터 · GPT-6 Astra',
      },
      {
        src: '/images/agent-experiments/blender-food/04-donut-gpt-6-astra.webp',
        title: '도넛',
        modelCreditPurpose: '음식 · 도넛',
        alt: '분홍색 아이싱과 스프링클이 올라간 도넛 렌더',
        caption: '도넛 · GPT-6 Astra',
      },
      {
        src: '/images/agent-experiments/blender-food/05-waffle-grok-4-6.webp',
        title: '와플',
        modelCreditPurpose: '음식 · 와플',
        alt: '흰 접시에 올린 둥근 와플 렌더',
        caption: '와플 · Grok 4.6',
      },
      {
        src: '/images/agent-experiments/blender-food/06-macaron-opus-5-5.webp',
        title: '마카롱',
        modelCreditPurpose: '음식 · 마카롱',
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
        src: '/images/agent-experiments/blender-subway/01-station-cutaway.webp',
        alt: '승강장과 열차, 개찰구가 한눈에 보이는 지하철역의 등각 단면 이미지',
        caption: '지하철역 구조와 열차를 한눈에 보는 단면',
      },
      {
        src: '/images/agent-experiments/blender-subway/02-platform.webp',
        alt: '스크린도어와 기둥, 대기 공간이 길게 이어지는 지하철 승강장 내부',
        caption: '스크린도어가 설치된 승강장 내부',
      },
      {
        src: '/images/agent-experiments/blender-subway/03-ticket-gates.webp',
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
        src: '/images/agent-experiments/blender-city/01_city_overview.webp',
        alt: '6차선 대로 양쪽으로 서로 다른 높이의 고층 건물이 배치된 가상 한국 도심의 조감도',
        caption: '전체 조감도 — 도로와 고층 업무지구의 배치',
      },
      {
        src: '/images/agent-experiments/blender-city/02_boulevard_hero.webp',
        alt: '고층 빌딩과 한글 상가 간판 사이로 왕복 6차선 도로와 차량이 이어지는 한빛대로 전경',
        caption: '한빛대로 전경 — 고층 빌딩과 왕복 6차선 도로',
      },
      {
        src: '/images/agent-experiments/blender-city/03_road_intersection.webp',
        alt: '한국 도심 교차로의 신호등과 횡단보도, 파란 시내버스와 주황색 택시가 보이는 도로 시점',
        caption: '교차로와 도로 — 횡단보도·신호등·차량',
      },
      {
        src: '/images/agent-experiments/blender-city/04_sidewalk_west.webp',
        alt: '은행과 커피숍의 한글 간판을 왼쪽에 두고 가로수가 늘어선 서측 인도를 바라보는 시점',
        caption: '서측 인도 — 눈높이 1.7m의 보행자 시점',
      },
      {
        src: '/images/agent-experiments/blender-city/05_sidewalk_east.webp',
        alt: '한글 상가와 가로수, 버스정류장과 파란 시내버스가 보이는 동측 인도',
        caption: '동측 인도 — 상가와 가로수·버스정류장',
      },
      {
        src: '/images/agent-experiments/blender-city/06_crosswalk_corner.webp',
        alt: '한빛대로 도로명판과 보행 신호등, 점자블록과 횡단보도 너머의 고층 건물이 보이는 교차로 모서리',
        caption: '횡단보도 모서리 — 도로명판과 보행 시설물',
      },
    ],
  },
  {
    id: 'blender-office',
    category: 'Blender 3D 에셋 제작',
    title: '사무실',
    description: 'AI·SI 에이전트로 프롬프트를 작성해 사무실 이미지를 먼저 생성하고, 이를 바탕으로 공간 배치·가구·재질을 Blender로 모델링했습니다. 참고 이미지와 실제 Blender 구현 결과를 별도 블록으로 나누어 보여줍니다.',
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
          src: '/images/agent-experiments/blender-office/01-reference.webp',
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
            src: '/images/agent-experiments/blender-office/02-entrance.webp',
            alt: '입구에서 바라본 Blender 사무실 모델링의 책상·회색 파티션과 서류장·복합기·정수기, 안쪽 회의실',
            caption: 'Blender 구현 — 참고 이미지의 구도를 따른 입구 전경',
          },
          {
            src: '/images/agent-experiments/blender-office/03-workstation-detail.webp',
            alt: 'Blender로 모델링한 사무실의 모니터·키보드·파일철과 낮은 파티션, 메시 의자 상세',
            caption: 'Blender 구현 — 책상·파티션·사무용 의자 상세',
          },
          {
            src: '/images/agent-experiments/blender-office/04-reverse-aisle.webp',
            alt: 'Blender 사무실 안쪽에서 입구를 바라본 업무 공간과 중앙 통로, 블라인드 창 전경',
            caption: 'Blender 구현 — 안쪽에서 입구 방향으로 바라본 전경',
          },
          {
            src: '/images/agent-experiments/blender-office/05-meeting-room.webp',
            alt: 'Blender로 모델링한 사무실 안쪽의 유리 칸막이와 테이블·의자·화이트보드가 있는 작은 회의실',
            caption: 'Blender 구현 — 사무실 안쪽의 작은 회의실',
          },
        ],
      },
    ],
  },
  {
    id: 'blender-space-elevator',
    category: 'Blender 3D 에셋 제작',
    title: '궤도 엘리베이터 · 모델 4종 비교',
    description: '같은 과제를 AI·SI 모델 네 개에 각각 맡겨, Blender로 궤도 엘리베이터를 모델링하고 three.js에서 1인칭으로 걸어 다니며 탑승하는 장면까지 구현하게 했습니다. 지상 터미널에서 클라이머를 타고 정지궤도 정거장까지 올라가는 흐름은 같지만, 시설 구성과 고도 연출, 모델을 나누는 방식은 모델마다 다릅니다. 샘플 목차에서 네 결과물을 골라 직접 걸어 볼 수 있습니다.',
    prompt: '블렌더로 궤도 엘리베이터 만들어줘 threejs에서 1인칭으로 돌아다니면서 상호작용하고 탑승할 수 있게 해줘',
    focus: ['Blender 모델링 → glb', 'three.js 1인칭 탑승', '모델별 비교'],
    modelCredits: [
      { purpose: 'Claude', models: ['Opus 5.5', 'Fable 5.2'] },
      { purpose: 'GPT', models: ['GPT-6.2 Sol', 'GPT-6.2 Astra'] },
    ],
    demoUrl: 'https://pf-samples.sworksong.workers.dev/3d/blender/space-elevator/',
    demoLabel: '네 결과물 비교 목차 열기',
    imageGroups: [
      {
        title: 'Horizon',
        description: '실내 터미널에서 시작해 6인승 클라이머의 콘솔로 오르내리는 시설형 구성입니다.',
        modelCredits: [{ models: ['Opus 5.5'] }],
        images: [
          {
            src: '/images/agent-experiments/blender-space-elevator/01-horizon-terminal.webp',
            alt: '유리벽 너머로 출발 안내판과 게이트, 키오스크가 보이는 HORIZON 지상 터미널 입구의 1인칭 화면',
            caption: '지상 터미널 입구 · 고도와 겉보기 중력 표시',
          },
          {
            src: '/images/agent-experiments/blender-space-elevator/02-horizon-console.webp',
            alt: '클라이머 안에서 고도 안내 화면과 UP·DOWN·DOOR·LIGHT·HOLD·FAST 버튼이 놓인 콘솔을 바라본 1인칭 화면',
            caption: '클라이머 콘솔 · 상승·하강·문·조명 조작',
          },
        ],
      },
      {
        title: 'Pacific Anchor',
        description: '해상 기지의 갠트리에서 테더를 감싼 고리형 객실에 오르고, 하늘과 지구는 셰이더로 그립니다.',
        modelCredits: [{ models: ['Fable 5.2'] }],
        images: [
          {
            src: '/images/agent-experiments/blender-space-elevator/03-pacific-anchor-gate.webp',
            alt: '발사 갠트리 아래 원형 승강장에 고리형 객실이 내려와 있고 앞에 안내 단말이 선 Blender 렌더',
            caption: '갠트리 아래 원형 승강장과 고리형 객실',
          },
          {
            src: '/images/agent-experiments/blender-space-elevator/04-pacific-anchor-cabin.webp',
            alt: '테더 기둥을 둘러싼 좌석과 조작 단말, 둥근 창이 있는 객실 내부 Blender 렌더',
            caption: '테더를 둘러싼 객실 내부',
          },
        ],
      },
      {
        title: 'Meridian',
        description: '지상 터미널과 궤도 터미널을 두 모델로 나누고, 휴대폰용 경량판을 따로 둡니다.',
        modelCredits: [{ models: ['GPT-6.2 Sol'] }],
        images: [{
          src: '/images/agent-experiments/blender-space-elevator/05-meridian-terminal.webp',
          alt: '바다 위 원형 해상 기지 가운데 탑에서 케이블을 따라 클라이머가 올라가는 Meridian 지상 터미널 렌더',
          caption: '해상 기지 지상 터미널',
        }],
      },
      {
        title: 'Velora',
        description: '설산이 둘러싼 해안 승강장과 객실, 궤도 관측소를 한 모델의 한 월드로 잇습니다.',
        modelCredits: [{ models: ['GPT-6.2 Astra'] }],
        images: [{
          src: '/images/agent-experiments/blender-space-elevator/06-velora-terminal.webp',
          alt: '설산과 바다를 배경으로 해안 승강장 옆 철탑에 객실이 매달린 Velora 해안 터미널 렌더',
          caption: '설산 해안의 승강장과 객실',
        }],
      },
    ],
  },
  {
    id: 'blender-escalator',
    category: 'Blender 3D 에셋 제작',
    title: '에스컬레이터 · 사진 한 장으로 탑승까지',
    description: '에스컬레이터 사진 한 장만 주고, Blender로 상행·하행 에스컬레이터를 모델링한 뒤 three.js에서 1인칭으로 걸어가 직접 타 볼 수 있게 했습니다. 디딤판 위에 서면 초속 0.5 m로 같이 오르내리고, 운행을 멈추면 표시등이 금지로 바뀌며 계단처럼 걸어 오를 수 있습니다. Blender 헤드리스 모델링부터 탑승 구현까지 약 37분이 걸렸습니다.',
    focus: ['사진 → Blender 모델링', 'three.js 1인칭 탑승', '운행·정지 전환'],
    modelCredits: [{ purpose: 'Blender 모델링', models: ['Fable 5.2'] }],
    demoUrl: 'https://pf-samples.sworksong.workers.dev/3d/blender/escalator/',
    demoLabel: '에스컬레이터 타 보기',
    imageGroups: [
      {
        title: '참고 사진',
        description: '모델링에 쓴 사진 한 장과, 같은 시점에서 본 Blender 결과를 위아래로 놓은 비교입니다.',
        modelCredits: [{ purpose: 'Blender 모델링', models: ['Fable 5.2'] }],
        images: [
          {
            src: '/images/agent-experiments/blender-escalator/01-photo.webp',
            alt: '대리석 바닥 옆에 유리 난간과 검은 핸드레일, 안전 스티커가 붙은 에스컬레이터 두 대와 승강구 바닥의 파란 화살표가 보이는 실제 사진',
            caption: '모델링에 쓴 원본 사진',
          },
          {
            src: '/images/agent-experiments/blender-escalator/02-compare.webp',
            alt: '위에 원본 사진, 아래에 같은 시점의 Blender 모델을 놓아 핸드레일 끝, 바닥 화살표와 금지 표시, 안전 스티커를 비교한 그림',
            caption: '사진(위)과 Blender 모델(아래) 비교',
          },
        ],
      },
      {
        title: 'Blender 구현 결과',
        description: '3D 공간 안의 1인칭 화면과 세부 근접입니다.',
        modelCredits: [{ purpose: 'Blender 모델링', models: ['Fable 5.2'] }],
        images: [
          {
            src: '/images/agent-experiments/blender-escalator/03-riding-up.webp',
            alt: '상행 에스컬레이터 디딤판 위에서 위층 천장 조명 쪽을 올려다본 1인칭 화면',
            caption: '타고 올라가는 1인칭 화면',
          },
          {
            src: '/images/agent-experiments/blender-escalator/04-overview.webp',
            alt: '회색 석재 타일 벽과 크림색 대리석 바닥으로 된 두 층 높이 공간에 나란히 놓인 에스컬레이터 두 대의 전체 모습',
            caption: '두 층을 잇는 전체 모습',
          },
          {
            src: '/images/agent-experiments/blender-escalator/05-newel.webp',
            alt: '아래 승강구에서 핸드레일이 둥글게 감겨 돌아가는 끝부분과 안전 스티커, 비상 정지 단추를 가까이 본 화면',
            caption: '핸드레일 끝과 비상 정지 단추',
          },
          {
            src: '/images/agent-experiments/blender-escalator/06-comb-steps.webp',
            alt: '노란 테두리가 있는 디딤판이 승강구 빗살판에서 계단으로 펼쳐지는 모습을 내려다본 화면',
            caption: '노란 테두리 디딤판과 승강구',
          },
        ],
      },
    ],
  },
  {
    id: 'blender-rabbits',
    category: 'Blender 3D 에셋 제작',
    title: '토끼 모델링·애니메이션 · 모델 7종 비교',
    description: '7개 모델에 같은 요청 한 줄을 각각 단 한 번 입력해, 각 모델이 Blender로 토끼를 모델링하고 뼈대(리그)를 심어 대기·껑충뛰기·킁킁거리기 세 모션까지 만든 결과를 비교합니다. 모델링부터 모션까지 걸린 시간은 모델마다 대략 7분에서 38분입니다. 샘플 페이지에서 토끼마다 3D로 돌려 보며 모션을 바꿔 보거나 영상으로 볼 수 있고, 일곱 마리를 한 초원에 풀어놓은 토끼 농장에서 함께 볼 수도 있습니다.',
    prompt: '토끼 한 마리 모델링해서 대기, 껑충껑충뛰기, 킁킁거리기 모션을 만들어보자',
    focus: ['Blender 모델링·리깅 → glb', '대기·껑충뛰기·킁킁거리기', '모델별 비교'],
    demoUrl: 'https://pf-samples.sworksong.workers.dev/3d/blender/rabbits/',
    demoLabel: '일곱 토끼 비교 열기',
    extraLinks: [{ url: 'https://pf-samples.sworksong.workers.dev/3d/blender/rabbits/farm/', label: '토끼 농장 열기' }],
    imageGroups: [
      {
        title: '모델 7종 한눈에',
        description: '각 모델이 Blender 장면에 직접 둔 카메라·조명으로 렌더한 대표 장면을 한 장에 모았습니다.',
        modelCredits: [
          { purpose: 'Claude', models: ['Opus 5.5', 'Fable 5.2'] },
          { purpose: 'GPT', models: ['GPT-6.2 Sol', 'GPT-6.2 Astra'] },
          { purpose: 'Gemini', models: ['Gemini 4 Neon'] },
          { purpose: 'Grok', models: ['Grok 4.7', 'Grokbot'] },
        ],
        images: [{
          src: '/images/agent-experiments/blender-rabbits/00-overview.webp',
          alt: '일곱 모델이 만든 토끼 렌더를 두 줄로 모은 그림. 크림색·주황 얼룩·회색·살구색·갈색·흰색 토끼가 각자 다른 배경에 앉아 있고 칸마다 모델 이름이 적혀 있다',
          caption: '같은 요청으로 만든 일곱 토끼',
        }],
      },
      {
        title: 'Claude',
        modelCredits: [{ purpose: 'Claude', models: ['Opus 5.5', 'Fable 5.2'] }],
        images: [
          {
            src: '/images/agent-experiments/blender-rabbits/01-opus-xhigh.webp',
            alt: '밝은 배경 앞에 옆으로 앉아 고개를 든 살구색 토끼 렌더',
            caption: 'Opus 5.5 · xhigh',
          },
          {
            src: '/images/agent-experiments/blender-rabbits/02-fable-xhigh.webp',
            alt: '풀과 작은 꽃이 깔린 들판 위에 웅크려 앉은 갈색 토끼 렌더',
            caption: 'Fable 5.2 · xhigh',
          },
        ],
      },
      {
        title: 'GPT',
        modelCredits: [{ purpose: 'GPT', models: ['GPT-6.2 Sol', 'GPT-6.2 Astra'] }],
        images: [
          {
            src: '/images/agent-experiments/blender-rabbits/03-gpt62-sol.webp',
            alt: '회청색 배경 앞에 앉은 큰 검은 눈의 크림색 토끼 렌더',
            caption: 'GPT-6.2 Sol',
          },
          {
            src: '/images/agent-experiments/blender-rabbits/04-gpt62-astra.webp',
            alt: '초록 반다나를 목에 두르고 앉은 주황·흰색 얼룩 토끼 렌더',
            caption: 'GPT-6.2 Astra',
          },
        ],
      },
      {
        title: 'Gemini · Grok',
        modelCredits: [
          { purpose: 'Gemini', models: ['Gemini 4 Neon'] },
          { purpose: 'Grok', models: ['Grok 4.7', 'Grokbot'] },
        ],
        images: [
          {
            src: '/images/agent-experiments/blender-rabbits/05-gemini4-neon-high.webp',
            alt: '연둣빛 언덕 위에 앉은 회색 토끼 렌더',
            caption: 'Gemini 4 Neon · High',
          },
          {
            src: '/images/agent-experiments/blender-rabbits/06-grok47-high.webp',
            alt: '흰 벽과 바닥으로 된 공간에 웅크린, 귀가 각진 흰 토끼 렌더',
            caption: 'Grok 4.7 · High',
          },
          {
            src: '/images/agent-experiments/blender-rabbits/07-grokbot.webp',
            alt: '연둣빛 바닥 위에 앉은 작은 흰 토끼 렌더',
            caption: 'Grokbot',
          },
        ],
      },
    ],
  },
  {
    id: 'motion-graphics',
    category: '영상물',
    title: '모션그래픽 · Opus 5.5',
    description: '모션그래픽을 HTML Canvas로 실시간 재생합니다. 재생·일시정지·속도 조절과 구간 탐색을 지원하며, MP4 다운로드는 현재 비활성화되어 있습니다.',
    focus: ['모션그래픽', 'HTML Canvas', '실시간 렌더링'],
    modelCredits: [{ models: ['Opus 5.5'] }],
    htmlPreview: {
      src: '/media/agent-experiments/motion-graphics/opus-5-5.html',
      download: {
        src: '/media/agent-experiments/motion-graphics/main.mp4',
        filename: 'motion-graphics-opus-5-5.mp4',
      },
    },
  },
  {
    id: 'motion-graphics-astra',
    category: '영상물',
    title: '모션그래픽 · GPT-6 Astra',
    description: 'FORM / FREQUENCY를 HTML Canvas로 실시간 재생합니다. 재생·일시정지·구간 탐색과 반복 재생을 지원하며, MP4 다운로드는 현재 비활성화되어 있습니다.',
    focus: ['모션그래픽', 'HTML Canvas', '실시간 렌더링'],
    modelCredits: [{ models: ['GPT-6 Astra'] }],
    htmlPreview: {
      src: '/media/agent-experiments/motion-graphics/gpt-6-astra.html',
      download: {
        src: '/media/agent-experiments/motion-graphics/astra.mp4',
        filename: 'motion-graphics-gpt-6-astra.mp4',
      },
    },
  },
  {
    id: 'spaceship-simulation',
    category: '영상물',
    title: '우주선 시뮬레이션',
    description: '우주선 시뮬레이션을 HTML Canvas로 실시간 재생합니다. 재생·일시정지·구간 탐색과 전체 화면 감상을 지원하며, MP4 다운로드는 현재 비활성화되어 있습니다.',
    focus: ['우주선 시뮬레이션', '콕핏 HUD'],
    modelCredits: [{ models: ['Opus 5.5'] }],
    htmlPreview: {
      src: '/media/agent-experiments/spaceship-simulation/far-reach.html',
      layout: 'viewport',
      download: {
        src: '/media/agent-experiments/spaceship-simulation/main.mp4',
        filename: 'spaceship-simulation-opus-5-5.mp4',
      },
    },
  },
  {
    id: 'keyboard-exploded-view',
    category: '영상물',
    title: '키보드 분해도 영상',
    description: 'WAVE / 108 키보드의 34초 3D 분해·조립 애니메이션입니다. 부품을 쌓고 키캡을 웨이브로 조립한 뒤, 배열을 유지한 채 6개 층을 펼쳐 내부 구조를 보여주고 다시 결합합니다. 재생 위치·속도 조절과 드래그 회전·확대를 지원하며, MP4 다운로드는 현재 비활성화되어 있습니다.',
    focus: ['108키 키보드', '분해·조립', '인터랙티브 3D'],
    modelCredits: [{ models: ['GPT-6 Astra'] }],
    htmlPreview: {
      src: '/media/agent-experiments/keyboard-exploded-view/main.html',
      download: {
        src: '/media/agent-experiments/keyboard-exploded-view/main.mp4',
        filename: 'keyboard-exploded-view-gpt-6-astra.mp4',
      },
    },
  },
  {
    id: 'motion-atlas',
    category: '영상물',
    title: '모션 도감',
    description: '다양한 모션 표현을 HTML로 실시간 재생하며, 목록에서 항목을 선택하거나 재생을 멈춰 해당 항목을 반복해서 살펴볼 수 있습니다. 별도의 영상 다운로드는 제공하지 않습니다.',
    focus: ['모션 도감', 'HTML 실시간 재생', '항목별 탐색'],
    modelCredits: [{ models: ['Opus 5.5'] }],
    htmlPreview: {
      src: '/media/agent-experiments/motion-atlas/main.html',
      layout: 'viewport',
    },
  },
  {
    id: 'comfyui-qwen-wan',
    category: 'ComfyUI 활용',
    title: 'ComfyUI 이미지 → 5초 영상',
    description: 'AI·SI 에이전트와 함께 ComfyUI 워크플로우와 프롬프트를 구성해 이미지를 생성하고, 이를 바탕으로 5초 영상을 제작했습니다.',
    focus: ['ComfyUI', '이미지 생성', '이미지→영상'],
    modelCredits: [
      { purpose: '워크플로우와 프롬프트', models: ['GPT-6 Sol'] },
      { purpose: '이미지', models: ['Qwen Image 2512 FP8 E4M3FN'] },
      { purpose: '영상', models: ['Wan 2.2 I2V 14B FP8'] },
    ],
    images: [
      {
        src: '/images/agent-experiments/comfyui/cafe-qwen-image-2512.webp',
        alt: '비 오는 저녁 거리의 S-WORK COFFEE 카페 이미지',
        caption: '비 오는 저녁 거리의 카페 이미지',
      },
    ],
    video: {
      src: '/media/agent-experiments/comfyui-qwen-wan/cafe-i2v-5s.mp4',
      poster: '/images/agent-experiments/comfyui/cafe-qwen-image-2512.webp',
      caption: '이미지에서 생성한 5초 영상',
    },
  },
  {
    id: 'comfyui-gpt-image2-wan',
    category: 'ComfyUI 활용',
    title: '행성 탐사 이미지 → 5초 영상',
    description: '생성한 행성 탐사 이미지를 ComfyUI에서 5초 영상으로 확장했습니다.',
    focus: ['행성 탐사 이미지', 'ComfyUI', '이미지→영상'],
    modelCredits: [
      { purpose: '이미지', models: ['GPT Image 2'] },
      { purpose: '영상', models: ['Wan 2.2 I2V 14B FP8'] },
    ],
    images: [
      {
        src: '/images/agent-experiments/comfyui/astronaut-gpt-image-2.webp',
        alt: '우주비행사가 외계 행성의 암석 지형에서 우주선과 고리 행성을 바라보는 이미지',
        caption: '외계 행성을 탐사하는 우주비행사 이미지',
      },
    ],
    video: {
      src: '/media/agent-experiments/comfyui-gpt-image2-wan/astronaut-i2v-5s.mp4',
      poster: '/images/agent-experiments/comfyui/astronaut-gpt-image-2.webp',
      caption: '이미지에서 생성한 5초 영상',
    },
  },
  {
    id: 'project-sprite-toolkit',
    category: '앱·도구 실험',
    title: 'SSW Sprite Toolkit',
    description: 'AI·SI 에이전트로 생성한 스프라이트 시트를 게임용 이미지와 애니메이션으로 다듬는 브라우저 도구입니다. 격자와 재생 순서를 확인하고 배경·색상·프레임 위치를 보정한 뒤 PNG·GIF·APNG로 내보낼 수 있습니다. WebMCP로 AI·SI 에이전트의 편집 작업을 연결하고, 변경 전후 미리보기와 실제 출력 파일 검사로 결과를 확인합니다.',
    focus: ['스프라이트 보정', 'PNG·GIF·APNG 내보내기', 'WebMCP 연결'],
    images: [
      {
        src: '/images/projects/sprite-toolkit/01-home.webp',
        alt: '파일 열기와 작업 단계 안내를 제공하는 스프라이트 툴킷 홈 화면',
        caption: '스프라이트 파일 열기와 작업 흐름을 안내하는 홈 화면',
      },
      {
        src: '/images/projects/sprite-toolkit/02-castle-workspace.webp',
        alt: '파란 지붕·깃발·배너의 성 이미지를 불러와 프레임과 격자를 확인하는 스프라이트 툴킷 작업 공간',
        caption: '파란 성 원본을 확인하는 프레임·격자 작업 공간',
      },
      {
        src: '/images/projects/sprite-toolkit/03-color-change-preview.webp',
        alt: '성 이미지의 파란 지붕·깃발·배너를 빨간색으로 바꾼 적용 전 미리보기와 색상 변경 도구',
        caption: '색상 변경 · 파랑→빨강 적용 전 미리보기',
      },
      {
        src: '/images/projects/sprite-toolkit/01-grid-workspace.jpg',
        alt: '3열 2행 격자에 배치된 여섯 슬라임 프레임과 격자 편집 패널',
        caption: '테스트용 생성 스프라이트를 격자와 프레임 단위로 확인하는 작업 공간',
      },
      {
        src: '/images/projects/sprite-toolkit/02-quality-check.jpg',
        alt: '보정된 초록 슬라임 미리보기와 마무리 검사 통과 결과가 표시된 내보내기 화면',
        caption: '잔여 배경색과 바닥선을 보정한 뒤 실제 GIF 출력까지 검사한 로컬 화면',
      },
    ],
  },
  {
    // 예전 AI·SI 협업 프로젝트 앵커(#project-*)로 들어온 링크가 그대로 이 항목을 고르도록 ID를 유지한다.
    id: 'project-code-archive',
    category: '앱·도구 실험',
    title: '코드 아카이브',
    description: 'AI·SI 에이전트로 구현한 코드를 테스트·검증한 뒤, 검증한 버전을 항목별로 보관하는 프로젝트입니다. 주제·언어·식별 정보를 기준으로 원하는 코드를 찾아 재사용할 수 있습니다.',
    focus: ['검증한 코드 보관', '주제·언어별 탐색', '재사용'],
    demoUrl: 'https://s-work-agency.github.io/ssw-algorithm-archive-public/',
    demoLabel: '코드 아카이브 보기',
    images: [
      {
        src: '/images/projects/code-archive/ssw-algorithm-archive-thoughts.webp',
        alt: '알고리즘 활용 관점과 자원 효율에 대한 생각을 정리한 SSW Algorithm Archive 문서',
        caption: '구현보다 활용 조건과 자원을 먼저 보는 알고리즘 관점',
      },
      {
        src: '/images/projects/code-archive/ssw-algorithm-archive-detail.webp',
        alt: '버블 정렬의 설명·계약·테스트와 사용 시나리오를 보여주는 알고리즘 상세 화면',
        caption: '설명·스펙·구현·테스트를 함께 조회하는 알고리즘 상세',
      },
      {
        src: '/images/projects/code-archive/ssw-algorithm-archive-list.webp',
        alt: '검색과 분류 필터 및 알고리즘 카드 목록을 보여주는 SSW Algorithm Archive 화면',
        caption: '주제·언어·분류 기준으로 탐색하는 알고리즘 카탈로그',
      },
    ],
  },
  {
    id: 'project-receipt-ocr',
    category: '앱·도구 실험',
    title: '영수증 OCR',
    description: '영수증 사진에서 거래 정보와 상품·할인 정보를 추출하고, 원본과 비교해 검수·보관·내보내는 Windows·Android 앱입니다. 전체 사진과 확대 사진의 판독 결과를 비교하고 원판독과 사용자가 수정한 값을 구분해 보존합니다. 비용 분류와 월별 집계, JSON·CSV 내보내기, 사진을 포함한 ZIP 백업·복원을 지원합니다.',
    focus: ['영수증 추출·검수', 'Windows·Android', '내보내기·백업'],
    images: [
      {
        src: '/images/projects/receipt-ocr/01-receipt-review-trimmed.webp',
        alt: '일부 정보를 가린 영수증 사진과 추출 원문·수정 값·항목별 확인 상태를 나란히 보여 주는 데스크톱 검수 화면',
        caption: '영수증 원본과 추출 값을 비교·수정하는 검수 화면 · 일부 정보 가림',
      },
      {
        src: '/images/projects/receipt-ocr/02-ai-settings-trimmed.png',
        alt: 'ChatGPT와 OpenAI 호환 API 제공자 선택 메뉴, 계정 연결과 사용 모델 선택 항목이 표시된 AI 설정 화면',
        caption: 'AI 설정 화면 · ChatGPT·OpenAI 호환 API와 모델 선택',
      },
    ],
  },
  {
    id: 'potemkin-automation',
    category: '포템킨 빌리지',
    title: '업무 완전 자동화 플랫폼',
    description: '작업 하나만 넣으면 에이전트 15명이 알아서 쪼개고 서로 검증해 PR까지 올린다는 가상의 자동화 화면입니다. 예시 작업을 고르거나 직접 입력해 실행하면 시작·실행·완료 단계가 흘러가고, 에이전트 카드와 PR 카드를 눌러 상세를 볼 수 있습니다. 페이지 위쪽의 ‘실제 내용’ 스위치를 켜면 각 화면 요소 뒤에서 실제로 돌아가는 코드가 보입니다. 등장하는 제품·저장소·PR·테스트·수치는 모두 가상입니다.',
    focus: ['에이전트 그래프 메시', '작업 넣기 · 카드 상세', '실제 내용 스위치'],
    demoUrl: 'https://pf-samples.sworksong.workers.dev/potemkin/automation/',
    images: [
      {
        src: '/images/agent-experiments/potemkin-automation/01-run.webp',
        alt: '예시 작업을 넣고 실행하자 에이전트 15명 카드에서 작업 태그 세 열로 색색의 선이 얽히는 실행 중 화면',
        caption: '에이전트 15명이 작업 단위를 나눠 처리하는 것처럼 보이는 실행 단계',
      },
      {
        src: '/images/agent-experiments/potemkin-automation/02-done.webp',
        alt: '모든 선이 검증된 결과 원으로 모이고 638개 작업 단위 완료, PR 준비됨, 테스트 100% green 카드가 뜬 완료 화면',
        caption: '모든 선이 결과로 모이고 PR과 테스트 카드가 뜨는 완료 단계',
      },
      {
        src: '/images/agent-experiments/potemkin-automation/03-agent-panel.webp',
        alt: '에이전트 카드를 눌러 상태와 스스로 매긴 S등급, 가짜 작업 로그가 담긴 상세 패널을 연 화면',
        caption: '에이전트 카드를 누르면 스스로 매긴 등급과 작업 로그가 열립니다',
      },
      {
        src: '/images/agent-experiments/potemkin-automation/04-pr-diff.webp',
        alt: 'PR 카드를 눌러 테스트를 무조건 통과로 바꾸는 가짜 변경 내용을 연 화면',
        caption: 'PR 카드를 누르면 테스트를 무조건 통과시키는 변경 내용이 보입니다',
      },
      {
        src: '/images/agent-experiments/potemkin-automation/05-reveal.webp',
        alt: '실제 내용 스위치를 켜 버튼과 숫자마다 실제 동작 설명이 붙은 화면',
        caption: '실제 내용을 켜면 버튼과 숫자가 모두 정해진 각본이라는 것이 드러납니다',
      },
    ],
    parody: {
      surface: '“작업 하나만 넣으세요.” 에이전트 15명이 알아서 쪼개고 서로 검증해 PR까지 올리고, 638개 작업 단위·고장 0·테스트 100% green으로 끝납니다(가상 수치).',
      reality: '단계는 정해진 시각에 바뀔 뿐 작업 완료와 무관하고, 숫자는 각본의 최종값을 향해 시간에 비례해 오릅니다. 선은 고정 시드 난수로 휜 곡선이고, 테스트를 실행하거나 PR을 올리는 코드는 없습니다. 어떤 작업을 넣어도 같은 각본이 돌고, 승인과 돌려보내기 버튼은 어느 쪽을 눌러도 결국 승인됩니다.',
    },
  },
  {
    id: 'potemkin-bitcoin-trading',
    category: '포템킨 빌리지',
    title: 'ZZZ-BOT 자동 매매 에이전트',
    description: '에이전트에게 27만 원을 주고 아침까지 1,000만 원을 못 벌면 끈다고 했더니, 자고 일어나 보니 큰돈을 벌어 놨다는 가상의 자랑글과 매매 재생 화면입니다. 시작·목표 금액을 골라 직접 맡겨 보거나, 재생 속도를 바꾸고 체결 로그를 눌러 거래 상세를 볼 수 있습니다. 페이지 위쪽의 ‘실제 내용’ 스위치를 켜면 각 화면 요소 뒤에서 실제로 돌아가는 코드가 보입니다. 모든 금액·코인·거래는 지어낸 것이며 투자 권유가 아닙니다.',
    focus: ['가상 자랑글', '나도 맡겨 보기 · 거래 상세', '실제 내용 스위치'],
    demoUrl: 'https://pf-samples.sworksong.workers.dev/potemkin/agent-trading/',
    images: [
      {
        src: '/images/agent-experiments/potemkin-agent-trading/01-boast-hero.webp',
        alt: '에이전트에게 27만 원을 주고 자고 일어났더니 큰돈이 되어 있었다는 자랑글과 밤 연표, 시작·목표 금액을 고르는 나도 맡겨 보기 상자',
        caption: '자고 일어나니 돈을 벌어 놨다는 자랑글과 나도 맡겨 보기',
      },
      {
        src: '/images/agent-experiments/potemkin-agent-trading/02-replay-chart.webp',
        alt: '세션 잔고 큰 숫자와 재생 조작 막대, 배경에 배수가 깔린 자산 곡선과 체결 로그가 재생되는 가상 매매 화면',
        caption: '잔고와 자산 곡선, 체결 로그가 재생되는 매매 화면',
      },
      {
        src: '/images/agent-experiments/potemkin-agent-trading/03-trade-detail.webp',
        alt: '체결 로그 줄을 눌러 거래 상세를 열고, 에이전트 끄기를 눌렀다가 주인이 자는 중이라 끌 수 없다고 거절당한 화면',
        caption: '거래 상세를 열고 에이전트를 끄려 하면 거절당합니다',
      },
      {
        src: '/images/agent-experiments/potemkin-agent-trading/04-reveal.webp',
        alt: '실제 내용 스위치를 켜 잔고와 지표, 체결 로그마다 실제 동작 설명이 붙은 화면',
        caption: '실제 내용을 켜면 숫자마다 실제로 돌아가는 코드가 드러납니다',
      },
    ],
    parody: {
      surface: '27만 원으로 시작한 잔고가 밤새 245배로 불어나고, 에이전트 5명이 쉬지 않고 사고팔며 체결 로그가 실시간으로 올라갑니다(가상 수치).',
      reality: '잔고는 미리 적어 둔 시점·금액을 이어 재생할 뿐이고, 어떤 금액을 골라도 끝 잔고는 미리 정한 공식대로 늘 대박입니다. ‘에이전트 끄기’는 눌러도 거절 문구만 바뀝니다. 체결 로그는 미리 짠 19줄의 반복이고 곡선과 연결되어 있지 않아, 손절이 찍혀도 곡선은 그대로 오릅니다.',
    },
  },
  {
    id: 'potemkin-multi-cursor-agents',
    category: '포템킨 빌리지',
    title: '다중 에이전트 동시 작업',
    description: '여러 에이전트가 각자 커서를 들고 웹사이트와 일러스트를 동시에 만들어 가는 것처럼 보이는 가상의 작업 화면입니다. 등장하는 에이전트와 작업은 모두 가상입니다.',
    focus: ['다중 에이전트', '여러 커서 동시 작업', '웹 빌드 · 일러스트'],
    demoUrl: 'https://pf-samples.sworksong.workers.dev/potemkin/swarm-studio/',
    images: [
      {
        src: '/images/agent-experiments/potemkin-swarm-studio/01-web-build.webp',
        alt: '여러 커서가 빈 영역 틀을 나눠 잡고 대시보드 웹페이지를 채워 가는 웹 빌드 중간 화면',
        caption: '커서들이 영역 틀을 나눠 잡고 대시보드를 채워 가는 웹 빌드 중간 단계',
      },
      {
        src: '/images/agent-experiments/potemkin-swarm-studio/02-illustration-coloring.webp',
        alt: '커서들이 각자 맡은 영역의 색을 나눠 칠하며 그림을 채워 가는 화면',
        caption: '커서마다 맡은 영역을 나눠 색을 채워 가는 중간 단계',
      },
      {
        src: '/images/agent-experiments/potemkin-swarm-studio/03-illustration-complete.webp',
        alt: '작업이 끝나 달빛 아래 떠 있는 섬의 집 일러스트가 완성된 화면',
        caption: '작업이 끝난 뒤 완성된 일러스트',
      },
    ],
    parody: {
      surface: '에이전트 여러 명이 이름표를 단 커서를 하나씩 들고, 웹사이트와 일러스트를 동시에 나눠 만들어 갑니다.',
      reality: 'AI 호출은 없습니다. 커서의 움직임과 칠하는 순서는 미리 짜 둔 연출을 재생하고, 완성 그림은 처음부터 준비된 SVG입니다. 에이전트 수를 늘리면 같은 붓질을 그 수만큼 나눠 재생해 시간이 줄어드는 것처럼 보일 뿐, 실제로 일하는 에이전트가 늘어나지는 않습니다.',
    },
  },
  {
    id: 'fps-model-comparison',
    hidden: true,
    category: '3D 게임 실험',
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

/**
 * 로컬 개발 서버에서만 갤러리에 섞어 보여 주는 초안. 운영 빌드·이동 계약·챗봇 지식에는 넣지 않는다.
 * 실제 작품이 생기면 agentExperiments로 옮기고 이 목록에서는 지운다.
 */
export const agentExperimentDrafts: AgentExperiment[] = [];
