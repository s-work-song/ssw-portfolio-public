import type { AboutProject } from './about';

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
    id: 'project-open-weight-finetuning',
    title: '오픈웨이트 모델 미세조정',
    category: 'Fine-tuning · Tool LoRA',
    desc: 'Google Colab을 활용해 오픈웨이트 모델의 파인튜닝을 실험하고 있습니다. LoRA(저랭크 적응)로 도구 호출을 학습시키고, 서비스에 적용해 도구 설명을 줄이는 구성을 시도했습니다.\n\n현재 테스트와 적용은 이 포트폴리오 사이트의 채팅 챗봇에서 사용하는 도구 호출 기능에 한정하고 있습니다. 테마·채팅 설정 변경, 페이지 이동처럼 사용자의 요청을 실제 화면 동작으로 연결하는 영역을 대상으로 실험하고 있습니다.\n\n학습과 검증에는 많은 컴퓨팅 자원과 시간이 필요해 비용이 적지 않게 발생합니다. 이 때문에 다양한 조건의 테스트를 충분히 반복하지는 못했으며, 아래 내용은 제한된 범위에서 확인한 실험 예시입니다.',
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
    trainingExamples: {
      description: '사용자 요청과 기대 도구명·인자로 구성한 학습 데이터 예시입니다. 방문자 대화 기록이 아니며, 시스템 지침·상태 문맥·호출 ID 등은 생략했습니다. 기대 출력은 모델의 실행 결과가 아닌 학습용 정답입니다.',
      items: [
        {
          id: 'theme-change',
          title: '테마 변경',
          request: '사이트 테마를 다크 모드로 바꿔줘.',
          toolCall: { name: 'set_portfolio_theme', arguments: { theme: 'dark' } },
          intent: '다크 모드 요청을 테마 변경 도구와 허용값 dark로 연결합니다.',
        },
        {
          id: 'chat-layout-change',
          title: '채팅 사이드 패널 전환',
          request: '채팅 옆으로 붙여줘',
          toolCall: { name: 'set_portfolio_chat_layout', arguments: { layout: 'dock' } },
          intent: 'layout: dock으로 설정해 PC의 채팅을 오른쪽 사이드 패널에 고정합니다.',
        },
      ],
    },
    experiment: {
      title: '실험 예시 · 도구 설명 축약',
      before: '이전 · 전체 도구 설명 제공',
      after: '현재 · 도구 LoRA 사용 + 축약 설명 제공',
      result: '5,669자 → 4,310자 · 1,359자 감소 (24.0%)',
      scope: '동일한 11개 도구의 이름·설명·인자를 포함한 도구 정의 JSON의 문자 수를 비교했습니다. 전체 입력 토큰의 감소율은 아닙니다.',
      retained: '시스템 지침·도구명·인자 구조와 실행 전후 검증은 유지했습니다.',
      observation: '사용 체감상 기능 수행 품질은 유사하고 응답은 비슷하거나 더 빠르게 느껴졌습니다. 품질·응답 시간의 정량 비교는 수행하지 않았습니다.',
      limitation: '같은 도구 LoRA를 사용한 설명 길이 비교와 원본 도구 JSON의 문자 수를 근거로 정리한 예시이며, LoRA 단독의 효과를 입증한 결과는 아닙니다.',
    },
  },
];
