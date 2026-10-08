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
    desc: '실무 경력과 핵심 기술, 주요 업무에서 맡은 역할을 정리했습니다. 웹·앱 개발과 시스템 운영 경험을 바탕으로 쌓아 온 역량을 확인할 수 있습니다.',
    emoji: '📄',
    linkText: '이력서 확인하기 →',
  },
  {
    title: '자기소개서 (Cover Letter)',
    href: '/about-me/cover-letter',
    desc: '개발을 대하는 관점과 학습 과정, 경력의 전환점과 앞으로의 방향을 소개합니다.',
    emoji: '✍️',
    linkText: '자기소개서 읽기 →',
  },
  {
    title: '연구 경험 (Research)',
    href: '/about-me/research',
    desc: '하드웨어 구성과 소프트웨어 최적화, 두 영역을 함께 고려한 SIMD·AVX2 활용 경험을 정리했습니다. 실험중인 내용도 소개합니다.',
    emoji: '🔬',
    linkText: '연구 경험 보러 가기 →',
  },
  {
    title: '기록 (Log)',
    href: '/about-me/log',
    desc: '개발과 일상에서 얻은 기술적 배움, 문제 해결 과정의 고민, 프로젝트 회고를 기록합니다.',
    emoji: '📝',
    linkText: '로그 게시글 읽기 →',
  },
];

export const aboutArchiveProjects: AboutArchiveProject[] = [
  {
    id: 'archive-canvas-dodge-game',
    title: 'Canvas 피하기 게임',
    category: 'Canvas Game',
    desc: 'HTML Canvas와 JavaScript로 만든 브라우저 게임입니다. 방향키로 캐릭터를 움직여 장애물을 피하며 생존 시간을 기록합니다. 당시 작성한 단일 HTML 파일을 그대로 실행할 수 있습니다.',
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
    logHref: '/about-me/log/view/?slug=canvas-dodge-game-before-game-development',
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
    desc: '반복적인 엑셀 작업의 생산성을 높이기 위해 만든 데스크톱 앱입니다. 정부24에서 조회한 토지대장 정보를 주소·지번 기준으로 원본 엑셀 행에 매핑해 누락 정보를 채우는 WinForms 프로토타입을 만든 뒤, WPF 기반의 MVVM 구조로 전환해 실제 작업에 사용했습니다.',
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
    logHref: '/about-me/log/view/?slug=excel-row-mapping-wpf-app',
  },
  {
    id: 'archive-android-ar-campfire',
    title: 'Android AR 캠프파이어 앱',
    category: 'Android AR',
    desc: 'VR 게임 학원 수강 중 제작한 Android AR 앱입니다. 현실 공간에 가상의 캠프파이어를 배치하고 점화하는 과정을 시연 영상과 이미지로 담았습니다.',
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
    logHref: '/about-me/log/view/?slug=first-ar-project-using-real-space-and-motion',
  },
];

export const aboutProjects: AboutProject[] = [
  {
    id: 'project-common-infrastructure',
    title: '공용 인프라 프로젝트군',
    category: 'Shared Infrastructure',
    desc: '여러 프로젝트에서 반복해서 필요한 인증·채팅·파일·미디어·알림·분석 기능을 공용 구성 요소로 분리했습니다. 게이트웨이·설정·스케줄링·관측 기능도 함께 구성했습니다.',
    status: '설계 문서 공개',
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
        label: '공개 설계 문서',
        href: 'https://github.com/s-work-agency/ssw-infra-public',
        kind: 'repository',
      },
    ],
  },
  {
    id: 'project-ecommerce-demo',
    title: '이커머스 데모',
    category: 'Commerce Demo',
    desc: '상품 조회, 장바구니, 주문, 관리자 기능을 구현한 이커머스 데모입니다. 실제 결제 기능은 포함하지 않았으며, 배너와 상품 이미지는 AI 도구로 제작했습니다.',
    status: '데모·설계 문서 공개',
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
        label: '공개 설계 문서',
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
    id: 'project-colab-llm-launcher',
    title: 'SSW Colab LLM Launcher',
    category: 'Open-weight Inference',
    desc: 'Colab에서 오픈웨이트 모델을 실행하고, Cloudflare Tunnel을 통해 외부 서비스와 연결하는 런처입니다. 엔진·컨텍스트·배치 등 실행 옵션을 조절할 수 있습니다.',
    status: '실행 화면 공개',
    gallery: {
      images: [
        {
          src: '/images/projects/colab-llm-launcher/ssw-colab-launcher-dashboard.png',
          alt: 'Colab 런타임과 모델 프로필 및 추론 옵션을 관리하는 SSW Colab LLM Launcher 화면',
          caption: '런타임 자원과 모델별 실행 옵션을 한 화면에서 조절하는 Colab 런처',
        },
        {
          src: '/images/projects/colab-llm-launcher/portfolio-chat-ui-tools.png',
          alt: '포트폴리오 AI 챗봇이 도구 호출로 채팅을 오른쪽에 고정하고 글자 크기를 키운 뒤 2024년 연구 경험으로 이동한 화면',
          caption: '포트폴리오 AI 도구 호출 · 채팅 배치·글자 크기 변경과 연구 연도 이동',
        },
        {
          src: '/images/projects/colab-llm-launcher/opencode-provider-settings.png',
          alt: 'SWork Colab이 사용자 지정 공급자로 연결된 OpenCode 공급자 설정 화면',
          caption: 'OpenCode 공급자 설정 · SWork Colab 사용자 지정 공급자 연결',
        },
        {
          src: '/images/projects/colab-llm-launcher/opencode-image-feedback.png',
          alt: 'OpenCode에서 SWork Colab의 gemma-4-26b-a4b-it 모델에 이미지를 질문하고 응답과 토큰 사용량을 확인하는 화면',
          caption: 'OpenCode에서 Colab 모델로 이미지 분석 요청 · 응답과 토큰 사용량 확인',
        },
      ],
      placeholder: 'Colab LLM Launcher 운영 화면을 추가할 자리입니다.',
    },
  },
  {
    id: 'project-code-archive',
    title: '코드 아카이브',
    category: 'Verified Code Archive',
    desc: 'AI로 구현한 코드를 테스트·검증한 뒤, 검증한 버전을 항목별로 보관하는 프로젝트입니다. 주제·언어·식별 정보를 기준으로 원하는 코드를 찾아 재사용할 수 있습니다.',
    status: '문서·코드 스냅샷 공개',
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
  {
    id: 'project-colab-comfyui',
    title: 'SSW Colab ComfyUI',
    category: 'Image & Video Generation',
    desc: 'Colab에서 실행하는 ComfyUI를 이미지·영상 제작용 웹 화면으로 연결한 프로젝트입니다. 이미지 생성과 시작 이미지 업로드, 영상 생성·연장·병합을 한 흐름으로 구성했습니다. 대기열과 진행률, 자원 사용량과 결과 기록을 웹에서 확인할 수 있습니다.',
    status: '실행 화면 공개',
    gallery: {
      images: [
        {
          src: '/images/projects/colab-comfyui/01-web-image-generation.jpg',
          alt: 'SSW Colab ComfyUI 이미지 생성 웹의 페이지 헤더·자원 사용량·프롬프트·실행 옵션과 이미지 목록 첫 줄이 표시된 화면',
          caption: '이미지 생성 웹 · 프롬프트·실행 옵션·결과 목록',
        },
        {
          src: '/images/projects/colab-comfyui/02-web-system.jpg',
          alt: 'SSW Colab ComfyUI 시스템 웹의 모델 로드·언로드 버튼과 모델 파일 상태, 디스크·RAM·VRAM 사용량 및 ComfyUI 연결 정보가 표시된 화면',
          caption: '시스템 관리 웹 · 모델 로드·자원 사용량·연결 상태',
        },
        {
          src: '/images/projects/colab-comfyui/03-comfyui-image-workflow.png',
          alt: 'Qwen-Image 2512 이미지 생성을 위한 모델 로드·LoRA·CLIP·프롬프트·샘플링 노드가 연결된 ComfyUI 그래프 화면',
          caption: 'ComfyUI 이미지 워크플로 · 모델·프롬프트·샘플링 노드 구성',
        },
      ],
      placeholder: '이미지 생성·시스템 관리 웹과 ComfyUI 이미지 워크플로 화면입니다.',
    },
  },
  {
    id: 'project-receipt-ocr',
    title: 'SSW 영수증 OCR',
    category: 'Receipt Review · Windows & Android',
    desc: '영수증 사진에서 거래 정보와 상품·할인 정보를 추출하고, 원본과 비교해 검수·보관·내보내는 Windows·Android 앱입니다. 전체 사진과 확대 사진의 판독 결과를 비교하고 원판독과 사용자가 수정한 값을 구분해 보존합니다. 비용 분류와 월별 집계, JSON·CSV 내보내기, 사진을 포함한 ZIP 백업·복원을 지원합니다.',
    status: '실행 화면 공개',
    gallery: {
      images: [
        {
          src: '/images/projects/receipt-ocr/01-receipt-review-trimmed.png',
          alt: '일부 정보를 가린 영수증 사진과 추출 원문·수정 값·항목별 확인 상태를 나란히 보여 주는 데스크톱 검수 화면',
          caption: '영수증 원본과 추출 값을 비교·수정하는 검수 화면 · 일부 정보 가림',
        },
        {
          src: '/images/projects/receipt-ocr/02-ai-settings-trimmed.png',
          alt: 'ChatGPT와 OpenAI 호환 API 제공자 선택 메뉴, 계정 연결과 사용 모델 선택 항목이 표시된 AI 설정 화면',
          caption: 'AI 설정 화면 · ChatGPT·OpenAI 호환 API와 모델 선택',
        },
      ],
      placeholder: '영수증 검수와 AI 제공자·모델 설정 화면입니다.',
    },
  },
  {
    id: 'project-sprite-toolkit',
    title: 'SSW Sprite Toolkit',
    category: 'Sprite Editing & Validation',
    desc: 'AI로 생성한 스프라이트 시트를 게임용 이미지와 애니메이션으로 다듬는 브라우저 도구입니다. 격자와 재생 순서를 확인하고 배경·색상·프레임 위치를 보정한 뒤 PNG·GIF·APNG로 내보낼 수 있습니다. WebMCP로 AI 에이전트의 편집 작업을 연결하고, 변경 전후 미리보기와 실제 출력 파일 검사로 결과를 확인합니다.',
    status: '실행 화면 공개',
    gallery: {
      images: [
        {
          src: '/images/projects/sprite-toolkit/01-home.png',
          alt: '파일 열기와 작업 단계 안내를 제공하는 스프라이트 툴킷 홈 화면',
          caption: '스프라이트 파일 열기와 작업 흐름을 안내하는 홈 화면',
        },
        {
          src: '/images/projects/sprite-toolkit/02-castle-workspace.png',
          alt: '파란 지붕·깃발·배너의 성 이미지를 불러와 프레임과 격자를 확인하는 스프라이트 툴킷 작업 공간',
          caption: '파란 성 원본을 확인하는 프레임·격자 작업 공간',
        },
        {
          src: '/images/projects/sprite-toolkit/03-color-change-preview.png',
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
      placeholder: '홈·프레임 작업·색상 변경·출력 검사 화면입니다.',
    },
  },
  {
    id: 'project-asset-library',
    title: 'SSW Asset Library',
    category: 'Agent-connected Asset Library',
    desc: '이미지·3D 모델·음원·문서를 에셋 단위로 묶고 버전과 제작 기록을 함께 관리하는 개인용 웹 라이브러리입니다. 자료 검색과 파일 미리보기, 그룹·참조 맵, 버전 백업과 복원을 제공합니다. MCP를 통해 AI 에이전트의 에셋 검색·등록·다운로드와 제작 기록 관리 작업을 연결했습니다.',
    status: '실행 화면 공개',
    gallery: {
      images: [
        {
          src: '/images/projects/asset-library/01-military-models.png',
          alt: '군용기·차량 에셋 목록과 자주포 색상 변형을 보여 주는 에셋 상세 패널',
          caption: '군용기·차량 에셋 목록과 자주포 색상 변형 미리보기',
        },
        {
          src: '/images/projects/asset-library/02-gym-models.png',
          alt: '헬스장 프로젝트의 운동 기구 모델 목록과 페이지 번호·직접 이동 입력란이 표시된 화면',
          caption: '헬스장 운동 기구 에셋 목록과 페이지 이동',
        },
        {
          src: '/images/projects/asset-library/03-office-models-v2.png',
          alt: '사무실·도심·아파트·지하철 환경 에셋 목록과 사무실 내부 샘플의 상세 미리보기',
          caption: '건축·실내 환경 모델 목록과 사무실 상세 미리보기',
        },
        {
          src: '/images/projects/asset-library/04-campsite-models-v2.png',
          alt: '캠핑장·지하철·세탁소 등 환경 에셋 목록과 텐트·모닥불이 배치된 캠핑장 상세 미리보기',
          caption: '환경 에셋 목록과 캠핑장 상세 미리보기',
        },
        {
          src: '/images/projects/asset-library/05-environment-models-v2.png',
          alt: '시대별 탐험 환경 모델 목록과 구석기 동굴 야영지 상세 미리보기',
          caption: '시대별 환경 에셋 목록과 동굴 야영지 상세 미리보기',
        },
        {
          src: '/images/projects/asset-library/04-food-library.png',
          alt: '피자·치즈버거·아이스크림 등 음식 에셋 목록과 치즈버거 재료 구성표를 함께 보여 주는 화면',
          caption: '음식 에셋 목록과 치즈버거 재료 구성표',
        },
        {
          src: '/images/projects/asset-library/07-music-library.png',
          alt: '음원 에셋 목록과 선택한 트랙의 커버 이미지 및 오디오 플레이어가 표시된 상세 화면',
          caption: '음원 에셋 목록과 커버 이미지·오디오 재생 패널',
        },
      ],
      placeholder: '군용기·차량, 헬스장, 환경, 음식과 음원 에셋의 목록·상세 화면입니다.',
    },
  },
];
