import type { AboutProject } from '../../overview/data/about';

/** 실행·서비스 연결·파인튜닝을 다루는 공개용 오픈웨이트 모델 실험 카드. */
export const openWeightExperiments: AboutProject[] = [
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
          src: '/images/projects/colab-llm-launcher/portfolio-chat-ui-tools.webp',
          alt: '포트폴리오의 오픈웨이트 모델 챗봇이 도구 호출로 채팅을 오른쪽에 고정하고 글자 크기를 키운 뒤 2024년 연구 경험으로 이동한 화면',
          caption: '오픈웨이트 모델 챗봇 도구 호출 · 채팅 배치·글자 크기 변경과 연구 연도 이동',
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
    links: [
      {
        label: '챗봇 구조 실험 보기',
        href: '/about-me/research#research-chatbot-architecture',
        kind: 'research',
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
          src: '/images/projects/colab-comfyui/03-comfyui-image-workflow.webp',
          alt: 'Qwen-Image 2512 이미지 생성을 위한 모델 로드·LoRA·CLIP·프롬프트·샘플링 노드가 연결된 ComfyUI 그래프 화면',
          caption: 'ComfyUI 이미지 워크플로 · 모델·프롬프트·샘플링 노드 구성',
        },
      ],
      placeholder: '이미지 생성·시스템 관리 웹과 ComfyUI 이미지 워크플로 화면입니다.',
    },
  },
  {
    id: 'project-open-weight-finetuning',
    title: '오픈웨이트 모델 미세조정',
    category: 'Fine-tuning · Tool LoRA',
    desc: 'Google Colab을 활용해 오픈웨이트 모델의 파인튜닝을 실험하고 있습니다. LoRA(저랭크 적응)로 챗봇의 검색·답변 방식과 도구 호출을 학습시키고, 그만큼 지침을 줄이는 구성을 시도하고 있습니다.\n\n현재 테스트와 적용은 이 포트폴리오 사이트의 채팅 챗봇에 한정하고 있습니다. 자료를 검색해 답하는 메인 세션과, 테마·채팅 설정 변경, 페이지 이동처럼 사용자의 요청을 실제 화면 동작으로 연결하는 작업 세션을 대상으로 실험하고 있습니다.\n\n학습과 검증에는 많은 컴퓨팅 자원과 시간이 필요해 비용이 적지 않게 발생합니다. 이 때문에 다양한 조건의 테스트를 충분히 반복하지는 못했으며, 아래 내용은 제한된 범위에서 확인한 실험 예시입니다.',
    status: '실험·학습 진행 중',
    learningContext: {
      title: '학습 배경과 실험 방식',
      paragraphs: [
        '개인적인 궁금증을 해소하고, 무엇을 바꾸면 어떤 결과가 나오는지 직접 확인하기 위한 탐색적 실험입니다.',
        '정규 교육과정을 거치지 않고 독학으로 실험하고 있으며, 관련 이론과 세부 기법에 대한 전문지식에는 아직 한계가 있습니다.',
        'SI 에이전트와 함께 방법을 찾아 적용하고, 실제 실행 결과를 관찰·실측하는 경험적 접근(empirical approach)으로 이해를 쌓고 있습니다.',
      ],
      relatedLog: {
        slug: 'every-learning-and-research-effort-has-a-cost',
        label: '학습과 실험에 대한 생각',
      },
    },
    links: [
      {
        label: '학습 데이터 형식·예시 보기',
        href: '/about-me/research#research-training-data',
        kind: 'research',
      },
    ],
    experiment: {
      title: '실험 예시 · 메인 지침 축약',
      before: '이전 · 기반 모델용 전체 지침',
      after: '현재 · 메인 LoRA용 간결 지침',
      result: '11,339자 → 1,625자 · 9,714자 감소 (85.7%)',
      scope: '메인 세션 시스템 지침의 문자 수를 비교했습니다. 전체 지침에서 방문자 메시지마다 덧붙이던 86자 상기 문구는 포함하지 않았고, 간결 지침에서는 붙이지 않습니다. 도구 정의는 지침과 별도로 보내며 두 경우가 같습니다. 전체 입력 토큰의 감소율은 아닙니다.',
      retained: '개인정보·민감한 질문의 경계와 고정 답변 문장, 도구 정의와 실행 전후 검증은 유지했습니다. 말투와 검색·도구 사용 순서는 지침 대신 학습 데이터로 가르칩니다.',
      observation: '학습하지 않은 기반 모델에 간결 지침만 주면 답하기 전에 검색하는 경우가 크게 줄었습니다. 그래서 두 지침을 함께 두고, 기반 모델에는 전체 지침을 씁니다.',
      limitation: '간결 지침은 같은 행동을 학습한 LoRA와 함께 쓰기 위한 구성이며, LoRA를 적용한 뒤의 품질은 아직 검증 중입니다.',
    },
  },
];
