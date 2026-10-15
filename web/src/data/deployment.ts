import { sharedInfrastructureDeploymentSource } from './sharedInfrastructureDiagram.ts';

/** 공개 소개에 필요한 논리적 배치만 담으며 실제 주소·포트·인증 정보는 포함하지 않는다. */
export const deploymentProjects = [
  {
    id: 'portfolio',
    label: '포트폴리오',
    role: '정적 화면 · 별도 백엔드',
    hosting: 'GitHub Pages / Cloudflare Worker',
    description: '화면은 Pages에서, 챗봇·공개 기록 API는 별도 Worker에서 제공합니다. AI 실험 데모는 외부 정적 웹 링크로 연결합니다.',
  },
  {
    id: 'shared-infrastructure',
    label: '공용 인프라',
    role: '공용 API · 내부 서비스',
    hosting: 'Raspberry Pi + Cloudflare Tunnel',
    description: '외부 요청은 게이트웨이를 거치고, Pi의 K3s에서 공용·운영 서비스를 개별 워크로드로 제공합니다.',
  },
  {
    id: 'e-commerce',
    label: '이커머스 데모',
    role: '고객·관리자 웹 · 각 웹의 AI',
    hosting: '별도 Cloudflare Workers / Raspberry Pi',
    description: '고객·관리자 웹은 각각 Worker, 업무 API는 Pi에서 제공합니다. 공용 파일·채팅과 Tunnel 뒤 Colab LLM을 연결합니다.',
  },
  {
    id: 'asset-library',
    label: '에셋 라이브러리',
    role: '웹·API · 제작 에이전트 MCP',
    hosting: 'Raspberry Pi / LAN · Tailscale',
    description: 'Rust 웹·API와 Node.js MCP를 제공하며, SQLite·로컬 파일을 사용합니다.',
  },
] as const;

/** 갤러리의 공개 실행 링크와 대응하는 외부 실험. 포트폴리오 API의 하위 서비스가 아니다. */
export const portfolioLinkedExperiments = [
  {
    nodeId: 'GPTSites', hosting: 'GPT Sites',
    experiments: [
      { id: 'aqua-guardian', label: '물고기 키우기' },
      { id: 'planet-defense', label: 'Planet Defense' },
      { id: 'flight-simulator-experiment', label: '비행 시뮬레이터' },
      { id: 'siege-warfare', label: '공성전' },
      { id: 'hand-joint-rigging', label: '손 관절 리깅' },
      { id: 'first-person-hand-sword', label: '1인칭 손·검 훈련장' },
    ],
  },
  {
    nodeId: 'StaticDemo', hosting: 'Cloudflare 정적 웹 · Workers 링크',
    experiments: [{ id: 'modern-warfare-sample', label: '현대전 샘플' }],
  },
] as const;

const portfolioDeploymentSource = `flowchart TB
    PortfolioPages["GitHub Pages<br/>포트폴리오 화면"]
    Browser["브라우저"]
    GPTSites["GPT Sites · AI 활용 실험<br/>${portfolioLinkedExperiments[0].experiments.map(experiment => experiment.label).join('<br/>')}"]
    Worker["Cloudflare Worker<br/>챗봇 · 공개 기록 API"]
    StaticDemo["Cloudflare 정적 웹<br/>현대전 샘플<br/>등록된 실행 링크 · Workers"]
    ColabTunnel["Cloudflare<br/>Tunnel"]
    Colab["Google Colab · GPU<br/>LLM 추론 서버"]
    PortfolioPages -->|"화면 제공"| Browser
    Browser -->|"실험 데모 열기"| GPTSites
    Browser -->|"API 요청"| Worker
    Browser -->|"실험 데모 열기"| StaticDemo
    Worker -->|"추론 요청"| ColabTunnel
    ColabTunnel --> Colab`;

export const deploymentDiagrams = [
  {
    id: 'portfolio',
    title: '포트폴리오',
    description:
      '화면은 GitHub Pages, 챗봇·기록 API는 Cloudflare Worker에서 제공합니다.\n추론 요청은 Worker → Tunnel → Colab으로 이어집니다.\nAI 활용 실험은 브라우저에서 GPT Sites·Cloudflare 정적 웹 링크로 열며, 챗봇 API를 거치지 않습니다.',
    source: portfolioDeploymentSource,
    compactSource: portfolioDeploymentSource,
  },
  {
    id: 'shared-infrastructure',
    title: '공용 인프라',
    description:
      'Tunnel → Rust 게이트웨이 → 개별 공용·운영 서비스로 연결합니다.\nRaspberry Pi의 K3s 안에 서비스별 독립 워크로드를 표시했습니다. DB·캐시·파일 볼륨은 내부 자원입니다.\n이커머스 업무 API와 에셋 라이브러리는 이 공용 서비스 묶음과 별도입니다.',
    source: sharedInfrastructureDeploymentSource,
    compactSource: sharedInfrastructureDeploymentSource,
  },
  {
    id: 'e-commerce',
    title: '이커머스 데모',
    description:
      '웹·AI: 고객·관리자 Workers → 추론용 Tunnel → 직접 띄운 Google Colab LLM 추론 서버로 연결됩니다.\n업무: 전용 Tunnel → Spring Boot API → MariaDB. 공용 JWT(인증 연동 시)·파일 업로드·상담 REST를 사용합니다.\n공용: 브라우저는 상품 이미지를 읽고 SignalR 실시간 상담에 직접 연결합니다.',
    source: `flowchart TB
    Browser["고객 · 관리자 브라우저"]
    Workers["고객 웹 / 관리자 웹<br/>별도 Cloudflare Workers<br/>화면 · AI 라우트"]
    InferenceTunnel["추론 전용<br/>Cloudflare Tunnel"]
    LLM["Google Colab · GPU<br/>OpenAI 호환 HTTPS LLM 추론 서버<br/>필요 시 가동"]
    Browser -->|"화면 · AI 요청"| Workers
    Workers -->|"HTTPS 추론"| InferenceTunnel
    InferenceTunnel --> LLM
    CommerceTunnel["커머스 전용<br/>Cloudflare Tunnel"]
    InfraTunnel["공용 인프라<br/>Cloudflare Tunnel"]
    subgraph Commerce["업무 백엔드 · Raspberry Pi"]
      CommerceAPI["Spring Boot API<br/>상품 · 주문 · 관리<br/>JWT 직접 검증"]
      CommerceDB[("커머스 전용 MariaDB")]
      CommerceAPI --> CommerceDB
    end
    subgraph Shared["연동 자원 · 공용 인프라 / Raspberry Pi"]
      InfraGateway["공용 인프라 게이트웨이"]
      InfraAuth["인증 서버 · JWT 발급·갱신<br/>공개키 제공"]
      InfraFiles["파일 · 미디어 서버<br/>상품 이미지 원본 · 파생본"]
      InfraChat["채팅 서버 · SignalR<br/>실시간 상담 · 상담 이력"]
      InfraStorage[("서비스별 DB · 파일 저장소")]
      InfraGateway --> InfraAuth
      InfraGateway --> InfraFiles
      InfraGateway --> InfraChat
      InfraAuth --> InfraStorage
      InfraFiles --> InfraStorage
      InfraChat --> InfraStorage
    end
    Browser -->|"상품 · 주문 · 관리"| CommerceTunnel
    Workers -->|"AI 근거 조회"| CommerceTunnel
    CommerceTunnel --> CommerceAPI
    CommerceAPI -->|"JWT 발급·갱신 · JWKS 공개키 조회<br/>파일 업로드 · 상담 REST"| InfraTunnel
    Browser -->|"이미지 GET<br/>실시간 상담 SignalR"| InfraTunnel
    InfraTunnel --> InfraGateway`,
    compactSource: `flowchart TB
    Browser["고객 · 관리자<br/>브라우저"]
    Workers["고객 웹 / 관리자 웹<br/>별도 Cloudflare Workers<br/>화면 · AI 라우트"]
    InferenceTunnel["추론 전용<br/>Cloudflare Tunnel"]
    LLM["Google Colab · GPU<br/>OpenAI 호환 HTTPS 추론<br/>필요 시 가동"]
    CommerceEntry["커머스 전용 Tunnel<br/>Spring Boot API · Pi"]
    CommerceDB[("커머스 MariaDB")]
    InfraEntry["공용 Tunnel · 게이트웨이<br/>Raspberry Pi"]
    InfraServices["JWT 발급·갱신 · 파일/이미지 서버<br/>채팅 REST · SignalR"]
    InfraStorage[("서비스별 DB<br/>파일 저장소")]
    Browser -->|"화면 · AI"| Workers
    Browser -->|"상품 · 주문 · 관리"| CommerceEntry
    Workers -->|"AI 근거 조회"| CommerceEntry
    CommerceEntry --> CommerceDB
    Workers -->|"추론"| InferenceTunnel
    InferenceTunnel --> LLM
    CommerceEntry -->|"JWT · 공개키 조회 · 업로드<br/>상담 REST"| InfraEntry
    Browser -->|"이미지 GET<br/>상담 SignalR"| InfraEntry
    InfraEntry --> InfraServices
    InfraServices --> InfraStorage`,
  },
  {
    id: 'asset-library',
    title: '에셋 라이브러리',
    description:
      'LAN·Tailscale로 접속하며 웹·MCP는 각각 자체 인증을 사용합니다.\nRust는 웹·REST API, Node.js MCP는 제작 에이전트 연결을 담당합니다.\nSQLite는 메타데이터, 로컬 파일은 원본·미리보기를 보관합니다.',
    source: `flowchart TB
    Browser["웹<br/>브라우저"]
    Agent["제작 에이전트 · MCP<br/>클라이언트"]
    subgraph Pi["Raspberry Pi"]
      Web["React 웹<br/>Rust가 정적 화면 제공"]
      MCP["Node.js · MCP 연결 계층<br/>전용 인증"]
      API["Rust · Axum REST API<br/>에셋 서비스 자체 인증"]
      DB[("SQLite · 메타데이터")]
      Files[("로컬 파일 · 원본/미리보기")]
      Web -->|"웹 세션 인증"| API
      MCP -->|"내부 REST · 파일 중계"| API
      API --> DB
      API --> Files
    end
    Browser -->|"LAN · Tailscale"| Web
    Agent -->|"LAN · Tailscale"| MCP`,
    compactSource: `flowchart TB
    Client["브라우저 · 제작 에이전트"]
    Access["LAN · Tailscale<br/>웹 / MCP 별도 서비스 인증"]
    subgraph Pi["Raspberry Pi"]
      Entry["Rust · React 웹 제공<br/>Node.js · MCP 연결 계층"]
      API["공통 Rust · Axum REST API"]
      Storage[("SQLite · 메타데이터<br/>로컬 파일 · 원본/미리보기")]
      Entry --> API
      API --> Storage
    end
    Client --> Access
    Access --> Entry`,
  },
] as const;

export const infrastructureTransition = [
  {
    id: 'cloud',
    number: '01',
    title: '클라우드에서 운영',
    technologies: 'Java · C# / Google Compute Engine',
    description: 'Java·C# 기반 공용 인프라 서비스를 Google Compute Engine에서 운영했습니다.',
  },
  {
    id: 'optimization',
    number: '02',
    title: 'Rust로 재구현',
    technologies: 'Rust · 메모리 최적화',
    description: '공용 인프라 서비스를 Rust로 재구현하고 메모리 사용을 최적화했습니다.',
  },
  {
    id: 'raspberry-pi',
    number: '03',
    title: 'Raspberry Pi로 이전',
    technologies: 'Raspberry Pi · Cloudflare Tunnel',
    description: '공용 인프라와 이커머스 백엔드를 Raspberry Pi로 전체 이전했습니다.',
  },
] as const;

export const infrastructureMigrationReasons = [
  {
    id: 'cost', title: 'Compute Engine 비용 절감에서 출발',
    description: '처음 목표는 Google Compute Engine의 상시 운영 비용을 줄이는 것이었습니다. 트래픽이 적어도 켜 둔 VM의 CPU·메모리 용량에는 비용이 발생해, 필요한 자원 규모와 클라우드 VM 의존도를 낮추려 했습니다.',
  },
  {
    id: 'pi-plan', title: '파일 서버용 Pi로 전체 서비스 이전 시도',
    description: '라즈베리파이는 원래 파일 전송에 따른 클라우드 트래픽 과금을 피할 목적으로, 파일 서버만 직접 구축하려고 구매했습니다. 이후 파일 서버를 넘어, 클라우드에서 운영하던 공용 인프라와 이커머스 백엔드도 이 기기에 모두 올려보려 했습니다.',
  },
  {
    id: 'memory', title: '4GB 안에 서비스를 담기 위한 메모리 최적화',
    description: '라즈베리파이의 메모리는 4GB인데, 기존 Java·C# 공용 서비스 12개는 앱만 약 2,504 MiB를 사용했습니다. OS·데이터베이스·캐시·이커머스까지 그대로 모두 이전하기에는 메모리 여유가 부족해, 먼저 서비스의 상시 점유를 줄여야 했습니다.',
  },
  {
    id: 'rust', title: 'Rust 최적화 후 Pi로 이전',
    description: '인증·파일·미디어 등 공용 서비스의 역할을 유지하면서 Rust로 재구현하고 메모리를 최적화했습니다. 이후 공용 인프라와 이커머스 백엔드를 Raspberry Pi로 옮겼습니다.',
  },
] as const;

export type DeploymentMemoryComparison = {
  scope: string;
  scopeNote: string;
  before: { label: string; value: string; memoryMiB: number };
  after: { label: string; value: string; memoryMiB: number };
  ratio: number;
  reductionPercent: number;
};

/** 2026-10-13 정리본에서 선택한 이전 관찰값과 Rust 전환 후 앱 12개를 비교한다. */
export const deploymentMemoryComparison: DeploymentMemoryComparison = {
  scope: '인프라 마이그레이션 전후 메모리',
  scopeNote: '공용 인프라 앱 12개 · 데이터베이스·캐시·이커머스 API 제외',
  before: { label: '이전 · Java · C# / Google Compute Engine', value: '2,504.00 MiB', memoryMiB: 2504 },
  after: { label: '이후 · Rust / Raspberry Pi', value: '115.86 MiB', memoryMiB: 115.86 },
  ratio: 21.6,
  reductionPercent: 95.37,
};

export const deploymentMemorySource = {
  title: 'Rust 마이그레이션 전후 메모리 비교',
  preparedOn: '2026-10-13',
} as const;

export const deploymentMemoryServices = [
  { id: 'auth', label: 'Auth', language: 'Java', before: 390.80, after: 8.20 },
  { id: 'gateway', label: 'Gateway', language: 'Java', before: 223.40, after: 6.48 },
  { id: 'config', label: 'Config', language: 'Java', before: 264.00, after: 4.41 },
  { id: 'notification', label: 'Notification', language: 'Java', before: 371.00, after: 10.87 },
  { id: 'monitoring', label: 'Monitoring', language: 'Java', before: 374.20, after: 10.58 },
  { id: 'scheduler', label: 'Scheduler', language: 'Java', before: 318.50, after: 18.28 },
  { id: 'logging', label: 'Logging', language: 'C#', before: 144.10, after: 8.81 },
  { id: 'analytics', label: 'Analytics', language: 'C#', before: 97.90, after: 19.22 },
  { id: 'tracing', label: 'Tracing', language: 'C#', before: 36.80, after: 2.49 },
  { id: 'file', label: 'File', language: 'C#', before: 128.40, after: 12.02 },
  { id: 'media', label: 'Media', language: 'C#', before: 96.40, after: 7.93 },
  { id: 'chat', label: 'Chat', language: 'C#', before: 58.50, after: 6.57 },
] as const;

export const deploymentMemoryTotals = [
  { id: 'apps', label: '앱 12개 합계', before: 2504.00, after: 115.86 },
] as const;
