/**
 * About 개요 카드의 콘텐츠 계약과 이동 경로를 보관하는 불변 데이터 모듈이다.
 * React와 표현 스타일에 의존하지 않으며, 개요 페이지는 배열 순회만 수행하므로
 * 섹션 추가가 기존 카드 JSX 수정으로 이어지지 않는다(OCP).
 */

export interface AboutDestination {
  title: string;
  href: string;
  desc: string;
  emoji: string;
  linkText: string;
}

export interface AboutProject {
  id: string;
  title: string;
  category: string;
  desc: string;
  status: string;
  statusTone?: 'default' | 'warning';
  gallery?: AboutProjectGallery;
  links?: AboutProjectLink[];
}

export interface AboutProjectGallery {
  images: AboutProjectImage[];
  placeholder: string;
}

export interface AboutProjectImage {
  src: string;
  alt: string;
  caption?: string;
}

export interface AboutProjectLink {
  label: string;
  href: string;
  kind: 'repository' | 'demo';
}

export interface AboutArchiveProject {
  id: string;
  title: string;
  category: string;
  desc: string;
  status: string;
  tags: string[];
  wide?: boolean;
  preview: {
    eyebrow: string;
    title: string;
    hint: string;
  };
  gallery?: AboutProjectGallery;
  videos?: AboutArchiveProjectVideo[];
  videoSlotCount?: number;
  logHref?: string;
  demo?: {
    src: string;
    title: string;
    controls: string;
  };
}

export interface AboutArchiveProjectVideo {
  src: string;
  poster: string;
  title: string;
  caption: string;
}

export const aboutDestinations: AboutDestination[] = [
  {
    title: '이력서 (Resume)',
    href: '/about-me/resume',
    desc: '송상운의 직무 전문성, 실무 경력(라이트소프트, 큐브에이, 너울정보 등) 및 핵심 기술 스택을 정리한 공식 이력서입니다.',
    emoji: '📄',
    linkText: '이력서 확인하기 →',
  },
  {
    title: '자기소개서 (Cover Letter)',
    href: '/about-me/cover-letter',
    desc: '문제를 발견하고 집요하게 끝까지 해결해 나가는 엔지니어링 철학과 인생의 터닝포인트, 저만의 가치관이 담겨 있습니다.',
    emoji: '✍️',
    linkText: '자기소개서 읽기 →',
  },
  {
    title: '연구 경험 (Research)',
    href: '/about-me/research',
    desc: '하드웨어 한계 돌파(오버클럭, RAID 0)부터 로우레벨 소프트웨어 최적화(SIMD, AVX2, CUDA) 및 AI 에이전트 오케스트레이션 실험 로그입니다.',
    emoji: '🔬',
    linkText: '연구 경험 보러 가기 →',
  },
  {
    title: '기록 (Log)',
    href: '/about-me/log',
    desc: '개발 및 일상 속에서 얻은 기술적 깨달음과 고민, 프로젝트를 되돌아보는 사후 회고를 기록하는 로그 블로그입니다.',
    emoji: '📝',
    linkText: '로그 게시글 읽기 →',
  },
];

export const aboutArchiveProjects: AboutArchiveProject[] = [
  {
    id: 'archive-canvas-dodge-game',
    title: 'Canvas 피하기 게임',
    category: 'Canvas Game',
    desc: 'HTML Canvas와 JavaScript로 캐릭터를 조작해 장애물을 피하고 생존 시간을 기록하는 작은 브라우저 게임입니다. 당시의 단일 HTML 구현을 그대로 실행할 수 있습니다.',
    status: '단일 HTML 원본 실행',
    tags: ['HTML', 'Canvas', 'JavaScript'],
    preview: {
      eyebrow: 'Playable Archive',
      title: '방향키로 장애물을 피하세요',
      hint: '키보드 방향키 · 화면 방향 버튼',
    },
    gallery: {
      images: [
        {
          src: '/images/archive/canvas-dodge-game/01-gameplay.webp',
          alt: '막대 인간 캐릭터가 위에서 떨어지는 장애물을 피하는 Canvas 게임 화면',
          caption: '방향키로 캐릭터를 움직여 떨어지는 장애물을 피하는 실행 화면',
        },
      ],
      placeholder: 'Canvas 피하기 게임 실행 화면을 추가할 자리입니다.',
    },
    logHref: '/about-me/log/canvas-dodge-game-before-game-development',
    demo: {
      src: '/showcases/canvas-dodge-game/index.html?v=1',
      title: 'Canvas 피하기 게임 실행 화면',
      controls: '시작을 누른 뒤 키보드 방향키 또는 화면 방향 버튼으로 조작할 수 있습니다.',
    },
  },
  {
    id: 'archive-wpf-excel-row-mapper',
    title: '엑셀 행 매핑 WPF 앱',
    category: 'WPF Desktop App',
    desc: '반복적인 엑셀 작업의 생산성을 높이기 위해 행 데이터를 작업 모델에 자동 매핑하는 WinForms 프로토타입을 만든 뒤, WPF MVVM 구조로 마이그레이션해 실제 작업에 사용한 데스크톱 앱입니다.',
    status: '실사용 화면 보관',
    tags: ['C#', 'WPF', 'MVVM', 'Excel'],
    preview: {
      eyebrow: 'Desktop Archive',
      title: '엑셀 행 데이터 자동 매핑기',
      hint: 'WPF · MVVM · 업무 도구',
    },
    gallery: {
      images: [
        {
          src: '/images/archive/wpf-excel-row-mapper/01-main.webp',
          alt: '주소 데이터 조회와 파일별 매핑 옵션을 구성하는 엑셀 행 매핑 WPF 앱 화면',
          caption: '엑셀 작업용 유틸 앱',
        },
      ],
      placeholder: '엑셀 행 매핑 WPF 앱 캡처를 여기에 추가할 예정입니다.',
    },
    logHref: '/about-me/log/excel-row-mapping-wpf-app',
  },
  {
    id: 'archive-android-ar-campfire',
    title: 'Android AR 캠프파이어 앱',
    category: 'Android AR',
    desc: 'VR 게임 학원 수강 중 현실 공간 위에 캠프파이어 장면을 증강현실로 표시하도록 제작한 Android 앱입니다. 대표 시연 영상과 설치·점화·전경 장면을 함께 보관했습니다.',
    status: 'VR 게임 학원 제작 · 시연 영상·화면 보관',
    tags: ['Android', 'AR', 'Mobile'],
    wide: true,
    preview: {
      eyebrow: 'Mobile Archive',
      title: 'AR 캠프파이어 시연',
      hint: 'Android · Augmented Reality',
    },
    videos: [
      {
        src: '/media/archive/android-ar-campfire/02-campfire-view.mp4',
        poster: '/images/archive/android-ar-campfire/03-final-background.webp',
        title: 'AR 캠프파이어 전체 시연',
        caption: '전체 시연 영상 보기',
      },
    ],
    gallery: {
      images: [
        {
          src: '/images/archive/android-ar-campfire/01-placement-focus.webp',
          alt: 'AR 캠프파이어를 설치하기 위해 평면과 위치를 인식하는 포커스 화면',
          caption: 'AR 평면을 인식하고 설치 위치를 조정하는 포커스 화면',
        },
        {
          src: '/images/archive/android-ar-campfire/02-ignition-balanced.webp',
          alt: '나뭇가지를 추가하고 점화한 AR 캠프파이어의 근접 화면',
          caption: '나뭇가지를 추가하고 점화한 캠프파이어 근접 화면',
        },
        {
          src: '/images/archive/android-ar-campfire/03-final-background.webp',
          alt: '캠프파이어와 주변 나무 및 건물이 함께 보이는 AR 전경 화면',
          caption: '캠프파이어와 주변 공간·건물을 함께 확인하는 전경',
        },
      ],
      placeholder: 'Android AR 캠프파이어 앱 화면을 추가할 자리입니다.',
    },
    videoSlotCount: 4,
    logHref: '/about-me/log/first-ar-project-using-real-space-and-motion',
  },
];

export const aboutProjects: AboutProject[] = [
  {
    id: 'project-common-infrastructure',
    title: '공용 인프라 프로젝트군',
    category: 'Shared Infrastructure',
    desc: '인증·채팅·파일·미디어·알림·분석과 게이트웨이·설정·스케줄링·관측 기능을 여러 프로젝트에서 재사용할 수 있도록 분리한 프로젝트군입니다.',
    status: '공개 저장소 운영 중',
    gallery: {
      images: [
        {
          src: '/images/projects/common-infrastructure/ssw-infra-login.webp',
          alt: '테넌트 ID와 계정 정보를 입력하는 SSW Infra Console 로그인 화면',
          caption: '테넌트 ID와 계정 정보를 입력하는 통합 콘솔 로그인',
        },
        {
          src: '/images/projects/common-infrastructure/ssw-infra-tenant.webp',
          alt: '테넌트별 서비스 토큰과 온보딩 상태를 관리하는 SSW Infra Console 화면',
          caption: '제품 단위로 분리한 테넌트와 서비스 토큰 관리',
        },
        {
          src: '/images/projects/common-infrastructure/ssw-chat-operator.webp',
          alt: '실시간 상담 대기열과 활성 상담을 처리하는 SSW Infra 채팅 상담원 콘솔 화면',
          caption: 'WebSocket 응답과 상담 대기열을 통합한 채팅 상담원 콘솔',
        },
      ],
      placeholder: '공용 인프라 프로젝트 화면을 추가할 자리입니다.',
    },
    links: [
      {
        label: 'GitHub 저장소',
        href: 'https://github.com/s-work-agency/ssw-infra-public',
        kind: 'repository',
      },
    ],
  },
  {
    id: 'project-ecommerce-demo',
    title: '이커머스 데모',
    category: 'Commerce Demo',
    desc: '상품 조회, 장바구니, 주문과 관리자 흐름을 갖춘 데모입니다. 실제 결제는 포함하지 않으며 배너와 상품 이미지는 AI 도구로 제작했습니다.',
    status: '공개 데모 운영 중',
    gallery: {
      images: [
        {
          src: '/images/projects/ecommerce-demo/ssw-ecommerce-customer-main.webp',
          alt: '쇼핑몰 홈과 AI 쇼핑 도우미 채팅 패널이 함께 열린 이커머스 사용자 화면',
          caption: '상품 탐색과 AI 쇼핑 도우미를 결합한 사용자 홈',
        },
        {
          src: '/images/projects/ecommerce-demo/ssw-ecommerce-dashboard-1.webp',
          alt: '매출·주문·회원·상품 요약과 최근 매출 추이를 보여주는 이커머스 관리자 대시보드',
          caption: '매출·주문·재고 상태를 한눈에 확인하는 운영 대시보드',
        },
        {
          src: '/images/projects/ecommerce-demo/ssw-ecommerce-dashboard-2.webp',
          alt: '품절 상품 재고 수정과 주문 상태 이력을 보여주는 이커머스 관리자 화면',
          caption: '재고 알림과 주문 상태 이력을 연결한 운영 관리',
        },
        {
          src: '/images/projects/ecommerce-demo/ssw-ecommerce-llm-1.webp',
          alt: '카탈로그 지표를 선택해 질문하는 자연어 통계 관리자 화면',
          caption: '카탈로그 지표만 근거로 질문하는 자연어 통계 실험실',
        },
        {
          src: '/images/projects/ecommerce-demo/ssw-ecommerce-llm-2.webp',
          alt: '재고 부족 지표와 AI 분석 결과 및 제안을 보여주는 자연어 통계 화면',
          caption: '읽은 데이터와 판단을 구분하는 AI 통계 해석',
        },
      ],
      placeholder: '이커머스 사용자·관리자 화면을 추가할 자리입니다.',
    },
    links: [
      {
        label: 'GitHub 저장소',
        href: 'https://github.com/s-work-agency/ssw-e-commerce-demo-public',
        kind: 'repository',
      },
      {
        label: '사용자 데모',
        href: 'https://demo.ecommerce.sworkagency.com/',
        kind: 'demo',
      },
      {
        label: '관리자 데모',
        href: 'https://admin.ecommerce.sworkagency.com/',
        kind: 'demo',
      },
    ],
  },
  {
    id: 'project-game-collection-platform',
    title: '게임 모음 플랫폼',
    category: 'Game Platform',
    desc: '오목·스네이크와 Three.js·WebGL 기반 비행 시뮬레이터를 한곳에 모으고, 게임 기록 저장과 랭킹 기능을 구성한 플랫폼입니다. 현재 게임 모음 웹사이트는 공개 준비 중이며, 비행 시뮬레이터 샘플만 먼저 확인할 수 있습니다.',
    status: '사이트 준비 중',
    statusTone: 'warning',
    gallery: {
      images: [
        {
          src: '/images/projects/game-collection/ssw-web-games-main.webp',
          alt: '2048·오목·스네이크 게임 카드와 오늘의 게임을 보여주는 SSW Games 메인 화면',
          caption: '여러 브라우저 게임을 한곳에서 탐색하는 게임 모음 메인 화면',
        },
        {
          src: '/images/projects/game-collection/ssw-web-games-flight-simulator.webp',
          alt: '활주로에서 이륙하는 전투기와 비행 계기 HUD가 표시된 비행 시뮬레이터 화면',
          caption: 'Three.js와 WebGL로 구성한 브라우저 비행 시뮬레이터',
        },
      ],
      placeholder: '게임 모음과 샘플 게임 화면을 추가할 자리입니다.',
    },
    links: [
      {
        label: '샘플 게임',
        href: 'https://skyward-flight-simulator.swsongab11572.chatgpt.site/',
        kind: 'demo',
      },
    ],
  },
  {
    id: 'project-code-archive',
    title: '코드 아카이브',
    category: 'Verified Code Archive',
    desc: 'AI로 구현한 코드를 테스트와 검증을 거쳐 고정 항목으로 등록하고, 주제·언어·식별 규칙에 따라 같은 검증 코드를 조회해 재사용하는 프로젝트입니다.',
    status: '공개 문서 저장소 운영 중',
    gallery: {
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
      placeholder: '코드 아카이브 탐색·검증 화면을 추가할 자리입니다.',
    },
    links: [
      {
        label: '코드 아카이브 보기',
        href: 'https://s-work-agency.github.io/ssw-algorithm-archive-public/',
        kind: 'demo',
      },
    ],
  },
];
