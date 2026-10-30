/** 개인과 팀·조직의 SI 활용 수준을 다섯 단계로 설명합니다. 도식은 실제 실행 화면이 아닙니다. */
const captureNote = '사람과 SI의 작업 흐름 도식';

export const aiWorkflowStages = [
  {
    id: 'chat', number: '01', shortTitle: '챗봇과 대화',
    navDescription: '채팅 답변의 코드를 복사해\n직접 수정·구현',
    title: '챗봇의 답변을 참고해 직접 구현하기',
    description: '코드와 오류, 필요한 맥락을 채팅에 옮겨 질문합니다. 답변을 읽고 쓸 부분을 골라 에디터에 직접 반영합니다.',
    aiRole: '전달받은 맥락 안에서 개념을 설명하고, 원인 후보와 코드 예시를 제안합니다.',
    humanRole: '질문할 내용을 준비하고 답변을 판단합니다. 코드를 직접 옮긴 뒤 실행해 결과를 확인합니다.',
    change: '혼자 찾던 답을 대화로 함께 탐색합니다. 채팅과 실제 프로젝트를 연결하는 일은 사람이 맡습니다.',
    captureNote,
    flowSteps: [
      { actor: 'human', title: '맥락 전달', detail: '코드 · 오류 · 질문' },
      { actor: 'ai', title: '답변과 제안', detail: '설명 · 원인 후보 · 예시' },
      { actor: 'human', title: '직접 반영·실행', detail: '에디터에 옮기고 확인' },
    ],
  },
  {
    id: 'read-only', number: '02', shortTitle: '에이전트에 조회·분석 위임',
    navDescription: '에이전트를 통해서 코드베이스\n스캔·분석 후 직접 코드 수정',
    title: '에이전트에 조회·분석을 맡기고 직접 코드 수정하기',
    description: '프로젝트를 직접 읽고 검색할 수 있는 에이전트를 활용합니다. 아직 수정은 맡기지 않고, 분석 결과를 바탕으로 사람이 코드를 작성합니다.',
    aiRole: '파일을 읽고 관련 코드를 검색합니다. 구조와 흐름을 분석하고, 변경할 지점과 근거를 정리합니다.',
    humanRole: '읽을 범위를 정하고 분석의 근거를 확인합니다. 실제 코드는 직접 작성·적용하고 실행합니다.',
    change: '맥락을 하나씩 복사하는 부담이 줄어듭니다. 분석을 위임해도 코드 변경 권한은 사람이 유지합니다.',
    captureNote,
    flowSteps: [
      { actor: 'human', title: '조회 범위 지정', detail: '읽을 파일과 확인할 질문' },
      { actor: 'ai', title: '프로젝트 분석', detail: '읽기 · 검색 · 근거 정리' },
      { actor: 'human', title: '직접 구현', detail: '분석 확인 후 코드 적용' },
    ],
  },
  {
    id: 'implementation', number: '03', shortTitle: '에이전트에 구현 위임',
    navDescription: '에이전트가 생성하는 모든\n코드와 명령어 전수 리뷰',
    title: '에이전트에 구현을 맡기고 코드 리뷰·검증하기',
    description: '정한 범위 안에서 에이전트가 코드를 작성하고 수정합니다. 사람은 요구사항과 설계 방향을 구체화하고, 변경 내용과 실제 실행 결과를 함께 확인합니다.',
    aiRole: '요구사항에 맞춰 코드를 작성·수정하고, 가능한 검사를 수행합니다. 변경 이유와 남은 한계를 설명합니다.',
    humanRole: '요구사항·범위·설계를 정합니다. 변경을 검토하고 실제 동작을 확인하며, 필요한 수정과 최종 판단을 맡습니다.',
    change: '코드를 옮기는 일에서 구현 방향과 결과를 확인하는 일로 무게중심이 옮겨갑니다. 리뷰만 하는 역할은 아닙니다.',
    captureNote,
    flowSteps: [
      { actor: 'human', title: '요구사항·설계', detail: '범위와 완료 기준 합의' },
      { actor: 'ai', title: '코드 작성·수정', detail: '구현 · 가능한 검사' },
      { actor: 'human', title: '검토·실행 검증', detail: '수정 요청 · 최종 판단' },
    ],
  },
  {
    id: 'tools', number: '04', shortTitle: 'MCP·CLI 도구 활용',
    navDescription: 'MCP·CLI로 다양한 도구를 활용해\n에이전트의 작업 범위 확장',
    title: 'MCP·플러그인·CLI로 에이전트의 작업 범위 넓히기',
    description: 'MCP(Model Context Protocol)와 플러그인으로 외부 도구를 연결하거나, CLI(Command Line Interface, 명령줄 인터페이스)로 도구를 실행합니다. 코드 밖의 작업도 함께 다루되, 접근 범위와 실행 권한은 따로 확인합니다.',
    aiRole: '허용된 도구로 화면과 리소스를 확인하고 필요한 작업을 수행합니다. 도구의 응답과 작업 결과를 정리합니다.',
    humanRole: '무엇에 접근하고 어떤 동작을 허용할지 정합니다. 외부 변경의 영향을 판단하고 결과를 확인합니다.',
    change: '협업 범위가 코드 파일을 넘어 연결된 도구까지 넓어집니다. 도구 연결 자체가 모든 작업의 허용을 뜻하지는 않습니다.',
    captureNote,
    flowSteps: [
      { actor: 'human', title: '연결·권한 설정', detail: '접근 대상과 허용 동작' },
      { actor: 'ai', title: '도구 활용·실행', detail: 'MCP · 플러그인 · CLI' },
      { actor: 'human', title: '영향·결과 확인', detail: '외부 변경과 실제 결과' },
    ],
  },
  {
    id: 'orchestration', number: '05', shortTitle: '여러 에이전트 협업 조율',
    navDescription: '구현·검수·재작업을 조율하고\n핵심 코드와 흐름을 확인',
    title: '여러 에이전트의 협업을 조율하고 결과 통합하기',
    description: '장시간 맥락을 유지하는 조율 세션이 구현 에이전트에 작업을 요청하고 완료 보고를 받습니다. 그다음 별도의 검수 에이전트를 실행해 검수 결과를 보고받고, 완료 기준을 확인한 뒤 결과를 전달하거나 구현 에이전트를 다시 실행합니다.',
    aiRole: '조율 세션은 작업 범위·우선순위를 정리하고 구현·검수 에이전트의 실행과 보고를 관리합니다. 구현 에이전트는 작업 후 조율 세션에 완료를 알리고, 조율 세션이 이어서 실행한 검수 에이전트도 결과와 근거를 조율 세션에 보고합니다. 구현에서 검수로 직접 넘기지 않으며, 조율 세션이 보고를 확인해 결과 전달 또는 재구현·재검수를 결정합니다.',
    humanRole: '목표와 완료 기준을 정하고 최종 판단을 맡습니다. 저는 모든 코드를 전수 검토하지는 않지만, 주요 코드와 추상화 코드는 직접 읽습니다. 핵심 플로우는 도식으로 시각화해 전체 흐름과 연결 관계를 빠르게 파악하고, 의도한 구조와 맞는지 확인합니다.',
    change: '한 번 위임하고 결과를 받는 흐름에서 조율 세션이 요청·보고·판단을 반복하는 흐름으로 바뀝니다. 독립적인 작업은 병렬로 나눌 수 있지만, 같은 작업의 검수는 구현 완료 보고를 받은 뒤 시작합니다. 사람은 핵심 코드와 구조를 확인하고 최종 판단을 맡습니다.',
    captureNote,
    flowSteps: [
      { actor: 'human', title: '목표·완료 기준', detail: '우선순위와 작업 경계를 정합니다.' },
      { actor: 'ai', title: '조율 세션', detail: '에이전트 실행 · 보고 수신 · 결과 확인과 다음 작업 결정' },
      { actor: 'ai', title: '구현 에이전트', detail: '코드 작성·수정 후 조율 세션에 완료 보고' },
      { actor: 'ai', title: '검수 에이전트', detail: '변경·동작 확인 후 조율 세션에 결과와 근거 보고' },
      { actor: 'human', title: '핵심 검토·최종 판단', detail: '주요·추상화 코드와 핵심 플로우 도식을 확인합니다.' },
    ],
  },
] as const;

export type AiWorkflowStageId = (typeof aiWorkflowStages)[number]['id'];

/** 같은 작업의 요청·보고 순서. 구현과 검수 사이에 직접 인계하는 연결은 없다. */
export const aiWorkflowOrchestrationConnections = [
  { step: 1, from: 'coordinator', to: 'implementer', label: '구현·재구현 요청' },
  { step: 2, from: 'implementer', to: 'coordinator', label: '구현 완료 보고' },
  { step: 3, from: 'coordinator', to: 'reviewer', label: '검수 실행' },
  { step: 4, from: 'reviewer', to: 'coordinator', label: '검수 결과 보고' },
] as const;

/** 05 단계의 개인적인 검토 방식. 아래 실제 캡처가 모든 검수 과정을 증명한다는 뜻은 아닙니다. */
export const aiWorkflowOrchestrationReview = {
  title: '제가 직접 확인하는 지점',
  summary: '검수 에이전트를 함께 활용하되, 사람의 검토를 없애지는 않습니다. 코드 전수 검토 대신 주요 코드·추상화 코드와 핵심 흐름을 중심으로 살펴봅니다.',
  checkpoints: [
    { title: '주요 코드·추상화 코드', description: '핵심 동작을 구현한 코드와 역할·책임을 나누는 추상화 코드를 직접 읽습니다. 세부 구현뿐 아니라 공통 구조와 연결 지점을 함께 확인합니다.' },
    { title: '핵심 플로우 시각화', description: '중요한 처리 흐름을 도식화해 대강 훑어도 전체 구조를 파악할 수 있게 합니다. 어떤 순서로 동작하고 어디로 연결되는지 먼저 살펴본 뒤, 필요한 부분은 코드와 함께 확인합니다.' },
    { title: '검수 결과·수정 반복', description: '구현 완료 보고를 받은 조율 세션이 검수 에이전트를 실행합니다. 검수 결과도 조율 세션이 보고받아 확인하며, 보완이 필요하면 구현 에이전트를 다시 실행합니다. 수정 완료 보고 뒤에는 다시 검수를 요청하고, 사람의 구조·흐름 피드백도 같은 과정에 반영합니다.' },
  ],
} as const;

/** 다섯 단계와 별개로, 어느 단계에서든 SI를 학습에 쓰는 방식을 설명합니다. */
export const aiWorkflowLearning = {
  title: '어느 단계에서든, 가장 중요한 건 배우는 데 쓰는 것',
  intro: '다섯 단계는 SI에게 얼마나 맡기는지를 나눈 것입니다. 그런데 단계와 상관없이 제가 가장 중요하게 생각하는 활용법은 SI를 학습에 쓰는 것입니다.',
  practices: [
    { title: '궁금하면 바로 묻습니다', description: '모르는 개념이나 낯선 코드는 그 자리에서 묻고 설명을 듣습니다.' },
    { title: '답을 그대로 믿지 않고 되묻습니다', description: '왜 그런지 다시 묻고, 직접 실행하고 측정해서 확인합니다.' },
    { title: '맡긴 결과는 이해할 때까지 읽습니다', description: '에이전트가 만든 코드도 제가 설명할 수 있어야 다음 판단을 제가 내릴 수 있습니다.' },
  ],
  examplesTitle: '제가 배워 온 방식',
  /** 챗봇(01 단계)과 에이전트(02~05 단계) 사례를 하나씩 두어 "어느 단계에서든"을 보여 준다. */
  examples: [
    {
      mode: '챗봇으로 배울 때',
      stages: '01 단계',
      title: 'SIMD 독학',
      description: 'SIMD를 독학할 때 유료 결제 없이 ChatGPT 무료 채팅만 썼습니다. 그럼에도 검색으로는 잘 나오지 않고 공식 문서에서도 찾기 어려웠던 내용을 빠르게 알아볼 수 있었습니다.',
      steps: [
        'SIMD 명령어 함수(인트린직, intrinsic)와 동작 방식, 예제 코드를 묻습니다.',
        '빈틈이 많은 답변 코드를 읽고 고치고 조합합니다.',
        '로그를 찍어 가며 실제 동작을 하나씩 확인합니다.',
      ],
      repeats: false,
      relatedLink: { href: '/about-me/research#research-cpu-simd', label: '연구 경험의 CPU·SIMD 실험 보기' },
    },
    {
      mode: '에이전트와 작업하며 배울 때',
      stages: '02~05 단계',
      title: '작업 중 생긴 궁금증을 바로 실험으로',
      description: '에이전트와 작업할 때는 정해 둔 주제가 따로 없습니다. 궁금한 것이 생기면 그 자리에서 아래 과정을 반복합니다.',
      steps: [
        '궁금한 것은 무엇이든 묻고, 표준이 무엇인지 확인합니다.',
        '떠오른 생각은 바로 PoC(개념 증명) 브랜치나 새 프로젝트로 나눠 실험합니다.',
        '결과를 시각화하고, 이해가 안 가는 부분은 모두 묻습니다.',
      ],
      repeats: true,
      relatedLink: null,
    },
  ],
  closing: 'SI를 잘 쓰는 힘은 도구보다 알고자 하는 마음, 스스로 묻고 찾아가는 자기주도 학습에서 나온다고 생각합니다.',
} as const;

export interface AiWorkflowCapture {
  title: string;
  detail: string;
  src: string;
  alt: string;
  caption: string;
}

export interface AiWorkflowExample {
  title: string;
  summary: string;
  environment: { tool: string; project: string };
  request?: string;
  checkpoints: string[];
  applicationNote?: { title: string; description: string };
  privacyNote: string;
  portrait?: boolean;
  frameAspectRatio?: string;
  relatedLink?: { href: string; label: string };
  captures: AiWorkflowCapture[];
}

/** 캡처와 제공된 작업 맥락을 설명합니다. 사용 도구는 각 단계의 필수 조건이 아닙니다. */
export const aiWorkflowExamples: Partial<Record<AiWorkflowStageId, AiWorkflowExample>> = {
  chat: {
    title: '함수 스펙을 채팅으로 전달하고 코드 받아 쓰기',
    summary: '사용 환경과 함수의 입력·반환값, 계산 조건을 프롬프트에 담습니다. ChatGPT가 답한 함수와 사용 예시를 읽고, 필요한 코드를 복사해 자신의 프로젝트에 적용하는 방식입니다.',
    environment: {
      tool: 'ChatGPT 채팅',
      project: 'C# · 2차원 벡터 정규화 함수 예시',
    },
    request: 'C# 환경에서 (float x, float y) Normalize(float x, float y) 함수를 만들어 줘. 벡터 길이는 1로 정규화하고, 반환하는 x와 y는 소수점 둘째 자리까지 반올림해 줘.',
    checkpoints: [
      '언어·함수 이름·매개변수·반환 형식을 먼저 정하고 계산 조건을 함께 전달합니다.',
      '답변의 코드와 사용 예시를 확인한 뒤 필요한 부분을 복사해 에디터에 붙여 넣습니다.',
      '0 벡터 처리와 반올림 결과 등 경계 조건은 실제 프로젝트에서 직접 실행해 확인합니다.',
    ],
    privacyNote: '캡처의 테두리만 정리한 공개용 사본입니다.',
    portrait: true,
    captures: [{
      title: '프롬프트와 코드 답변',
      detail: '환경과 함수 스펙을 입력한 질문, 함수 구현, 사용 예시가 하나의 대화에 담겨 있습니다. 이 캡처는 답변을 받는 장면이며, 이후 복사·붙여넣기와 실행은 사람이 직접 맡습니다. 반올림한 벡터의 길이는 정확히 1이 아닐 수 있으므로 요구사항에 맞는지도 확인합니다.',
      src: '/images/si-adoption/chat/01-function-prompt.webp',
      alt: 'ChatGPT에 C# Normalize 함수의 입력·반환 형식과 정규화·반올림 조건을 전달하고 코드와 사용 예시를 받은 대화',
      caption: 'C# 함수 스펙 전달 → 코드·사용 예시 답변',
    }],
  },
  'read-only': {
    title: '로그인 구현을 찾아 설명받고 IDE에서 확인하기',
    summary: '코드를 질문에 일일이 붙여 넣는 대신, 프로젝트를 읽을 수 있는 에이전트에게 기능의 위치와 동작 방식을 묻습니다. 설명만 받는 데서 끝내지 않고 관련 소스를 IDE에 열어 근거를 직접 확인합니다.',
    environment: {
      tool: 'Antigravity IDE',
      project: 'JavaScript 게시판 데모 · localStorage 기반 로그인·세션',
    },
    request: '로그인 기능 어떤 방식으로 구현 돼있고 봐야하는 코드 찾아서 띄워.',
    checkpoints: [
      '찾고 싶은 기능과 확인할 내용을 지정하고, 관련 코드를 열어 달라고 요청합니다.',
      '에이전트의 설명과 실제 js/storage.js의 세션 조회·저장·로그아웃 코드를 대조합니다.',
      '이 단계에서는 조회·분석을 맡깁니다. 수정이 필요하면 사람이 판단하고 직접 적용합니다.',
    ],
    privacyNote: '응답에 표시된 개인 로컬 경로와 모델명을 불투명 색상으로 가린 공개용 캡처입니다.',
    captures: [{
      title: '분석 응답과 관련 코드 함께 보기',
      detail: '오른쪽에는 localStorage 기반 로그인·로그아웃과 세션 처리 설명이, 왼쪽 편집기에는 관련 소스가 열려 있습니다. getCurrentUser와 setCurrentUser 같은 함수로 근거를 좁혀 볼 수 있습니다. 캡처의 변경 파일 수는 0이며, 브라우저 저장소를 이용한 데모 로그인이지 서버 인증 사례는 아닙니다.',
      src: '/images/si-adoption/read-only/01-codebase-scan.webp',
      alt: 'Antigravity에서 에이전트에 로그인 구현 분석을 요청하고 오른쪽 응답과 왼쪽 js/storage.js를 함께 확인하는 화면. 개인 경로와 모델명은 가림 처리됨',
      caption: '기능 탐색 요청 → 분석 응답 → 관련 소스 확인',
    }],
  },
  implementation: {
    title: '게시판 구현부터 코드 리뷰·화면 수정까지',
    summary: '처음에는 기능과 환경을 정해 구현을 맡기고, 이후에는 코드의 특정 줄과 화면의 특정 요소를 짚어 수정 방향을 전달합니다. 같은 예제를 이어 가며 요구사항, 변경 내용, 화면 결과를 검토하는 흐름입니다.',
    environment: {
      tool: 'Codex 데스크톱 앱',
      project: 'React + Vite + TypeScript · localStorage 게시판·로그인 데모',
    },
    request: 'React·Vite 환경에 공지·자유·문의 카테고리 탭이 있는 리스트형 게시판을 구현하자. localStorage로 게시글을 저장하고 로그인·로그아웃을 구현해 줘.',
    checkpoints: [
      '구현할 기능과 저장 방식, 사용할 환경을 정해 요청합니다.',
      '코드 변경 내용을 읽고 특정 줄에 리뷰를 남긴 뒤 수정된 차이를 확인합니다.',
      '실행 화면의 요소에 주석을 달아 배치 수정을 요청하고 화면 결과를 다시 봅니다.',
    ],
    privacyNote: '예제와 무관한 왼쪽 프로젝트·채팅 이력, 개인 로컬 주소와 모델명을 가렸습니다. 예제 프로젝트와 해당 세션은 그대로 남겼습니다.',
    captures: [
      {
        title: '01 · 구현 요청과 응답',
        detail: '카테고리 탭, 게시글 저장, 로그인·로그아웃을 요청하고 구현 내용과 실행 안내를 받습니다. 계정과 게시글을 localStorage에 저장하는 로컬 데모이며, 실제 공동 이용 서비스에는 서버 인증과 데이터베이스가 필요합니다.',
        src: '/images/si-adoption/implementation/01-implementation-request.webp',
        alt: 'Codex의 에이전트 구현 예제 프로젝트에서 게시판과 로그인 구현을 요청하고 구현 내용과 로컬 데모 한계를 안내받은 화면',
        caption: '기능·환경 지정 → 게시판 구현 응답',
      },
      {
        title: '02 · 코드 리뷰로 수정 요청',
        detail: '변경 사항의 App.tsx를 읽다가 탭 키보드 처리의 연속된 if 문을 짚고, switch 문으로 정리해 달라는 코드 리뷰를 남깁니다. 검토할 위치와 원하는 수정 방향을 함께 전달합니다.',
        src: '/images/si-adoption/implementation/02-code-review-request.webp',
        alt: 'Codex App.tsx 변경 사항에 연속되는 if 문을 switch로 변경해 달라는 코드 리뷰를 작성하는 화면',
        caption: '코드의 특정 줄 선택 → 수정 방향을 리뷰로 전달',
      },
      {
        title: '03 · 수정된 코드 차이 확인',
        detail: '기존 if 문과 변경된 switch(event.key)를 나란히 비교합니다. ArrowLeft·ArrowRight·Home·End 키 처리와 탭 이동·포커스 처리가 요구한 동작을 유지하는지 확인하는 단계입니다.',
        src: '/images/si-adoption/implementation/03-code-review-result.webp',
        alt: '탭 키보드 처리의 연속된 if 문이 switch(event.key)로 변경된 App.tsx 코드 차이',
        caption: '리뷰 반영 결과 → 변경 전후 코드 비교',
      },
      {
        title: '04 · 화면 주석으로 배치 수정 요청',
        detail: '게시판을 브라우저에서 보며 글쓰기 버튼을 직접 선택하고 “버튼을 정렬 드롭다운 옆에 배치”라는 화면 주석을 남깁니다. 긴 위치 설명 대신 실제 요소를 짚어 의도를 전달합니다.',
        src: '/images/si-adoption/implementation/04-screen-annotation.webp',
        alt: 'Codex 브라우저의 글쓰기 버튼에 정렬 드롭다운 옆으로 배치해 달라는 화면 주석을 남기는 장면',
        caption: '실행 화면의 요소 선택 → 화면 주석으로 수정 요청',
      },
      {
        title: '05 · 배치가 반영된 화면 확인',
        detail: '글쓰기 버튼이 정렬 드롭다운 오른쪽으로 옮겨진 화면입니다. 오른쪽 대화에는 후속 작업이 진행 중인 상태가 함께 보이므로, 이 캡처는 배치 반영 장면을 보여 주며 전체 검증 완료를 뜻하지는 않습니다.',
        src: '/images/si-adoption/implementation/05-layout-result.webp',
        alt: '게시판 검색 행의 정렬 드롭다운 오른쪽에 글쓰기 버튼이 배치된 화면과 후속 작업 중인 Codex 대화',
        caption: '화면 수정 반영 → 글쓰기 버튼 배치 확인',
      },
    ],
  },
  tools: {
    title: 'FFmpeg로 소개영상 편집하기 · 컨택트 시트로 장면 확인',
    summary: '소개 페이지의 Android AR 캠프파이어 영상을 에이전트가 FFmpeg로 편집한 사례입니다. 영상에서 추출한 여러 프레임을 격자로 모은 컨택트 시트(Contact Sheet)를 만들어, 장면의 변화와 흐름을 한눈에 비교하며 편집을 진행했습니다.',
    environment: {
      tool: '에이전트 + FFmpeg CLI',
      project: 'Android AR 캠프파이어 소개영상 편집',
    },
    checkpoints: [
      '영상에서 여러 프레임을 추출하고 한 장의 컨택트 시트로 모아, 한 번에 살펴볼 수 있는 확인용 이미지를 만듭니다.',
      '컨택트 시트에서 캠프파이어와 주변 배경의 변화를 비교하고, 여러 시트도 묶어서 확인하며 장면의 흐름을 파악합니다.',
      '확인한 장면을 근거로 에이전트가 FFmpeg 편집을 진행합니다. 정지 프레임만으로 알기 어려운 재생 속도와 전환은 최종 영상에서도 확인할 항목입니다.',
    ],
    applicationNote: {
      title: '영상 편집을 넘어, 동적인 화면 검토에도',
      description: '이 방식은 영상 편집뿐 아니라 게임 제작의 애니메이션·카메라 이동·이펙트, 앱의 화면 전환처럼 시간에 따라 바뀌는 화면을 확인하는 다양한 작업에도 활용할 수 있습니다. 실행 장면을 녹화하고 여러 시점의 프레임을 컨택트 시트로 모으면 변화와 이상 징후를 한눈에 비교하기 쉽습니다.',
    },
    privacyNote: '첨부 원본은 보존하고 가로·세로 크기를 유지한 WebP 공개용 사본입니다. 컨택트 시트는 장면 확인을 돕는 자료이며, 최종 영상 재생을 대신하지는 않습니다.',
    portrait: true,
    frameAspectRatio: '834 / 1221',
    relatedLink: { href: '/about-me/#archive-android-ar-campfire', label: '소개 페이지의 AR 캠프파이어 영상 보기' },
    captures: [
      {
        title: '01 · 캠프파이어 소개영상의 한 장면',
        detail: '소개 페이지의 Android AR 캠프파이어 시연 장면입니다. 나무와 건물이 있는 주변 공간 속에 점화된 캠프파이어가 보입니다. 뒤의 컨택트 시트와 검토 화면은 이런 영상의 여러 프레임을 모아 장면 흐름을 확인하며 편집한 과정을 보여 줍니다.',
        src: '/images/archive/android-ar-campfire/03-final-background.webp',
        alt: '나무와 건물이 있는 주변 공간 중앙에 점화된 AR 캠프파이어가 놓인 Android 앱 시연 화면',
        caption: 'Android AR 캠프파이어 소개영상 · 점화 장면',
      },
      {
        title: '02 · 여러 프레임을 한 장의 컨택트 시트로 확인',
        detail: '세로 영상의 프레임 24개를 6열·4행으로 배치한 컨택트 시트입니다. 각 프레임을 따로 여는 대신 캠프파이어와 나무·주변 공간의 변화를 한 화면에서 비교하며, 영상의 흐름을 파악하는 근거로 사용했습니다.',
        src: '/images/si-adoption/tools/01-ffmpeg-frame-grid.webp',
        alt: 'Android AR 캠프파이어 영상의 프레임 24개를 6열·4행의 컨택트 시트로 모아 주변 공간과 장면 변화를 비교하는 이미지',
        caption: '프레임 추출 → 6열·4행 컨택트 시트 → 장면 흐름 확인',
      },
      {
        title: '03 · 여러 컨택트 시트를 묶어 순차적으로 검토',
        detail: '에이전트가 컨택트 시트 3개씩을 묶어서 확인한 화면입니다. 작은 썸네일 하나에도 여러 영상 프레임이 들어 있어, 여러 시점의 장면을 모아 살펴보며 FFmpeg 편집에 필요한 판단을 이어 갔습니다.',
        src: '/images/si-adoption/tools/02-ffmpeg-grid-review.webp',
        alt: '에이전트 대화에서 여러 컨택트 시트를 3개씩 묶어 확인한 내역이 세 묶음으로 표시된 화면',
        caption: '컨택트 시트 묶음 확인 → 장면 파악 → FFmpeg 편집',
      },
    ],
  },
};

export interface AiWorkflowTool {
  id: string;
  name: string;
  detail: string;
  icon: string;
}

export interface AiWorkflowStoryCapture {
  src: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
}

export interface AiWorkflowStory {
  title: string;
  summary: string;
  environment: { tool: string; project: string };
  sections: { id: string; title: string; paragraphs: string[]; capture?: AiWorkflowStoryCapture }[];
  privacyNote: string;
}

/** 05 단계는 본문과 이미지를 읽는 순서대로 배치하며 캡처 캐러셀을 사용하지 않습니다. */
export const aiWorkflowStories: Partial<Record<AiWorkflowStageId, AiWorkflowStory>> = {
  orchestration: {
    title: '세션 간 메시지로 연결된 프로젝트의 작업 조율하기',
    summary: '공용 인프라와 이커머스 데모의 대표 세션이 Claude 데스크톱 앱의 내장 세션 간 메시지 전송 기능으로 정보를 주고받으며 협업하는 사례입니다. 인프라 작업 전 이를 사용하는 프로젝트에 미리 알리고, 각 세션이 자기 작업에 미칠 영향을 판단하며 진행을 맞춥니다.',
    environment: {
      tool: 'Claude 데스크톱 앱 · 내장 세션 간 메시지 전송',
      project: '공용 인프라 ↔ 이커머스 데모',
    },
    sections: [
      {
        id: 'sessions',
        title: '프로젝트별 대표 세션이 작업을 조율하고 관리하기',
        paragraphs: [
          '화면에 보이는 공용 인프라 세션과 이커머스 데모 세션은 각 프로젝트의 작업을 조율하고 관리하는 대표 세션입니다. 프로젝트별 맥락을 유지하면서, 다른 프로젝트에 영향을 주는 작업은 앱의 내장 메시지 기능으로 관련 대표 세션에 알립니다.',
          '각 대표 세션은 서브에이전트를 통해 구현·검증·문서화 등의 작업을 진행합니다. 필요한 작업을 나눠 맡기고 진행 상황과 결과를 확인하며, 프로젝트 전체의 작업 흐름을 관리합니다.',
        ],
        capture: {
          src: '/images/si-adoption/orchestration/01-session-handoff.webp',
          alt: '공용 인프라와 이커머스 데모 두 프로젝트의 세 세션 목록, 인수 보고를 확인하고 대기를 요청하는 대화가 보이는 화면. 다른 세션과 식별 정보는 가려져 있습니다.',
          caption: '프로젝트별 대표 세션과 작업 조율 대화',
          width: 2812,
          height: 1490,
        },
      },
      {
        id: 'pre-notice',
        title: '인프라 작업 전에 사용하는 프로젝트에 미리 알리기',
        paragraphs: [
          '파일 서버 재기동을 앞둔 인프라 세션이, 이를 사용하는 이커머스 데모 세션에 메시지를 보냅니다. 작업 내용과 예상 중단 시간, 영향을 받는 기능과 영향이 없는 기능을 함께 전달합니다.',
          '캡처 상단의 ‘공용 인프라 프로젝트 클로드의 메시지’가 다른 세션에서 도착한 사전 통보입니다. 이커머스 데모 세션은 당시 업로드 작업을 진행하고 있지 않다는 점을 근거로, 자기 작업에는 영향이 없다고 정리합니다.',
        ],
        capture: {
          src: '/images/si-adoption/orchestration/02-session-pre-notice.webp',
          alt: 'Claude 데스크톱 앱에서 공용 인프라 세션이 보낸 파일 서버 재기동 사전 통보 메시지와, 당시 업로드 작업이 없어 영향이 없다고 판단하는 이커머스 데모 세션의 답변',
          caption: '인프라 세션의 작업 전 사전 통보 → 이커머스 데모 세션의 수신·영향 판단',
          width: 1237,
          height: 315,
        },
      },
      {
        id: 'coordination',
        title: '자기 작업뿐 아니라 연결된 프로젝트의 영향까지 조율하기',
        paragraphs: [
          '공용 인프라를 바꾸는 세션과 이를 사용하는 프로젝트의 세션은 보는 범위가 다릅니다. 세션 간 메시지로 변경 예정 사항과 작업 상태를 주고받으면, 각자의 맥락을 유지하면서도 프로젝트 사이의 의존성을 고려해 협업할 수 있습니다.',
        ],
      },
    ],
    privacyNote: '원본은 보존하고 공개용 사본에서 지정한 두 프로젝트·세 세션 외의 목록과 각 캡처의 계정 식별자·파일명·경로 등 식별 정보를 불투명하게 가렸습니다.',
  },
};

/** 연결 도구의 예시입니다. 아이콘 목록이 현재 연결 상태나 모든 작업 권한을 뜻하지는 않습니다. */
export const aiWorkflowTools = [
  { id: 'github', name: 'GitHub', detail: '저장소·협업 관리', icon: '/icons/workflow-tools/github.svg' },
  { id: 'notion', name: 'Notion', detail: '문서·지식 정리', icon: '/icons/workflow-tools/notion.svg' },
  { id: 'jira', name: 'Jira', detail: '이슈·작업 관리', icon: '/icons/workflow-tools/jira.svg' },
  { id: 'openpencil', name: 'OpenPencil', detail: 'UI·레이아웃 디자인', icon: '/icons/workflow-tools/openpencil.svg' },
  { id: 'colab', name: 'Colab', detail: '노트북·실험 환경', icon: '/icons/workflow-tools/googlecolab.svg' },
  { id: 'unity', name: 'Unity', detail: '게임·에디터 작업', icon: '/icons/workflow-tools/unity.svg' },
  { id: 'blender', name: 'Blender', detail: '3D 모델링·에셋 제작', icon: '/icons/workflow-tools/blender.svg' },
] as const;

export const aiWorkflowCliTools = [
  { id: 'git', name: 'Git', detail: '소스·버전 관리', icon: '/icons/workflow-tools/git.svg' },
  { id: 'ffmpeg', name: 'FFmpeg', detail: '영상·음원 변환', icon: '/icons/workflow-tools/ffmpeg.svg' },
  { id: 'gcloud', name: 'Google Cloud CLI', detail: '클라우드 자원 관리', icon: '/icons/workflow-tools/googlecloud.svg' },
  { id: 'adb', name: 'ADB', detail: '안드로이드 앱·기기 디버깅', icon: '/icons/workflow-tools/android.svg' },
  { id: 'podman', name: 'Podman', detail: '컨테이너·이미지 관리', icon: '/icons/workflow-tools/podman-symbol.webp' },
] as const;

export const aiWorkflowToolGroups: readonly { id: string; title: string; description: string; tools: readonly AiWorkflowTool[] }[] = [
  { id: 'mcp', title: 'MCP·플러그인', description: '연결된 도구의 기능을 호출해 외부 서비스와 작업 환경을 다루는 예시입니다.', tools: aiWorkflowTools },
  { id: 'cli', title: 'CLI · 명령줄 도구', description: '터미널에서 명령을 실행해 작업하고 결과를 확인하는 예시입니다.', tools: aiWorkflowCliTools },
];
