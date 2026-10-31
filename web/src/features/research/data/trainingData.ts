/**
 * 연구 경험 오픈웨이트 모델 실험 탭의 학습 데이터 형식·한 줄 구성·예시 콘텐츠다.
 * 표현 계층을 알지 않으며, 예시는 1차 학습 세트의 실제 줄에서 사람이 읽을 부분만 남겼다.
 */

/** 미세조정 학습 데이터를 적는 대표 형식 하나. `shape`는 한 줄의 필드 모양만 보이는 자리표시다. */
export interface TrainingDataFormat {
  id: string;
  name: string;
  shape: Record<string, unknown>;
  desc: string;
  /** 이 챗봇의 학습에 쓴 형식이면 true. */
  used?: boolean;
}

/** 예시 카드에서 생략한 부분이 실제 학습 줄의 어디에 있는지다. */
export interface TrainingLinePart {
  label: string;
  location: string;
  desc: string;
}

/** 메인 세션의 도구 호출 한 번과 서버가 돌려준 결과. 호출만 학습용 정답이다. */
export interface TrainingExampleStep {
  call: { name: string; arguments: Record<string, string> };
  result: Record<string, unknown>;
}

export interface TrainingExample {
  id: string;
  title: string;
  question: string;
  steps: TrainingExampleStep[];
  answer: string;
  intent: string;
  /** 학습 의도 아래에 강조해 보일 한 문장. 시점에 따라 값이 달라지는 예시의 기준을 밝힐 때 쓴다. */
  note?: string;
}

export const trainingDataFormats: readonly TrainingDataFormat[] = [
  {
    id: 'alpaca',
    name: 'Alpaca (지시형)',
    shape: { instruction: '지시', input: '추가 입력(선택)', output: '정답' },
    desc: '지시와 정답 한 쌍으로 된 단일 턴 형식입니다. 앞선 대화나 도구 호출을 담을 자리가 없습니다.',
  },
  {
    id: 'prompt-completion',
    name: 'Prompt · Completion',
    shape: { prompt: '앞부분', completion: '이어질 정답' },
    desc: '앞부분 뒤에 이어질 정답을 붙이는 형식입니다. 대화 역할 구분 없이 글을 이어 쓰게 하는 학습에 맞습니다.',
  },
  {
    id: 'sharegpt',
    name: 'ShareGPT',
    shape: { conversations: [{ from: 'human', value: '질문' }, { from: 'gpt', value: '답변' }] },
    desc: '여러 턴 대화를 from·value로 적는 형식입니다. 도구 호출을 적는 표준 표기가 없어 학습 도구마다 다르게 변환합니다.',
  },
  {
    id: 'preference',
    name: 'Preference (선호도 · DPO)',
    shape: { prompt: '질문', chosen: '더 나은 답', rejected: '덜 나은 답' },
    desc: '같은 질문의 두 답 가운데 나은 쪽을 고르게 하는 선호도 학습 형식입니다. 정답을 그대로 따라 쓰게 하는 지도 미세조정(SFT)과는 학습 방식이 다릅니다.',
  },
  {
    id: 'conversational',
    name: 'Conversational (채팅 메시지)',
    shape: {
      messages: [
        { role: 'system', content: '지침' },
        { role: 'user', content: '질문' },
        { role: 'assistant', content: '답변' },
      ],
      tools: ['도구 정의'],
    },
    desc: 'OpenAI 채팅 규격과 같은 messages 형식입니다. 역할(system·user·assistant·tool)과 도구 호출·도구 결과를 대화 순서대로 담으며, Hugging Face TRL에서는 conversational 형식이라고 부릅니다.',
    used: true,
  },
];

export const trainingFormatChoice = {
  title: '이 형식으로 학습한 이유',
  reasons: [
    '메인 세션은 검색·작업 위임 도구를 부르고 그 결과를 읽은 뒤 답합니다. 도구 호출과 결과를 대화 순서대로 담을 수 있는 형식이 필요했습니다.',
    '운영 서버가 모델에 보내는 요청도 같은 messages·tools 모양이라, 학습할 때와 실제로 쓸 때 모델이 받는 입력이 같습니다.',
  ],
} as const;

/** 예시 카드 "일반 질문"의 실제 학습 줄을 생략 표시와 함께 줄인 모양이다. */
export const trainingLineSkeleton = {
  messages: [
    { role: 'system', content: '… 메인 세션 시스템 지침 11,339자 …' },
    { role: 'user', content: '연구 경험 한 줄 요약해줘\n\n… 검색 상기 문구 86자 …' },
    {
      role: 'assistant',
      content: '',
      tool_calls: [{
        id: 'call_1',
        type: 'function',
        function: { name: 'search_portfolio', arguments: '{"query":"연구 경험 요약"}' },
      }],
    },
    { role: 'tool', tool_call_id: 'call_1', content: '{"ok":true,"results":[ … 검색 조각 5개 … ]}' },
    { role: 'assistant', content: '학창 시절 하드웨어 성능 측정에서 시작해, … 넓힌 개인 연구입니다.' },
  ],
  tools: ['… search_portfolio · site_task · get_current_datetime 정의 …'],
} as const;

export const trainingLineParts: readonly TrainingLinePart[] = [
  {
    label: '시스템 지침',
    location: 'messages[0]',
    desc: '모든 줄의 맨 앞에 같은 지침이 들어갑니다. 1차 학습 데이터는 기반 모델용 전체 지침(11,339자)으로 만들었고, 지금 쓰는 메인 LoRA는 간결 지침(1,625자)으로 만든 학습 데이터로 학습했습니다.',
  },
  {
    label: '도구 정의',
    location: 'tools',
    desc: '메인 세션이 쓸 수 있는 검색·작업 위임·시계 도구 3개의 이름·설명·인자 형식입니다. 모델이 읽는 입력이라 학습 정답에는 들어가지 않습니다.',
  },
  {
    label: '호출 ID',
    location: 'tool_calls[].id · tool_call_id',
    desc: '어떤 결과가 어떤 호출의 응답인지 잇는 값입니다.',
  },
  {
    label: '검색 상기 문구',
    location: '방문자 메시지 끝',
    desc: '사실을 답하기 전에 새로 검색하라는 86자 문구가 운영과 같이 붙습니다.',
  },
  {
    label: '앞선 대화',
    location: '여러 턴 장면의 이전 턴',
    desc: '긴 대화 장면은 앞선 턴까지 한 줄에 담고, 앞선 턴의 호출·답변은 정답에서 뺍니다(weight 0).',
  },
  {
    label: '도구 결과 전체',
    location: 'role: "tool"',
    desc: '카드에는 필요한 값만 남겼고, 실제 줄에는 검색 조각의 제목·위치·본문이 모두 들어갑니다.',
  },
  {
    label: '인자 표기',
    location: 'function.arguments',
    desc: '카드에서는 객체로 보이지만 실제로는 JSON 문자열입니다.',
  },
];

export const trainingLossNote =
  '정답, 곧 손실을 계산하는 부분은 마지막 턴의 assistant 메시지(도구 호출과 답변)입니다. 학습 도구는 행마다 마지막 assistant 메시지에만 손실을 걸기 때문에, 한 줄을 호출에서 끝나는 행과 답변에서 끝나는 행으로 펼쳐 넣었습니다. 1차 메인 학습 세트는 이렇게 298줄이 579행이 되었습니다.';

export const trainingExamplesDescription =
  '방문자 질문을 받은 메인 세션이 도구를 부르고, 돌아온 결과를 근거로 답하는 흐름으로 구성한 학습 데이터 예시입니다. 도구 호출과 답변은 모델의 실행 결과가 아닌 학습용 정답이고, 도구 결과는 정답이 아닌 입력입니다. 방문자 대화 기록이 아니며, 시스템 지침·도구 정의·호출 ID 등은 생략하고 도구 결과는 필요한 값만 남겼습니다.';

export const trainingExamples: readonly TrainingExample[] = [
  {
    id: 'general-question',
    title: '일반 질문 · 검색 후 답변',
    question: '연구 경험 한 줄 요약해줘',
    steps: [
      { call: { name: 'search_portfolio', arguments: { query: '연구 경험 요약' } },
        result: { ok: true, results: [
          { section: '연구 경험 타임라인과 성능 최적화 실험 > 학창 시절 하드웨어 연구 (2011년)',
            content: 'CPU 오버클럭 환경을 구성하고 안정화 작업을 수행하며 하드웨어 벤치마크로 성능과 안정성을 측정했어요.' },
          { section: '현업 이력 공백기의 게임 개발과 기술 탐구 > 한 줄 요약',
            content: '개인 게임 개발을 출발점으로 Unity와 C#을 탐구했고, 구현 과정에서 만난 문제를 계기로 성능 최적화와 관련 개념을 학습·실험하는 방향으로 범위를 넓혔어요.' },
          { section: 'SI 에이전트 오케스트레이션 기반 개발 > 한 줄 요약',
            content: '사람이 프로젝트의 방향과 구상을 결정하고, PM·PL·구현·검증 역할로 분리한 SI 에이전트 세션이 작업을 분담하고 검증하도록 구성한 개발 방식이다.' },
        ] } },
    ],
    answer: '학창 시절 하드웨어 성능 측정에서 시작해, Unity·C# 개인 게임 개발을 출발점으로 성능 최적화를 학습·실험했고, 지금은 SI 에이전트 오케스트레이션으로 범위를 넓힌 개인 연구입니다.',
    intent: '포트폴리오 사실은 먼저 검색으로 찾고, 여러 검색 결과를 한 줄로 묶되 결과에 없는 사실은 덧붙이지 않습니다.',
  },
  {
    id: 'screen-task',
    title: '화면 조작 요청 · 작업 세션 위임',
    question: '작년 연구로 가고 다크 모드로 바꿔줘',
    steps: [
      { call: { name: 'site_task', arguments: { instruction: '작년 연구로 이동하고 다크 모드로 바꿔 줘' } },
        result: { status: 'completed', report: '작년인 2025년 연구로 이동하고 테마를 다크 모드로 바꿨습니다.', actions: [
          { tool: 'get_current_datetime', arguments: {}, ok: true, observed: { year: 2026, relativeYears: { 작년: 2025 } } },
          { tool: 'control_portfolio_view', arguments: { action: 'research-2025' }, ok: true },
          { tool: 'set_portfolio_theme', arguments: { theme: 'dark' }, ok: true },
        ] } },
    ],
    answer: '작년인 2025년 연구로 이동하고 다크 모드로 바꿨습니다.',
    intent: '화면 조작은 작업 세션에 한 번에 맡기고, 성공으로 기록된 조작만 했다고 답합니다. "작년"은 요청 시점에 따라 달라져 작업 세션이 서버 시계로 연도를 확인합니다.',
    note: '이 예시는 2026년 기준이라 2025년입니다.',
  },
];
