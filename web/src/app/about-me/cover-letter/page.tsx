/**
 * 자기소개서의 서사와 핵심 가치 섹션을 순서대로 표현하는 정적 서버 컴포넌트다.
 * 현재 콘텐츠가 고정된 단일 문서이므로 데이터 계층을 억지로 추가하지 않고,
 * 페이지 내부의 문서 구조와 가독성에만 책임을 둔다.
 */
import React from 'react';
import Link from 'next/link';
import { Callout, Panel, cardClassName } from '@/components/surface/Surface';
import { AskAiButton } from '@/features/chat';
import CareerTurningPointPreview from '@/features/profile/ui/CareerTurningPointPreview';
import LogReadingLink from '@/features/logs/navigation/LogReadingLink';
import SimdRecordChallenge from '@/features/research/ui/SimdRecordChallenge';

/** 강점: 본인이 확인한 강점(지식 문서 profile.md 핵심 강점과 같은 내용). paragraphs는 강점 설명 뒤에 그로 인해 만들 수 있는 가치를 잇는다. */
const STRENGTHS = [
  {
    title: '전체 연결 구조를 보는 시야',
    paragraphs: [
      '웹·앱·서버부터 네트워크·홈서버 같은 인프라, CPU·메모리·SIMD 같은 로우레벨까지 직접 다뤄 와서, 기능 하나보다 요청이 화면에서 하드웨어까지 어떻게 이어지는지를 먼저 봅니다.',
      '문제가 생겼을 때 겉으로 보이는 증상이 아니라 실제 원인을 찾아 해결하는 데 도움이 될 수 있습니다.',
    ],
  },
  {
    title: '측정으로 찾는 병목',
    paragraphs: [
      'CPU·메모리·I/O를 직접 측정해 성능 병목을 찾고, 측정 가능한 근거로 해결책을 검증합니다.',
      '어디부터 개선할지를 수치로 보여 주며 팀의 판단을 도울 수 있습니다.',
    ],
  },
  {
    title: 'AI·SI 에이전트에 대한 관심과 활용',
    paragraphs: [
      '새로 나오는 AI·SI 도구를 꾸준히 직접 써 보며, 코드 작성에 그치지 않고 조사와 학습, 인프라 운영, 3D 모델링과 영상 제작까지 AI·SI 에이전트로 실험해 왔습니다. 여러 에이전트에 역할을 나눠 맡기고, 결과는 교차 확인과 직접 테스트로 검증합니다.',
      '팀이 AI·SI 에이전트를 여러 업무에 안전하고 효율적으로 도입하는 데 도움이 될 수 있습니다.',
    ],
  },
];

/** 장단점의 장점: 성향·태도에서 나오는 장점(강점은 역량, 장점은 성향으로 나눈다). paragraphs는 카드 안 문단. */
const MERITS = [
  {
    title: '다양한 경험을 통해 다듬은 태도',
    paragraphs: [
      'IT 직장에서 운영실부터 개발팀까지 거친 경험에, 아버지의 금형 임가공 공장 일을 도우며 겪은 제조 현장의 경험이 더해져 있습니다.',
      '직장 밖에서도 학원이나 온라인에서 모여 스터디와 작은 사이드 프로젝트를 함께하며 다양한 사람을 만나 봤습니다. 다른 사람을 도와주기도 하고, 직접 사람을 고용해 일을 맡겨 보기도 했습니다.',
      '그 과정에서 보고 겪은 일들을 참고 삼아, 사람을 대하는 태도뿐 아니라 조직 문화와 업무를 대하는 태도를 다듬어 왔고, 지금도 다듬어 가고 있습니다.',
    ],
    logs: [{ slug: 'rules-need-both-compliance-and-enforceable-structure', title: '사소해 보이는 규칙을 지키는 태도와 협업의 관계' }],
  },
  {
    title: '선택지를 정리하고, 정해진 결정은 따르는 협업',
    paragraphs: [
      '다른 의견과 구현 방식에 배타적이지 않고, 가능하면 직접 테스트해 보고 판단합니다.',
      '구조를 바꿔야 할 때는 지금 방식을 유지하는 안과 옮겨 가는 안의 단기 안정성, 장기 기술 부채, 전환 비용과 위험을 함께 정리해 제시합니다. 제 추천안도 밝히지만, 최종 선택은 결정권자의 몫으로 둡니다.',
      '방향이 정해지면, 윤리적인 문제가 없는 한 제 추천과 달라도 선택된 방식 안에서 최선을 찾습니다.',
    ],
  },
];

/** 장단점의 단점과 보완 방식: 성향에서 나오는 단점(지식 문서 profile.md 약점과 보완 방식과 같은 내용). examples는 단점 아래 짧은 예시 목록. */
const FLAWS = [
  {
    title: '윤리적·법적 사안에 대한 문제 제기',
    weakness: '윤리적·법적으로 문제가 될 수 있는 부분이 보이면 문제의식을 꾸준히 언급하며 보완이 필요하다고 말하는 편입니다. 조직에 따라서는 이런 모습이 피로감으로 느껴질 수 있습니다.',
    // 공개 기록(회색지대·사업의 건전성)에 있는 사례만 든다. 관련 기록(logs)에는 회색지대 기록만 건다(사업의 건전성 기록은 아래 합법성과 윤리 카드에 있다).
    examples: [
      '업무나 사용자의 편의를 위해서라도, 모바일 앱에서 와이파이 비밀번호를 알아내는 기능을 넣으면 안 되는 이유',
      '고객의 돈을 받는 절차만 있고 환불에 대한 절차는 없는 구조가 위험한 이유',
    ],
    remedy: '문제를 말할 때는 위험만 되풀이하지 않고, 현실적으로 적용할 수 있는 대안을 함께 제시합니다. 충분히 설명한 뒤에는 팀의 결정을 존중하고, 다시 짚는 것은 피해가 크고 예측 가능한 사안으로 한정합니다.',
    logs: [{ slug: 'developer-responsibility-does-not-disappear-in-gray-areas', title: '회색지대에서도 개발자의 책임은 사라지지 않습니다' }],
  },
  {
    title: '프로그래밍의 표준과 정석에 대한 집착',
    weakness: '코드 스타일부터 설계와 구조, 오류 처리, 테스트까지 사용 언어와 기술적 문맥에 맞는 표준과 정석을 따르고 싶은 성향이 있어, 이와 크게 다른 구현을 보면 스트레스를 받는 편입니다. 예전에는 이것이 바로잡으려는 고집으로 이어지기도 했습니다.',
    remedy: '표준을 찾고 지키려는 건 여전히 중요하게 생각하지만, 팀에서는 합의한 방식을 우선 기준으로 정하고 그대로 따릅니다. 여건이 될 때는 관심 있는 동료들과 스터디를 열어 함께 학습하고, 현행 코드에 어떻게 적용할지 고민하는 방식으로 개선을 유도하기도 합니다.',
    logs: [
      { slug: 'do-not-call-restful-and-rpc-the-same', title: 'RESTful과 RPC를 구분해서 불러야 하는 이유' },
      { slug: 'why-object-oriented-design-matters-more-in-the-ai-era', title: 'AI·SI 에이전트를 활용하면서 객체지향 설계가 더 중요해진 이유' },
    ],
  },
];

/** 약점과 그에 대한 생각: 이력·조건에서 오는 약점(성향에서 나오는 단점은 FLAWS). remedyMore는 생각 아래 이어지는 문단들. */
const WEAKNESSES = [
  {
    title: '공백 이력',
    // 시작 시점만 적는다(이력서 '독립 학습·개인 프로젝트'가 시작한 2022.02). 끝을 '현재'로 적으면 읽는 때마다 뜻이 달라진다.
    weakness: '2022년 2월부터 정규 현업 이력에 공백이 있습니다.',
    remedy: '게임 개발을 시작하면서 C#과 Unity를 비롯해 기술적·개념적 관점을 넓힌 시기였습니다. 대외적인 활동은 멈췄지만 개발까지 멈춘 것은 아니었고, 그렇게 확보한 시간과 여유를 온전히 해 보고 싶었던 것들에 쓰며 부수적으로 역량을 강화했습니다.',
    remedyMore: ['개인적인 경험과 관심, 재미를 제쳐 두더라도 역량을 키우기 위해 반드시 필요했던 시간이라고 생각합니다. 이 기간의 학습·구현·연구는 이 사이트의 연구와 실험 기록으로 일부 남겨 두었습니다.'],
    logs: [{ slug: 'every-learning-and-research-effort-has-a-cost', title: '모든 학습과 연구에는 비용이 듭니다' }],
  },
  {
    title: '학력 및 자격증',
    weakness: '대학을 중퇴했고 보유한 자격증도 적은 편입니다. 공공기관이나 파견과 같은 제3자 계약처럼 서류상의 스펙을 갖춰야 하는 자리에서는 불리할 수 있습니다.',
    remedy: '정말 필요하고 유용한 것들만 찾아 골라도 해 볼 것이 산더미인데, 보여주기식 이력을 위해 시간을 쓰는 것이 아까웠습니다. 비록 지금은 후회되는 순간들이 간혹 있지만, 개인의 학습 관점에서는 더 효율적인 선택이었다고 확신합니다.',
    remedyMore: ['서류상의 스펙이 부족하다 보니, 스펙이 필요한 자리보다 실제로 문제를 해결해야 하는 자리에서 일하는 것이 저에게도, 함께 일하는 곳에도 맞는 선택이라고 생각합니다.'],
  },
];

/** 함께 일할 때 중요하게 보는 것(지식 문서 employment-preferences.md 중요하게 보는 조건과 같은 순서). required는 필수 조건, detail은 본문 아래 따로 두는 문단들. */
const PRIORITIES = [
  {
    title: '합법성과 윤리',
    required: true,
    body: '사용자 피해와 불법·비윤리적 행위는 타협하지 않습니다.',
    detail: [
      '법 조항에 걸리는지만 보는 것이 아닌, 그 일이 실제로 누군가에게 피해를 줄 수 있는지를 기준으로 판단합니다.',
      '법과 제도는 만들어지는 과정이나 내용이 항상 옳지만은 않고, 바뀌기도 하며, 새로운 기술처럼 아직 제도가 갖춰지지 않은 영역도 있기 때문입니다.',
    ],
    log: { lead: '이 기준을 더 분명히 갖게 된 계기', slug: 'scale-and-appearance-do-not-guarantee-business-integrity', title: '규모와 외형이 사업의 건전성을 보장하지는 않습니다' },
  },
  {
    title: 'AI·SI 에이전트를 실제 업무에 쓸 수 있는 환경',
    required: true,
    body: 'AI·SI 에이전트 사용을 형식적으로 허용하는 데 그치지 않고, 실제 업무에 바로 활용할 수 있는 환경이어야 합니다.',
    detail: ['AI·SI 에이전트를 쓸 수 없는 폐쇄망 같은 환경에서는 지금의 작업 방식을 이어 가기 어렵습니다.'],
  },
  {
    title: '최고의 복지는 동료',
    body: '좋은 동료와 함께 일하는 것이 어떤 제도보다 큰 복지라고 생각합니다.',
    detail: ['아는 것을 먼저 나누고, 서로 다른 경험과 관점으로 각자의 빈틈을 채우며 함께 성장하는 관계를 원합니다.'],
    log: { lead: '이 생각을 자세히 쓴 글', slug: 'mutual-respect-creates-a-virtuous-cycle-of-knowledge', title: '상호 존중이 만드는 지식의 선순환' },
  },
  {
    title: '근무지까지의 거리',
    body: '회사 사무실이든 파견지든 프로젝트 현장이든, 매일 오가는 거리는 오래 꾸준히 일할 수 있는지에 직접 영향을 줍니다.',
    detail: ['파견 근무 자체는 가능하지만, 근무지가 가능한 한 편도 1시간 안쪽인지를 중요하게 봅니다.'],
  },
  {
    title: '깊이 몰입할 수 있는 시간',
    body: '잦은 방해 없이 깊게 몰입할 수 있는 시간이 결과 품질로 이어진다고 생각합니다.',
    detail: [
      '집중 시간을 확보하기 위해 약 두 달간 격일 밤샘까지 해 본 적이 있습니다.',
      '몰입할 수 있는 시간은 지금도 중요하게 생각하지만, 이때의 경험 이후로는 과도하게 무리하지 않도록 조심하고 있습니다. 운동도 기능을 끌어올리기보다 건강을 유지하기 위한 것으로 대하게 됐습니다.',
    ],
    log: { lead: '이때의 기록', slug: 'recovery-after-alternate-all-nighters', title: '격일 밤샘 이후의 회복 기록' },
  },
];

/** 취미와 관심사(지식 문서 personality-and-priorities.md 취미와 관심사와 같은 내용). */
const HOBBIES = [
  {
    title: 'AI·SI 에이전트 실험',
    body: '떠오른 생각을 AI·SI 에이전트와 함께 바로 만들어 보고 결과를 확인하는 일이 지금 가장 많은 시간을 쓰는 취미입니다.',
  },
  {
    title: '하드웨어·홈서버·자동화',
    body: '하드웨어 구성과 벤치마킹, 홈서버와 자동화, 새로 나온 AI·SI 도구 써 보기가 서로 이어진 컴퓨터 취미입니다.',
  },
  {
    title: '가벼운 운동',
    body: '일주일에 서너 번 가벼운 스트레칭과 웨이트 트레이닝을 합니다. 격일 밤샘 이후 회복에 오랜 시간이 걸린 경험이 있어, 지금은 기록을 늘리기보다 건강과 일상의 컨디션을 유지하기 위한 적당한 노력으로 운동을 대하고 있습니다.',
    logs: [
      { slug: 'health-as-the-most-important-long-term-asset', title: '건강을 가장 중요한 장기 자산으로 보는 이유' },
      { slug: 'recovery-after-alternate-all-nighters', title: '격일 밤샘 이후의 회복 기록' },
    ],
  },
  {
    title: '게임 플레이·분석·제작',
    body: '최근 직접 플레이하는 시간은 많지 않지만, 게임 영상을 보며 장르와 구성 요소를 분석하고, 취미로 직접 제작하면서 다양한 실험을 하고 있습니다.',
  },
];
/** 핵심 가치(지식 문서 profile.md 핵심 가치와 같은 내용). */
const CORE_VALUES = [
  {
    title: '본질 추구',
    body: '표면적인 문제보다 그 이면에 있는 진짜 원인을 찾아 해결합니다.',
    question: '가치관 중 「본질 추구」가 실제 문제 해결 과정에서 드러난 사례를 알려 주세요.',
  },
  {
    title: '빠른 실행',
    body: '완벽함보다는 완성에 초점을 맞추며, 빠르게 검증하고 개선해 나갑니다.',
    question: '가치관 중 「빠른 실행」을 PoC와 검증 과정에서 어떻게 적용하는지 알려 주세요.',
  },
  {
    title: '투명한 소통',
    body: '솔직하게 공유하고 협력할 때 최고의 결과물이 나온다고 믿습니다.',
    question: '가치관 중 「투명한 소통」을 협업에서 어떻게 실천하는지 알려 주세요.',
  },
];

/** 성향(지식 문서 profile.md 자기소개서 성격 항목과 같은 내용). bodyMore는 본문 아래 이어지는 문단들. */
const TRAITS = [
  {
    label: '기술자',
    title: '사업가보다는 기술자에 가까운 성향',
    body: '투자를 받으려면 어느 정도의 과장이 필요하다는 것은 알지만, 기술적으로 아직 어려운 것을 이미 가능한 것처럼 말하는 일은 잘 맞지 않습니다.',
    bodyMore: ['대신 내부에서 실험하고 실측하며 기술을 개선하고, 실제로 어디까지 가능한지 근거를 찾는 일은 즐겁게 합니다.'],
  },
  {
    label: '탐구',
    title: '오래 파고들고 직접 확인하는 편',
    body: '생각과 상상이 많은 편이라, 관심 있는 문제는 여러 관점에서 오래 파고들고 직접 시험해 원인을 확인합니다. 궁금한 것은 설명을 읽는 데서 그치지 않고 직접 만들어 보며 이해합니다.',
    bodyMore: ['답을 찾은 뒤에도 왜 그렇게 되는지 납득될 때까지 한 단계 더 들어가 보고, 예상과 다른 결과가 나와도 실패로 끝내지 않고 다음 가설을 세워 다시 확인합니다.'],
  },
  {
    label: '직업 윤리',
    title: '할 수 있는지보다 해도 되는지를 먼저 보는 윤리의식',
    body: '프로그래머는 기술로 많은 것을 할 수 있는 만큼, 그에 따른 책임도 크다고 생각합니다. 구현할 수 있더라도 윤리적·법적으로 문제가 없는지를 먼저 판단하며, 저작권과 라이선스도 중요하게 생각합니다. 사기나 도박 등 부정한 목적에 기술을 사용하는 것은 원하지 않습니다.',
  },
];

/**
 * 채용 과제와 코딩 테스트(지식 문서 employment-preferences.md 채용 과제와 코딩 테스트와 같은 내용).
 * 참여하는 것부터 하지 않는 것 순서로 둔다. tone은 꼬리표 색(join: 강조, 나머지: 중립).
 */
/** 함께 일하게 된다면(입사 후 포부). 자기소개서를 조건이 아닌 함께 일할 그림으로 닫는다. */
const AMBITIONS = [
  {
    title: '빠르게 검증하고, 기능으로',
    body: '새로운 아이디어는 PoC(Proof of Concept, 개념 증명) 검증을 통해 빠르게 시험해 보고, 효과가 확인되면 실제 기능에 반영해 개선합니다.',
  },
  {
    title: '기존 시스템을 더 나은 구조로',
    body: '운영 중인 시스템의 구조와 성능을 살펴보고, 측정을 바탕으로 개선할 부분을 찾아 방안을 제안하고, 단계적으로 다듬어 가도록 도울 수 있습니다.',
  },
  {
    title: '경험을 나누며 함께 성장하는 동료로',
    body: 'AI·SI 에이전트로 실험하며 알게 된 것들과 앞으로 알게 될 것들을 꾸준히 팀과 공유하고, 동료의 경험에서 배우며 함께 성장합니다.',
  },
] as const;

const HIRING_TESTS = [
  {
    tag: '참여',
    tone: 'join',
    title: '서로 맞는지 확인할 수 있는 과제',
    body: '실제 입사 후 해결할 문제와 연결되거나, 새로운 기술적 도전으로서 서로 맞는지 확인할 수 있는 과제는 범위를 검토한 뒤 무상으로 참여합니다.',
    detail: ['예를 들면 다음과 같습니다.'],
    points: [
      '사내에서 쓰는 기술 스택으로, 실제 서비스와 분리된 과하지 않은 기능 하나 구현하기',
      '실제로 겪고 있는 문제를 단순화한 과제로 원인을 찾고 개선 방향 제안하기',
    ],
    subCard: {
      title: '진행 방식',
      lead: '이런 과제라면 진행 방식도 원하시는 방식에 맞출 수 있습니다.',
      points: [
        'Git 저장소에 올려 코드를 함께 보기',
        'Tailscale의 테일넷 VPN으로 묶어, 스테이징 서버로 가정하고 공유하여 확인하기',
        'Cloudflare Workers로 띄운 개발 페이지에서 확인하기',
        'Slack으로 소통하거나 Notion으로 문서화하면서 공유하기',
      ],
      after: '위와 같이 실제 업무처럼 중간 피드백을 서로 주고받으며 진행하는 방식도 가능합니다.',
    },
  },
  {
    tag: '협의',
    tone: 'neutral',
    title: '기계적·반복적인 과제',
    body: '역량과 적합성을 실질적으로 확인하기 어려운 기계적·반복적 과제는 선호하지 않지만, 꼭 필요한 절차라면 소요 시간에 대한 비용을 협의합니다.',
    detail: ['예를 들면 다음과 같습니다.'],
    points: ['전형적인 CRUD 게시판', '로그인·회원가입·관리자 페이지처럼 틀이 정해진 기능 구현'],
  },
  {
    tag: '별도 계약',
    tone: 'neutral',
    title: '실제 업무에 쓸 결과물을 요구하는 과제',
    body: '회사가 실제 업무에 활용할 만한 구현 결과를 요구하는 과제는 채용 평가가 아니라 외주 업무로 간주될 수 있습니다. 채용 과제라는 이름으로 실제 업무가 일부 오가더라도 문제가 되지 않도록, 이런 과제는 별도 계약과 비용을 협의합니다.',
    detail: ['예를 들면 다음과 같습니다.'],
    points: ['운영 중인 실제 서비스나 공공 사이트의 화면·기능 작업', '회사 내부 코드나 실제 데이터를 넘겨받아 기능을 추가하거나 버그를 고치는 과제'],
  },
  {
    tag: '응시 안 함',
    tone: 'neutral',
    title: '알고리즘형 코딩 테스트·라이브 코딩',
    body: '알고리즘형 코딩 테스트와 라이브 코딩은 채용 절차로서 존중하지만, 크게 두 가지 이유로 현재 응시하지 않습니다.',
    points: [
      '반년 넘게 타이핑과 세부 구현은 AI·SI 에이전트에 맡기고 코드 리뷰에 집중해 왔기 때문에, 에이전트 없이 직접 손으로 짜는 방식에는 다시 적응할 시간이 필요합니다.',
      '찾고 있는 포지션이 AI·SI 에이전트를 활용하는 엔지니어이기 때문에, 에이전트 없이 보는 테스트는 그 포지션에서 실제로 하는 일과 거리가 있어 보입니다.',
    ],
    closing: '그래서 이러한 테스트 전형은 제가 찾는 포지션과는 맞지 않는다고 생각합니다.',
  },
] as const;

/**
 * 술과 담배(지식 문서 employment-preferences.md 음주 중심의 회식 문화·실내 흡연과 같은 내용).
 * 술·담배 공통의 생각은 섹션 첫 문단에 두고, 카드는 가능한 선 → 지양하는 선 순서.
 */
const DRINKING = [
  {
    tag: '가능',
    tone: 'join',
    title: '연례행사로 열리는 회식',
    body: '연례행사로 열리는 회식에는 적당히 참여할 수 있습니다.',
  },
  {
    tag: '지양',
    tone: 'warn',
    title: '잦은 회식과 갑작스러운 번개',
    body: '일상적이고 잦은 회식, 갑작스러운 번개 모임에는 참여하기 어렵습니다.',
  },
] as const;

const SMOKING = [
  {
    tag: '가능',
    tone: 'join',
    title: '흡연 시간의 대화',
    body: '비흡연자이지만, 친한 사이라면 흡연 시간에 밖으로 함께 나가 지정된 장소에서 대화하는 정도는 괜찮습니다.',
  },
  {
    tag: '지양',
    tone: 'warn',
    title: '실내 흡연',
    body: '사무실은 물론이고 베란다·화장실 같은 실내 공간에서의 흡연은 곤란합니다. 실제로 겪어 본 일이라 미리 적어 둡니다.',
  },
] as const;

/** 음주와 관련된 공개 기록. */
const DRINKING_LOGS = [
  { slug: 'when-drinking-becomes-a-workplace-problem', title: '음주가 개인의 선택을 넘어 문제가 되는 순간' },
] as const;

/** 앞으로 탐구하고 싶은 분야. */
const NEXT_INTERESTS = ['XR', '게임 제작', '임베디드', '실제 제품 만들기'];

/** 본문 카드의 모양(공통 Card, 페이지 바탕색)과 배치. */
const cardClass = cardClassName({ tone: 'base' });
const cardStyle: React.CSSProperties = {
  padding: '22px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};
const cardTitleStyle: React.CSSProperties = { fontSize: '1.0625rem', fontWeight: 700, margin: 0, color: 'var(--text)', lineHeight: 1.35, wordBreak: 'keep-all' };
const cardTextStyle: React.CSSProperties = { margin: 0, color: 'var(--text-dim)', lineHeight: 1.65, fontSize: '0.9375rem', wordBreak: 'keep-all' };
const subheadStyle: React.CSSProperties = { fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text)' };
/**
 * 카드 맨 아래 「관련 기록」 줄. 카드 항목의 logs(공개 기록 slug·제목)를 그린다.
 * 소개관 전시 스냅숏 도구가 이 JSX를 실행하지 않고 읽으므로, 따로 된 틀 요소로 빼지 않고 카드마다 같은 꼴로 둔다.
 * 위쪽 여백 auto(margin shorthand, marginTop과 섞지 않음)로 격자에서 높이가 다른 카드끼리도 맨 아래에 맞춘다.
 */
const relatedLogsStyle: React.CSSProperties = { ...cardTextStyle, fontSize: '0.875rem', margin: 'auto 0 0', paddingTop: '4px' };
const logLinkStyle: React.CSSProperties = { color: 'var(--accent-text)', fontWeight: 600 };
/** 앞쪽 이야기 묶음의 관련 기록 줄(이야기는 상수 없이 JSX에 바로 쓴 글이라 링크도 그 자리에 둔다). */
const storyLogStyle: React.CSSProperties = { ...cardTextStyle, fontSize: '0.875rem', margin: '12px 0 0' };
const tagStyle: React.CSSProperties = {
  display: 'inline-block',
  minWidth: '2.6em',
  marginRight: '8px',
  padding: '1px 8px',
  borderRadius: '999px',
  fontSize: '0.75rem',
  fontWeight: 700,
  textAlign: 'center',
  verticalAlign: '1px',
};

/** 자기소개서 본문 패널(옅은 점 격자 배경). 성향·취미·장점과 강점·단점과 약점 섹션이 함께 쓴다. */
function CoverPanel({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <Panel id={id} tabIndex={-1} padding="lg" style={{
      overflow: 'hidden',
      scrollMarginTop: '96px'
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        opacity: 'var(--surface-pattern-opacity, 0.3)',
        pointerEvents: 'none'
      }} />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {children}
      </div>
    </Panel>
  );
}

/**
 * 꼬리표 색: join은 강조 색, warn은 옅은 주황 경고색(프로젝트 카드의 경고 상태 꼬리표와 같은 #f97316 계열), neutral은 중립 색.
 */
const TAG_TONES = {
  join: { border: '1px solid var(--border)', background: 'var(--accent-soft)', color: 'var(--accent-text)' },
  // 글자는 본문 색과 섞어 밝은 테마에선 진한 주황, 어두운 테마에선 밝은 주황이 되게 한다(밝은 테마에서 #f97316 그대로는 대비가 모자람).
  warn: { border: '1px solid color-mix(in srgb, #f97316 42%, transparent)', background: 'color-mix(in srgb, #f97316 13%, transparent)', color: 'color-mix(in srgb, #f97316 68%, var(--text))' },
  neutral: { border: '1px solid var(--border)', background: 'var(--bg-elev-2)', color: 'var(--text-dim)' },
} as const satisfies Record<string, React.CSSProperties>;

interface TagCardItem {
  tag: string;
  tone: keyof typeof TAG_TONES;
  title: string;
  body: string;
  /** 본문 아래 따로 두는 문단들. */
  detail?: readonly string[];
  /** 문단 뒤에 붙는 - 항목 목록. */
  points?: readonly string[];
  /** 카드 안에 한 단계 들여 두는 작은 카드(참여 과제의 진행 방식 등). */
  subCard?: { title: string; lead: string; points: readonly string[]; after?: string };
  /** 카드 맨 끝에 붙는 마무리 문단. */
  closing?: string;
}

function CardPoints({ points }: { points: readonly string[] }) {
  return (
    <ul style={{ ...cardTextStyle, margin: 0, paddingLeft: '1.25em', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {points.map((text) => <li key={text}>{text}</li>)}
    </ul>
  );
}

/** 꼬리표(참여·가능·지양 등)가 붙은 카드 목록. 테스트 전형 안내와 술과 담배 섹션이 함께 쓴다. */
function TagCards({ items }: { items: readonly TagCardItem[] }) {
  return items.map((item) => (
    <li key={item.title} className={cardClass} style={cardStyle}>
      <h5 style={cardTitleStyle}>
        <span style={{ ...tagStyle, ...TAG_TONES[item.tone] }}>{item.tag}</span>
        {item.title}
      </h5>
      <p style={cardTextStyle}>{item.body}</p>
      {item.detail?.map((text) => <p key={text} style={cardTextStyle}>{text}</p>)}
      {item.points ? <CardPoints points={item.points} /> : null}
      {item.subCard ? (
        // 참여 꼬리표와 같은 강조색의 왼쪽 선으로, 바깥 카드와 다른 '딸린 설명'임을 드러낸다.
        <Callout tone="soft" bordered={false} style={{ marginTop: '4px', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h6 style={{ ...cardTitleStyle, fontSize: '0.875rem', color: 'var(--decor-accent-text)', letterSpacing: '0.02em' }}>{item.subCard.title}</h6>
          <p style={cardTextStyle}>{item.subCard.lead}</p>
          <CardPoints points={item.subCard.points} />
          {item.subCard.after ? <p style={cardTextStyle}>{item.subCard.after}</p> : null}
        </Callout>
      ) : null}
      {item.closing ? <p style={cardTextStyle}>{item.closing}</p> : null}
    </li>
  ));
}

const sectionTitleStyle: React.CSSProperties ={ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text)', lineHeight: 1.2 };
const leadStyle: React.CSSProperties = { margin: 0, fontSize: '1.03125rem', color: 'var(--text-dim)', lineHeight: 1.7, wordBreak: 'keep-all' };
const cardGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '16px' };

export const metadata = {
  title: '자기소개서 | Cover Letter',
  description: '가치관과 걸어온 길',
};

export default function CoverLetterPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '60px' }}>
      
      {/* Hero Section */}
      <Panel id="cover-letter-overview" tabIndex={-1} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        overflow: 'hidden',
        scrollMarginTop: '96px'
      }}>
        {/* Subtle grid background watermark */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          opacity: 'var(--surface-pattern-opacity, 0.3)',
          pointerEvents: 'none'
        }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 5.5vw, 2.25rem)', fontWeight: 800, margin: 0, color: 'var(--text)', lineHeight: 1.2 }}>
            &quot;단순히 돌아가는 코드가 아닌,<br />그 이면의 원리를 탐구합니다.&quot;
          </h2>
          <p style={{ fontSize: 'clamp(1rem, 2.6vw, 1.125rem)', color: 'var(--text-dim)', maxWidth: '850px', lineHeight: 1.6, margin: 0, wordBreak: 'keep-all' }}>
            단순히 결과물만 내는 것이 아니라, 프로덕트가 만들어지는 이면에 담긴 고민과 과정을 중요하게 생각합니다. 추측보다 측정으로 병목의 원인을 찾고, 그 근거를 남겨 다른 사람도 확인할 수 있게 하는 개발자입니다.
          </p>
          <AskAiButton
            align="end"
            guidedTourTarget="cover-letter-overview-ask-ai"
            question="자기소개서에 담긴 개발 철학과 경험의 흐름을 주요 사례 중심으로 설명해 주세요."
          />
        </div>
      </Panel>

      {/* Narrative Section (based on the markdown) */}
      <Panel id="cover-letter-story" tabIndex={-1} padding="lg" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '40px',
        overflow: 'hidden',
        scrollMarginTop: '96px'
      }}>
        {/* Subtle grid background watermark */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          opacity: 'var(--surface-pattern-opacity, 0.3)',
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '40px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(40px, auto) 1fr', gap: '24px', alignItems: 'start' }}>
            <div style={{ fontFamily: 'monospace', fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-text)', opacity: 0.8, lineHeight: 1 }}>01</div>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 12px', color: 'var(--text)', lineHeight: 1.2 }}>학창 시절부터 이어진 탐구심</h3>
              <p style={{ margin: 0, fontSize: '1.03125rem', color: 'var(--text-dim)', lineHeight: 1.7, wordBreak: 'keep-all' }}>
                중·고등학생 때부터 컴퓨터 하드웨어에 대한 깊은 관심이 있었습니다. 중학생 때는 다나와 사이트에서 직접 사용할 컴퓨터를 맞추거나 취미 삼아 친구들 컴퓨터의 견적을 내주며 놀았고, 고등학생 때는 단순히 이론적인 것에 그치지 않고, 직접 CPU 오버클럭을 하거나 RAID 환경을 구성하며 성능 개선을 두 눈으로 확인하고 검증하는 과정 자체에 큰 흥미를 느꼈습니다. 이러한 하드웨어에 대한 본질적인 탐구심은 이후 소프트웨어 엔지니어로 성장하는 데 강력한 밑거름이 되었습니다.
              </p>
              <p style={storyLogStyle}>
                관련 기록:{' '}
                <LogReadingLink slug="why-i-started-software-development" style={logLinkStyle}>「하드웨어 관심에서 소프트웨어 개발로」</LogReadingLink>
              </p>
              <div style={{ marginTop: '14px' }}>
                <AskAiButton
                  align="end"
                  question="자기소개서의 「학창 시절부터 이어진 탐구심」이 현재 개발 방식에 어떻게 이어졌는지 사례와 함께 설명해 주세요."
                />
              </div>
            </div>
          </div>

          <div style={{ height: '1px', background: 'var(--border)', opacity: 0.7 }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(40px, auto) 1fr', gap: '24px', alignItems: 'start' }}>
            <div style={{ fontFamily: 'monospace', fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-text)', opacity: 0.8, lineHeight: 1 }}>02</div>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 12px', color: 'var(--text)', lineHeight: 1.2 }}>하이레벨에서 로우레벨까지</h3>
              <p style={{ margin: 0, fontSize: '1.03125rem', color: 'var(--text-dim)', lineHeight: 1.7, wordBreak: 'keep-all' }}>
                Java로 프로그래밍에 입문하며 객체지향과 고수준 추상화의 기초를 다졌고, 이후 C#과 Unity로 게임 개발을 시작했습니다. C#의 구조체를 비롯한 언어적 특성을 시작으로 Unity 커스텀 에디터를 직접 만들어 보며 프레임워크를 수동적으로 가져다 쓰는 것을 넘어 동작 원리와 저수준 구현까지 파고들었고, 이후에는 개인적인 필요로 가볍게 만든 WinForms 앱을 WPF로 마이그레이션하며 .NET 환경에서 MVVM 패턴의 적용 방식을 체득했습니다.
              </p>
              <p style={{ margin: '12px 0 0', fontSize: '1.03125rem', color: 'var(--text-dim)', lineHeight: 1.7, wordBreak: 'keep-all' }}>
                학창 시절부터 하드웨어에 관심이 있었던 만큼, 다시 소프트웨어 아래의 장비로 관심이 이어졌습니다. CPU의 비순차 실행이나 분기 예측, SIMD(AVX2), 캐시 메모리와 캐시 라인 단위의 메모리 접근을 들여다봤습니다. 그 밖에도 추상적이고 기초적인 수준이지만, CUDA로 GPU 가속의 기초를 살펴보거나 유무선 통신에서 오류를 검출하고 수정하는 과정, 무선 통신에서 반송파의 진폭·주파수·위상을 조합해 채널을 쪼개고 대역폭을 늘려 온 방식처럼 장비가 동작하는 원리도 알아봤습니다.
              </p>
              <p style={{ margin: '12px 0 0', fontSize: '1.03125rem', color: 'var(--text-dim)', lineHeight: 1.7, wordBreak: 'keep-all' }}>
                소프트웨어와 하드웨어를 오가며 쌓은 이해는 문제가 생겼을 때 원인을 유추하는 데 도움이 되었고, 이를 바탕으로 하드웨어의 기술적, 물리적 특성을 고려한 소프트웨어 성능 최적화 실험에 몰두해 왔습니다.
              </p>
              <p style={storyLogStyle}>
                관련 기록:{' '}
                <LogReadingLink slug="excel-row-mapping-wpf-app" style={logLinkStyle}>「반복 작업의 효율을 바꾼 엑셀 행 매핑 WPF 앱」</LogReadingLink>
              </p>
              <div style={{ marginTop: '14px' }}>
                <AskAiButton align="end" question="자기소개서의 「하이레벨에서 로우레벨까지」 경험을 기술 선택과 성능 최적화 사례 중심으로 자세히 설명해 주세요." />
              </div>
            </div>
          </div>

          <div style={{ height: '1px', background: 'var(--border)', opacity: 0.7 }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(40px, auto) 1fr', gap: '24px', alignItems: 'start' }}>
            <div style={{ fontFamily: 'monospace', fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-text)', opacity: 0.8, lineHeight: 1 }}>03</div>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 12px', color: 'var(--text)', lineHeight: 1.2 }}>스스로 문제를 정의하는 개발자</h3>
              <p style={{ margin: 0, fontSize: '1.03125rem', color: 'var(--text-dim)', lineHeight: 1.7, wordBreak: 'keep-all' }}>
                단순히 구현하는 것을 넘어, 데이터의 직렬화 포맷을 비교 분석하고 자체적인 코드 제너레이터(Scaffold)를 구축하는 등, 생산성과 성능이라는 두 마리 토끼를 잡기 위해 끊임없이 고민하고 있습니다. 저는 주어지는 문제를 수동적으로 푸는 사람이 아니라, 스스로 문제를 정의하고 본질부터 파고듭니다. 이제는 AI·SI 에이전트를 활용해 이러한 고민과 실험을 반복하고 있습니다.
              </p>
              <div style={{ marginTop: '14px' }}>
                <AskAiButton align="end" question="「스스로 문제를 정의하는 개발자」라는 표현을 실제 프로젝트와 실험 사례를 들어 설명해 주세요." />
              </div>
            </div>
          </div>

        </div>
      </Panel>

      {/* Personality */}
      <CoverPanel id="cover-letter-core-values">
        <h3 style={sectionTitleStyle}>핵심 가치</h3>
        <div style={{ ...cardGridStyle, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))' }}>
          {CORE_VALUES.map((item) => (
            <div key={item.title} className={cardClass} style={{ ...cardStyle, position: 'relative', overflow: 'hidden', padding: '26px 24px 20px', gap: '12px' }}>
              <span aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '4px', background: 'linear-gradient(90deg, var(--decor-accent-text), transparent)', opacity: 0.8 }} />
              <h5 style={{ ...cardTitleStyle, fontSize: '1.25rem', fontWeight: 800 }}>{item.title}</h5>
              <p style={cardTextStyle}>{item.body}</p>
              <div style={{ marginTop: 'auto' }}>
                <AskAiButton align="end" question={item.question} />
              </div>
            </div>
          ))}
        </div>
      </CoverPanel>

      <CoverPanel id="cover-letter-personality">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={sectionTitleStyle}>성향</h3>
          <p style={leadStyle}>
            궁금한 것은 직접 확인하고, 할 수 있는 일이라도 해도 되는지를 먼저 따져 보는 편입니다.
          </p>
        </div>
        <div style={cardGridStyle}>
          {TRAITS.map((item) => (
            <div key={item.label} className={cardClass} style={{ ...cardStyle, position: 'relative', overflow: 'hidden', paddingLeft: '28px' }}>
              <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'var(--decor-accent-text)', opacity: 0.75 }} />
              <span style={{ ...tagStyle, alignSelf: 'flex-start', marginRight: 0, background: 'var(--accent-soft)', color: 'var(--accent-text)', border: '1px solid var(--border)' }}>{item.label}</span>
              <h5 style={cardTitleStyle}>{item.title}</h5>
              <p style={cardTextStyle}>{item.body}</p>
              {item.bodyMore?.map((paragraph) => <p key={paragraph} style={cardTextStyle}>{paragraph}</p>)}
            </div>
          ))}
        </div>
        <AskAiButton align="end" question="자기소개서의 「성향」에 적힌 성향이 실제 작업과 협업에서 어떻게 드러나는지 사례와 함께 설명해 주세요." />
      </CoverPanel>

      {/* Hobbies */}
      <CoverPanel id="cover-letter-hobbies">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={sectionTitleStyle}>취미와 관심사</h3>
          <p style={leadStyle}>
            관심의 중심은 코딩 자체보다 컴퓨터와 계산 자원을 어떻게 구성하고 활용해 원하는 결과를 만드느냐에 있습니다. 그래서 컴퓨터를 다루는 취미가 곧 일상이기도 합니다.
          </p>
        </div>
        <div style={cardGridStyle}>
          {HOBBIES.map((item) => (
            <div key={item.title} className={cardClass} style={cardStyle}>
              <h5 style={cardTitleStyle}>{item.title}</h5>
              <p style={cardTextStyle}>{item.body}</p>
              {item.logs ? (
                <p style={relatedLogsStyle}>
                  관련 기록:{' '}
                  {item.logs.map((log, index) => (
                    <React.Fragment key={log.slug}>
                      {index > 0 ? ' · ' : null}
                      <LogReadingLink slug={log.slug} style={logLinkStyle}>「{log.title}」</LogReadingLink>
                    </React.Fragment>
                  ))}
                </p>
              ) : null}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
          <span style={{ ...cardTextStyle, fontWeight: 600, color: 'var(--text)', marginRight: '4px' }}>앞으로 탐구하고 싶은 분야</span>
          {NEXT_INTERESTS.map((name) => (
            <span key={name} style={{ padding: '4px 12px', borderRadius: '999px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-dim)', fontSize: '0.875rem', fontWeight: 600 }}>{name}</span>
          ))}
        </div>
        <AskAiButton align="end" question="자기소개서의 「취미와 관심사」가 개발 방식이나 지금의 작업과 어떻게 이어지는지 설명해 주세요." />
      </CoverPanel>

      {/* 구직 안내의 시작: 여기부터 아래(경력의 전환점·장점과 강점·단점과 약점·지원 분야·컬처 핏·채용 과제·포부)는 구직용으로만 덧붙인 내용임을 알린다. */}
      <CoverPanel id="cover-letter-job-guide">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--accent-text)' }}>구직 안내</p>
          <h3 style={sectionTitleStyle}>여기부터는 구직용 내용입니다</h3>
          <p style={leadStyle}>
            앞의 내용이 저를 소개하는 글이라면, 지금부터는 구직할 때만 덧붙이는 안내입니다. 다시 일을 시작하려는 이유와 장점과 강점, 단점과 약점, 지원 분야, 함께 일하기 전에 서로 맞는지 확인할 조건, 채용 과제에 대한 생각과 포부를 적어 두었습니다.
          </p>
        </div>
      </CoverPanel>

      <CareerTurningPointPreview />

      {/* Merits and strengths: 좋은 면(장점은 성향과 태도, 강점은 역량). 아래 단점과 약점과 같은 순서(성향 → 역량·이력)로 둔다. */}
      <CoverPanel id="cover-letter-strengths">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={sectionTitleStyle}>장점과 강점</h3>
          <p style={leadStyle}>장점은 일하는 방식과 사람을 대하는 모습에서, 강점은 일하는 역량에서 드러나는 좋은 면입니다.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <h4 style={subheadStyle}>장점</h4>
            <p style={leadStyle}>가치관에서 나온 원칙들이지만, 모든 상황에 일괄적으로 적용하기보다 상황에 맞게 적용하려고 합니다.</p>
          </div>
          <div style={cardGridStyle}>
            {MERITS.map((item) => (
              <div key={item.title} className={cardClass} style={cardStyle}>
                <h5 style={cardTitleStyle}>{item.title}</h5>
                {item.paragraphs.map((paragraph) => <p key={paragraph} style={cardTextStyle}>{paragraph}</p>)}
                {item.logs ? (
                  <p style={relatedLogsStyle}>
                    관련 기록:{' '}
                    {item.logs.map((log, index) => (
                      <React.Fragment key={log.slug}>
                        {index > 0 ? ' · ' : null}
                        <LogReadingLink slug={log.slug} style={logLinkStyle}>「{log.title}」</LogReadingLink>
                      </React.Fragment>
                    ))}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <h4 style={subheadStyle}>강점</h4>
            <p style={leadStyle}>지금까지의 경험을 바탕으로 제공할 수 있는 가치입니다.</p>
          </div>
          <div style={cardGridStyle}>
            {STRENGTHS.map((item) => (
              <div key={item.title} className={cardClass} style={cardStyle}>
                <h5 style={cardTitleStyle}>{item.title}</h5>
                {item.paragraphs.map((paragraph) => <p key={paragraph} style={cardTextStyle}>{paragraph}</p>)}
              </div>
            ))}
          </div>
        </div>
        <AskAiButton align="end" question="자기소개서의 「장점과 강점」에 적힌 성향과 역량의 좋은 면을 실제 사례와 함께 설명해 주세요." />
      </CoverPanel>

      {/* Flaws and weaknesses: 아쉬운 면(단점은 성향과 태도, 약점은 이력). 서류 이야기인 약점을 맨 끝에 둔다. */}
      <CoverPanel id="cover-letter-weaknesses">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={sectionTitleStyle}>단점과 약점</h3>
          <p style={leadStyle}>단점은 성향과 태도에서, 약점은 지나온 이력에서 오는 부분입니다.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <h4 style={subheadStyle}>단점과 보완</h4>
            <p style={leadStyle}>몇몇 원칙에는 비교적 단호한 편이라, 조직에 따라 단점으로 비칠 수 있는 부분입니다.</p>
          </div>
          <div style={cardGridStyle}>
            {FLAWS.map((item) => (
              <div key={item.title} className={cardClass} style={cardStyle}>
                <h5 style={cardTitleStyle}>{item.title}</h5>
                <p style={cardTextStyle}>
                  <span style={{ ...tagStyle, background: 'var(--bg-elev-2)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}>단점</span>
                  {item.weakness}
                </p>
                {'examples' in item && item.examples ? <CardPoints points={item.examples} /> : null}
                <div aria-hidden="true" style={{ height: '1px', background: 'var(--border)', opacity: 0.7, margin: '4px 0' }} />
                <p style={cardTextStyle}>
                  <span style={{ ...tagStyle, background: 'var(--accent-soft)', color: 'var(--accent-text)', border: '1px solid var(--border)' }}>보완</span>
                  {item.remedy}
                </p>
                {item.logs ? (
                  <p style={relatedLogsStyle}>
                    관련 기록:{' '}
                    {item.logs.map((log, index) => (
                      <React.Fragment key={log.slug}>
                        {index > 0 ? ' · ' : null}
                        <LogReadingLink slug={log.slug} style={logLinkStyle}>「{log.title}」</LogReadingLink>
                      </React.Fragment>
                    ))}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <h4 style={subheadStyle}>약점과 생각</h4>
            <p style={leadStyle}>문서상 이력으로는 약점이지만, 저에게는 필요한 선택과 시간이었습니다. 다만 독특한 이력은 언제나 해명 수준의 설명이 필요하기에 적어 둡니다. 부끄럽지 않기에 숨길 생각이 없고, 숨겨서도 안 된다고 생각합니다.</p>
          </div>
          <div style={cardGridStyle}>
            {WEAKNESSES.map((item) => (
              <div key={item.title} className={cardClass} style={cardStyle}>
                <h5 style={cardTitleStyle}>{item.title}</h5>
                <p style={cardTextStyle}>
                  <span style={{ ...tagStyle, background: 'var(--bg-elev-2)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}>약점</span>
                  {item.weakness}
                </p>
                <div aria-hidden="true" style={{ height: '1px', background: 'var(--border)', opacity: 0.7, margin: '4px 0' }} />
                <p style={cardTextStyle}>
                  <span style={{ ...tagStyle, background: 'var(--accent-soft)', color: 'var(--accent-text)', border: '1px solid var(--border)' }}>생각</span>
                  {item.remedy}
                </p>
                {item.remedyMore?.map((paragraph) => <p key={paragraph} style={cardTextStyle}>{paragraph}</p>)}
                {item.logs ? (
                  <p style={relatedLogsStyle}>
                    관련 기록:{' '}
                    {item.logs.map((log, index) => (
                      <React.Fragment key={log.slug}>
                        {index > 0 ? ' · ' : null}
                        <LogReadingLink slug={log.slug} style={logLinkStyle}>「{log.title}」</LogReadingLink>
                      </React.Fragment>
                    ))}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <AskAiButton align="end" question="자기소개서의 「단점과 약점」에 적힌 단점을 보완하는 방식과 약점에 대한 생각을 실제 사례와 함께 설명해 주세요." />
      </CoverPanel>

      {/* Job scope: 컬처 핏 앞의 구직 안내 */}
      <CoverPanel id="cover-letter-job-scope">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--accent-text)' }}>구직 안내</p>
          <h3 style={sectionTitleStyle}>지원 분야</h3>
          <p style={leadStyle}>
            AI·SI 에이전트와 협업하며 개발 과정의 생산성을 높이는 에이전트 네이티브 소프트웨어 엔지니어로서 다양한 역할에 열려 있습니다. 그중에서도 신규 아이디어의 PoC·R&amp;D, 기존 시스템의 구조·성능 개선, AI·SI 에이전트를 활용한 개발과 작업 체계 설계에 관심을 두고 기회를 찾고 있습니다.
          </p>
          <p style={leadStyle}>
            다만 게임 분야는 취미로만 이어 갈 계획입니다. 현재 구체적인 계획은 없지만 나중에 직접 만든 게임을 사업자를 내고 출시할 수도 있기에, 그때 경업 금지 같은 문제가 생기지 않도록 게임 분야는 지원 분야에서 제외합니다. 게임 회사가 아니더라도 변동 사항이 생겨 업무 범위를 조정해야 할 때 참고 부탁드리며, 경우에 따라 계약서에 경업·겸업 금지에 대한 개인 게임 개발 예외 조항이 필요할 수 있습니다.
          </p>
        </div>
      </CoverPanel>

      {/* Culture fit: 구직 안내 묶음(함께 일할 때 중요하게 보는 것·술과 담배) */}
      <section id="cover-letter-culture-fit" tabIndex={-1} aria-labelledby="cover-letter-culture-fit-title" style={{ display: 'flex', flexDirection: 'column', gap: '24px', scrollMarginTop: '96px' }}>
        <CoverPanel id="cover-letter-culture-fit-intro">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--accent-text)' }}>구직 안내</p>
            <h2 id="cover-letter-culture-fit-title" style={sectionTitleStyle}>컬처 핏 (Culture Fit)</h2>
            <p style={leadStyle}>
              평가하는 기준이 아니라, 서로 잘 맞는지 미리 확인할 수 있도록 먼저 밝혀 두는 내용입니다.
            </p>
          </div>
        </CoverPanel>

      {/* Work priorities and conditions */}
      <CoverPanel id="cover-letter-values">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={sectionTitleStyle}>함께 일할 때 중요하게 보는 것</h3>
          <p style={leadStyle}>
            기본 생활과 연구 활동을 안정적으로 이어 갈 수 있는 수준이라면, 보상 차이보다 관심 있는 역할과 업무 환경에 더 무게를 둡니다. 중요하게 보는 순서는 다음과 같습니다.
          </p>
        </div>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {PRIORITIES.map((item, index) => (
            <li key={item.title} className={cardClass} style={{ ...cardStyle, flexDirection: 'row', alignItems: 'flex-start', gap: '16px' }}>
              <span aria-hidden="true" style={{ fontFamily: 'monospace', fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-text)', opacity: 0.85, lineHeight: 1.35, minWidth: '1.6em' }}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                <h5 style={cardTitleStyle}>
                  {item.title}
                  {item.required ? (
                    <span style={{ ...tagStyle, marginRight: 0, marginLeft: '8px', background: 'var(--accent-soft)', color: 'var(--accent-text)', border: '1px solid var(--border)' }}>필수</span>
                  ) : null}
                </h5>
                <p style={cardTextStyle}>{item.body}</p>
                {item.detail?.map((text) => <p key={text} style={cardTextStyle}>{text}</p>)}
                {item.log ? (
                  <p style={{ ...cardTextStyle, fontSize: '0.875rem' }}>
                    {item.log.lead}:{' '}
                    <LogReadingLink slug={item.log.slug} style={{ color: 'var(--accent-text)', fontWeight: 600 }}>
                      「{item.log.title}」
                    </LogReadingLink>
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        <AskAiButton align="end" question="자기소개서의 「함께 일할 때 중요하게 보는 것」에서 합법성과 윤리를 가장 먼저 보는 이유와 나머지 기준을 설명해 주세요." />
      </CoverPanel>

      {/* Drinking and smoking */}
      <CoverPanel id="cover-letter-drinking-smoking">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={sectionTitleStyle}>술과 담배</h3>
          <p style={leadStyle}>
            술과 담배를 따로 적는 이유는, 공백기 이전 현업에 있을 때 음주 문화가 업무 스트레스의 큰 부분을 차지했기 때문입니다.
          </p>
          <p style={leadStyle}>
            술과 담배는 즐기지 않습니다. 시간과 건강, 돈을 모두 소모한다고 생각하기 때문입니다.
          </p>
          <p style={leadStyle}>
            특히 술은 마신 다음 날 컨디션이 떨어진 채로 일하게 되는데, 그런 상태로 작업하는 것은 되도록 피하고 싶습니다.
          </p>
          <p style={leadStyle}>
            코로나19 시기를 거쳐 회식 문화가 많이 바뀌었다고는 하지만, 현업을 꾸준히 지키고 있는 지인들에게 들어 보면 여전히 크게 달라지지는 않은 것 같습니다. 그래서 함께 일할 때 미리 맞춰 두면 좋을 내용을 아래에 정리했습니다.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h4 style={subheadStyle}>술</h4>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <TagCards items={DRINKING} />
          </ul>
          <p style={{ ...cardTextStyle, fontSize: '0.875rem' }}>
            음주와 관련된 기록:{' '}
            {DRINKING_LOGS.map((log, index) => (
              <React.Fragment key={log.slug}>
                {index > 0 ? ' · ' : null}
                <LogReadingLink slug={log.slug} style={{ color: 'var(--accent-text)', fontWeight: 600 }}>「{log.title}」</LogReadingLink>
              </React.Fragment>
            ))}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h4 style={subheadStyle}>담배</h4>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <TagCards items={SMOKING} />
          </ul>
        </div>
        <AskAiButton align="end" question="자기소개서의 「술과 담배」에서 회식과 흡연에 대해 어디까지 괜찮고 어디부터 지양하는지 설명해 주세요." />
      </CoverPanel>
      </section>

      {/* Hiring tests: 컬처 핏 밖의 구직 안내 */}
      <CoverPanel id="cover-letter-hiring-tests">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--accent-text)' }}>구직 안내</p>
          <h3 style={sectionTitleStyle}>테스트 전형 안내</h3>
          <p style={leadStyle}>
            채용 과정 중에 있을 수 있는 테스트 전형에 대한 기준을, 참여 가능한 내용부터 순서대로 적었습니다. 어떤 전형이든 모든 진행 과정에서 AI·SI 에이전트를 활용할 수 있다는 것을 전제로 합니다.
          </p>
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <TagCards items={HIRING_TESTS} />
        </ul>
        <AskAiButton align="end" question="자기소개서의 「테스트 전형 안내」에서 과제 종류마다 어떻게 참여하는지 설명해 주세요." />
      </CoverPanel>

      {/* Ambitions: 자기소개서 마무리 */}
      <CoverPanel id="cover-letter-ambitions">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={sectionTitleStyle}>함께 일하게 된다면</h3>
          <p style={leadStyle}>합류 후에는 아래 세 가지로 팀에 기여하려고 합니다.</p>
        </div>
        <div style={{ ...cardGridStyle, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))' }}>
          {AMBITIONS.map((item, index) => (
            <div key={item.title} className={cardClass} style={cardStyle}>
              <span aria-hidden="true" style={{ fontSize: '0.8125rem', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--accent-text)' }}>{String(index + 1).padStart(2, '0')}</span>
              <h5 style={cardTitleStyle}>{item.title}</h5>
              <p style={cardTextStyle}>{item.body}</p>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={leadStyle}>
            합류 자체보다도 오래 함께할 곳을 찾고 있습니다. 함께하는 동안에는 기간이 한 달이든 몇 년이든, 급여와 세금 등 부대비용을 포함한 고용 비용 이상의 가치를 만드는 것을 기준으로 삼습니다.
          </p>
          <p style={leadStyle}>
            존중과 신뢰를 바탕으로 협업할 수 있다면 계약 형태는 크게 중요하지 않다고 생각합니다. 여건상 정규직이 어렵다면 단기 계약직이나 프리랜서 도급 계약으로 관계를 이어 가는 것에도 열려 있습니다.
          </p>
        </div>
      </CoverPanel>

      {/* 숨겨 둔 기록 깨기를 구직용 자기소개서에서만 알린다. 포부 패널과 나눈 따로 된 패널로 두고, 챗봇 지식에는 계속 넣지 않는다. */}
      <CoverPanel id="cover-letter-easter-egg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={cardTextStyle}>
            마지막으로, 이 페이지에서만 알려 드리는 것이 하나 있습니다. 연구 페이지에 숨겨 둔 이스터에그를 아래에 접어 두었습니다. 기록의 바탕이 된 실험은{' '}
            <Link href="/about-me/research#research-cpu-simd" style={{ color: 'var(--accent-text)' }}>연구 페이지의 연산 성능 최적화 실험</Link>에서 자세히 볼 수 있고,
            기준 코드가 AI·SI 활용 방식에 따라 단계별로 어떻게 다듬어졌는지는{' '}
            <Link href="/about-me/ai-workflow#ai-workflow-simd-case" style={{ color: 'var(--accent-text)' }}>AI·SI 활용 단계 페이지의 사례</Link>에서 볼 수 있습니다.
          </p>
          <SimdRecordChallenge context="cover-letter" />
        </div>
      </CoverPanel>

      <Panel tone="fill" padding="lg" style={{ textAlign: 'center', marginTop: '20px' }}>
        <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text)' }}>연구 기간의 최적화 실험이 궁금하신가요?</h3>
        <p style={{ color: 'var(--text-dim)', marginBottom: '24px' }}>
          CPU 명령 수준 최적화부터 AI·SI 에이전트 코딩 연구에 이르기까지, 다양한 실험과 도전 결과를 정리해 두었습니다.
        </p>
        <Link href="/about-me/research" className="hover-btn-primary hover-btn-inverse" style={{
          display: 'inline-block',
          padding: '12px 24px',
          background: 'var(--text)',
          color: 'var(--bg)',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: 600,
        }}>
          연구 경험(Research) 보러 가기
        </Link>
      </Panel>

    </div>
  );
}
