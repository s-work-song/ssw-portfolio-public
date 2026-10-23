export type CommercePoint = readonly [number, number];
type Bounds = { x: number; y: number; width: number; height: number };
type CommerceNode = Bounds & {
  id: string;
  title: string;
  lines: readonly string[];
  kind?: 'database' | 'service';
};
type CommerceLink = {
  from: string;
  to: string;
  route: readonly CommercePoint[];
  label?: { x: number; y: number; width: number; lines: readonly string[] };
};

/** Public logical paths only. Fixed peer columns prevent automatic layout drift. */
export const commerceDiagramSize = { width: 960, height: 984 } as const;
export const commerceDiagramGroups = [
  { id: 'Commerce', title: '업무 API 연결 · Raspberry Pi', x: 40, y: 450, width: 360, height: 506 },
  { id: 'Shared', title: '연동 자원 · 공용 인프라 / Raspberry Pi', x: 560, y: 450, width: 360, height: 506 },
] as const;

export const commerceDiagramNodes: readonly CommerceNode[] = [
  { id: 'Browser', title: '고객 · 관리자 브라우저', lines: [], x: 360, y: 28, width: 240, height: 72 },
  { id: 'Workers', title: '고객 웹 / 관리자 웹', lines: ['별도 Cloudflare Workers', '화면 · AI 라우트'], x: 350, y: 170, width: 260, height: 100 },
  { id: 'InferenceTunnel', title: '추론 전용', lines: ['Cloudflare Tunnel'], x: 50, y: 170, width: 230, height: 100 },
  { id: 'LLM', title: 'Google Colab · GPU', lines: ['LLM 추론 서버', '필요 시 가동'], x: 50, y: 320, width: 230, height: 90 },
  { id: 'CommerceTunnel', title: '커머스 전용', lines: ['Cloudflare Tunnel'], x: 100, y: 490, width: 240, height: 64 },
  { id: 'CommerceAPI', title: 'Spring Boot API', lines: ['상품 · 주문 · 관리', 'JWT 직접 검증'], x: 100, y: 610, width: 240, height: 90 },
  { id: 'CommerceDB', title: '커머스 전용 MariaDB', lines: ['회원 · 상품 · 주문'], kind: 'database', x: 115, y: 760, width: 210, height: 76 },
  { id: 'InfraTunnel', title: '공용 인프라', lines: ['Cloudflare Tunnel'], x: 600, y: 490, width: 280, height: 64 },
  { id: 'InfraGateway', title: '공용 인프라 게이트웨이', lines: [], x: 600, y: 610, width: 280, height: 64 },
  { id: 'InfraAuth', title: '인증 서버', lines: ['JWT 발급·갱신', '공개키 제공'], kind: 'service', x: 580, y: 734, width: 104, height: 86 },
  { id: 'InfraFiles', title: '파일 · 미디어', lines: ['상품 이미지', '원본 · 파생본'], kind: 'service', x: 692, y: 734, width: 104, height: 86 },
  { id: 'InfraChat', title: '채팅 서버', lines: ['SignalR 상담', '상담 이력'], kind: 'service', x: 804, y: 734, width: 104, height: 86 },
  { id: 'InfraStorage', title: '서비스별 DB · 파일 저장소', lines: ['각 공용 서비스가 별도로 관리'], kind: 'database', x: 622, y: 880, width: 236, height: 60 },
];

export const commerceDiagramLinks: readonly CommerceLink[] = [
  { from: 'Browser', to: 'Workers', route: [[480, 100], [480, 170]], label: { x: 480, y: 135, width: 132, lines: ['화면 · AI 요청'] } },
  { from: 'Browser', to: 'CommerceTunnel', route: [[360, 64], [20, 64], [20, 522], [100, 522]], label: { x: 180, y: 64, width: 142, lines: ['상품 · 주문 · 관리'] } },
  { from: 'Browser', to: 'InfraTunnel', route: [[600, 64], [940, 64], [940, 522], [880, 522]], label: { x: 780, y: 64, width: 184, lines: ['이미지 GET · SignalR'] } },
  { from: 'Workers', to: 'InferenceTunnel', route: [[350, 220], [280, 220]], label: { x: 315, y: 194, width: 64, lines: ['HTTPS', '추론'] } },
  { from: 'InferenceTunnel', to: 'LLM', route: [[165, 270], [165, 320]] },
  { from: 'Workers', to: 'CommerceTunnel', route: [[420, 270], [420, 416], [380, 416], [380, 522], [340, 522]], label: { x: 356, y: 406, width: 118, lines: ['AI 근거 조회'] } },
  { from: 'CommerceTunnel', to: 'CommerceAPI', route: [[220, 554], [220, 610]] },
  { from: 'CommerceAPI', to: 'CommerceDB', route: [[220, 700], [220, 760]] },
  { from: 'CommerceAPI', to: 'InfraTunnel', route: [[340, 655], [480, 655], [480, 522], [600, 522]], label: { x: 480, y: 575, width: 144, lines: ['JWT 발급·갱신', 'JWKS 공개키 조회', '업로드 · 상담 REST'] } },
  { from: 'InfraTunnel', to: 'InfraGateway', route: [[740, 554], [740, 610]] },
  { from: 'InfraGateway', to: 'InfraAuth', route: [[650, 674], [650, 704], [632, 704], [632, 734]] },
  { from: 'InfraGateway', to: 'InfraFiles', route: [[744, 674], [744, 734]] },
  { from: 'InfraGateway', to: 'InfraChat', route: [[830, 674], [830, 704], [856, 704], [856, 734]] },
  { from: 'InfraAuth', to: 'InfraStorage', route: [[632, 820], [632, 850], [680, 850], [680, 880]] },
  { from: 'InfraFiles', to: 'InfraStorage', route: [[744, 820], [744, 880]] },
  { from: 'InfraChat', to: 'InfraStorage', route: [[856, 820], [856, 850], [800, 850], [800, 880]] },
];

export function commerceConnectionPath(route: readonly CommercePoint[]) {
  if (route.length < 2) throw new Error('A commerce connection needs two endpoints');
  return route.map(([x, y], index) => {
    if (!index) return `M ${x} ${y}`;
    const [previousX, previousY] = route[index - 1];
    if (x === previousX) return `V ${y}`;
    if (y === previousY) return `H ${x}`;
    throw new Error('Commerce connections must be orthogonal');
  }).join(' ');
}
