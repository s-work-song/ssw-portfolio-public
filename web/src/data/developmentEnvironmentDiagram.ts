import { developmentMachines, type MachineId, type Point } from './developmentTopology.ts';
import { developmentAccessTargets } from './developmentAccess.ts';

export type EnvironmentNodeId = MachineId | 'CloudTunnel' | 'CodexTool' | 'Colab' | 'CodexCloud' | 'OpenAIDots';
export type EnvironmentLayout = 'desktop' | 'mobile';
export type EnvironmentLinkKind = 'remote' | 'service' | 'lan';
export type Bounds = readonly [x: number, y: number, width: number, height: number];

type EnvironmentNode = {
  id: EnvironmentNodeId;
  title: string;
  mobileTitle?: readonly string[];
  lines: readonly string[];
  mobileLines?: readonly string[];
  kind: 'machine' | 'channel' | 'cloud';
  desktop: Bounds;
  mobile: Bounds;
};

/** One identity per device. The two layouts reuse these nodes, never separate client groups. */
export const environmentNodes: readonly EnvironmentNode[] = [
  { id: 'Home', title: developmentMachines.Home.label, lines: [], kind: 'machine', desktop: [130, 354, 240, 190], mobile: [14, 372, 136, 158] },
  { id: 'Android', title: '안드로이드폰', lines: [], kind: 'machine', desktop: [80, 66, 260, 206], mobile: [14, 88, 260, 198] },
  { id: 'Laptop', title: developmentMachines.Laptop.label, lines: [], kind: 'machine', desktop: [610, 354, 240, 190], mobile: [210, 372, 136, 158] },
  { id: 'CloudTunnel', title: 'Cloudflare Tunnel', mobileTitle: ['Cloudflare', 'Tunnel'], lines: ['Pi · Colab의 터널은 각각 별개'], mobileLines: ['환경별 별도 터널'], kind: 'channel', desktop: [80, 1016, 254, 88], mobile: [14, 1008, 146, 96] },
  { id: 'CodexTool', title: 'Codex', lines: ['클라우드 작업 도구', 'PC 원격 작업과 별도 경로'], mobileLines: ['클라우드 작업 도구'], kind: 'channel', desktop: [380, 1016, 260, 88], mobile: [14, 1178, 146, 96] },
  { id: 'Grok', title: developmentMachines.Grok.label, lines: ['독립 머신', '앱에서 접속'], kind: 'machine', desktop: [704, 1016, 208, 112], mobile: [200, 1008, 146, 112] },
  { id: 'Pi', title: developmentMachines.Pi.label, lines: ['웹 · API 서비스 / 기기 관리', '에셋 라이브러리: LAN · Tailscale 전용'], mobileLines: ['웹 · API / 기기 관리', '에셋 라이브러리', 'LAN · Tailscale 전용'], kind: 'machine', desktop: [130, 622, 254, 148], mobile: [14, 616, 146, 156] },
  { id: 'Colab', title: 'Google Colab', lines: ['LLM 추론 서버', 'ComfyUI 이미지 · 영상 생성'], mobileLines: ['LLM 추론 서버', 'ComfyUI', '이미지 · 영상 생성'], kind: 'cloud', desktop: [48, 1294, 240, 112], mobile: [200, 1528, 146, 110] },
  { id: 'CodexCloud', title: developmentAccessTargets.CodexCloud, mobileTitle: ['Codex', '클라우드'], lines: ['클라우드 작업 환경'], mobileLines: ['작업 환경'], kind: 'cloud', desktop: [328, 1294, 240, 96], mobile: [14, 1528, 146, 100] },
  { id: 'OpenAIDots', title: developmentAccessTargets.OpenAIDots, mobileTitle: ['OpenAI Dots'], lines: ['Dots 작업 환경'], kind: 'cloud', desktop: [608, 1294, 240, 96], mobile: [14, 1688, 146, 86] },
];

/** Ownership and access tools are separate from Tailscale membership. */
export const environmentGroups: readonly {
  id: 'personal' | 'access' | 'externalTailnet' | 'external'; title: string; mobileTitle: string;
  nodeIds: readonly EnvironmentNodeId[]; desktop: Bounds; mobile: Bounds; titleAnchor?: 'start' | 'end';
}[] = [
  { id: 'personal', title: '내 기기 · 4', mobileTitle: '내 기기 · 4', nodeIds: ['Home', 'Laptop', 'Android', 'Pi'], desktop: [24, 44, 912, 772], mobile: [2, 44, 356, 772], titleAnchor: 'end' },
  { id: 'access', title: '접속 수단 · 머신 아님', mobileTitle: '접속 수단', nodeIds: ['CloudTunnel', 'CodexTool'], desktop: [24, 964, 628, 174], mobile: [2, 956, 176, 346], titleAnchor: 'end' },
  { id: 'externalTailnet', title: '외부 머신 · 1', mobileTitle: '외부 머신 · 1', nodeIds: ['Grok'], desktop: [672, 964, 264, 174], mobile: [194, 956, 164, 196], titleAnchor: 'end' },
  { id: 'external', title: '외부 실행 환경 · 3', mobileTitle: '외부 머신 · 3', nodeIds: ['CodexCloud', 'OpenAIDots', 'Colab'], desktop: [24, 1228, 912, 190], mobile: [2, 1468, 356, 346], titleAnchor: 'end' },
];

/** Membership outline extends only around the external Grok machine, not access tools. */
export const environmentTailnet = {
  nodeIds: ['Home', 'Laptop', 'Android', 'Pi', 'Grok'],
  title: 'Tailscale VPN 가입 범위 · 5',
  desktop: { outline: [[8, 8], [952, 8], [952, 1156], [660, 1156], [660, 842], [8, 842], [8, 8]], title: [940, 28] },
  mobile: { outline: [[0, 8], [360, 8], [360, 1168], [186, 1168], [186, 848], [0, 848], [0, 8]], title: [348, 28] },
} as const;

export const environmentPhoneApps = [
  { id: 'CodexAndroid', label: 'Codex 앱', method: 'Codex 원격', session: 'Codex 세션' },
  { id: 'ClaudeAndroid', label: 'Claude 앱', method: 'Remote Control', session: 'Claude Code 세션' },
] as const;

/** Three clients share a collector; access tools and Grok leave through separate logical stems. */
export const environmentServiceGroup = {
  clients: ['Home', 'Laptop', 'Android'],
  sourceRouteIds: ['home-services', 'laptop-services', 'phone-services'],
  collectorId: 'service-inputs',
  stemId: 'service-output',
  fanoutId: 'service-fanout',
  branchRouteIds: ['service-tunnel', 'service-codex'],
  junctions: { desktop: [460, 588], mobile: [180, 586] },
  forks: { desktop: [460, 940], mobile: [180, 924] },
} as const;

/** Grok descends directly from the client collector, independent of the access-tool fanout. */
export const environmentGrokGroup = {
  clients: environmentServiceGroup.clients,
  sourceRouteIds: environmentServiceGroup.sourceRouteIds,
  stemId: 'grok-access',
  junctions: { desktop: [808, 588], mobile: [354, 586] },
} as const;

export const environmentRelations = [
  { from: 'Android', to: 'Home', kind: 'remote', methods: ['Codex 원격', 'Claude Remote Control'] },
  { from: 'Android', to: 'Laptop', kind: 'remote', methods: ['Codex 원격', 'Claude Remote Control'] },
  { from: 'Home', to: 'Laptop', kind: 'remote', methods: ['RustDesk'] },
  { from: 'Home', to: 'Pi', kind: 'lan', methods: ['LAN'] },
  ...(['Home', 'Laptop', 'Android'] as const).flatMap(from => [
    { from, to: 'CloudTunnel', kind: 'service', methods: ['Cloudflare Tunnel'] } as const,
    { from, to: 'CodexTool', kind: 'service', methods: ['Codex'] } as const,
  ]),
  ...environmentGrokGroup.clients.map(from => ({ from, to: 'Grok', kind: 'service', methods: ['앱 접속'] } as const)),
  { from: 'CloudTunnel', to: 'Pi', kind: 'service', methods: ['Pi 웹 · API 터널'] },
  { from: 'CloudTunnel', to: 'Colab', kind: 'service', methods: ['Colab 추론 터널'] },
  { from: 'CodexTool', to: 'CodexCloud', kind: 'service', methods: ['클라우드 작업'] },
  { from: 'CodexTool', to: 'OpenAIDots', kind: 'service', methods: ['Dots 작업'] },
] as const;

type DrawingRoute = { id: string; kind: EnvironmentLinkKind; points: readonly Point[]; arrow?: boolean; both?: boolean };
type DrawingLabel = { x: number; y: number; width: number; text: string; kind: EnvironmentLinkKind; rotate?: number };

export const environmentLayouts: Record<EnvironmentLayout, {
  width: number; height: number; routes: readonly DrawingRoute[]; labels: readonly DrawingLabel[];
  junctions: readonly { point: Point; kind: EnvironmentLinkKind }[];
}> = {
  desktop: {
    width: 960, height: 1436,
    routes: [
      { id: 'phone-output', kind: 'remote', points: [[210, 272], [210, 308]] },
      { id: 'phone-branches', kind: 'remote', points: [[210, 308], [730, 308]] },
      { id: 'phone-home', kind: 'remote', points: [[250, 308], [250, 354]], arrow: true },
      { id: 'phone-laptop', kind: 'remote', points: [[730, 308], [730, 354]], arrow: true },
      { id: 'rustdesk', kind: 'remote', points: [[370, 468], [610, 468]], arrow: true, both: true },
      { id: 'home-services', kind: 'service', points: [[370, 516], [460, 516], [460, 588]] },
      { id: 'phone-services', kind: 'service', points: [[340, 148], [880, 148], [880, 588]] },
      { id: 'laptop-services', kind: 'service', points: [[730, 544], [730, 588]] },
      { id: 'service-inputs', kind: 'service', points: [[460, 588], [880, 588]] },
      { id: 'service-output', kind: 'service', points: [[460, 588], [460, 940]] },
      { id: 'service-fanout', kind: 'service', points: [[304, 940], [460, 940]] },
      { id: 'service-tunnel', kind: 'service', points: [[304, 940], [304, 1016]], arrow: true },
      { id: 'service-codex', kind: 'service', points: [[460, 940], [460, 1016]], arrow: true },
      { id: 'grok-access', kind: 'service', points: [[808, 588], [808, 1016]], arrow: true },
      { id: 'tunnel-pi', kind: 'service', points: [[250, 1016], [250, 770]], arrow: true },
      { id: 'tunnel-colab', kind: 'service', points: [[168, 1104], [168, 1294]], arrow: true },
      { id: 'codex-output', kind: 'service', points: [[510, 1104], [510, 1196]] },
      { id: 'codex-branches', kind: 'service', points: [[448, 1196], [728, 1196]] },
      { id: 'codex-cloud', kind: 'service', points: [[448, 1196], [448, 1294]], arrow: true },
      { id: 'codex-dots', kind: 'service', points: [[728, 1196], [728, 1294]], arrow: true },
      { id: 'home-pi', kind: 'lan', points: [[250, 544], [250, 622]], arrow: true },
    ],
    labels: [
      { x: 480, y: 308, width: 330, text: 'Codex 원격 · Claude Remote Control', kind: 'remote' },
      { x: 490, y: 468, width: 100, text: 'RustDesk', kind: 'remote' },
      { x: 250, y: 583, width: 70, text: 'LAN', kind: 'lan' },
    ],
    junctions: [
      { point: [250, 308], kind: 'remote' }, { point: [730, 588], kind: 'service' },
      { point: environmentServiceGroup.junctions.desktop, kind: 'service' },
      { point: environmentServiceGroup.forks.desktop, kind: 'service' },
      { point: [510, 1196], kind: 'service' },
      { point: environmentGrokGroup.junctions.desktop, kind: 'service' },
    ],
  },
  mobile: {
    width: 360, height: 1832,
    routes: [
      { id: 'phone-output', kind: 'remote', points: [[144, 286], [144, 312]] },
      { id: 'phone-branches', kind: 'remote', points: [[82, 312], [278, 312]] },
      { id: 'phone-home', kind: 'remote', points: [[82, 312], [82, 372]], arrow: true },
      { id: 'phone-laptop', kind: 'remote', points: [[278, 312], [278, 372]], arrow: true },
      { id: 'rustdesk', kind: 'remote', points: [[150, 462], [210, 462]], arrow: true, both: true },
      { id: 'phone-services', kind: 'service', points: [[274, 146], [354, 146], [354, 586]] },
      { id: 'laptop-services', kind: 'service', points: [[346, 494], [354, 494]] },
      { id: 'home-services', kind: 'service', points: [[130, 530], [130, 586]] },
      { id: 'service-inputs', kind: 'service', points: [[130, 586], [354, 586]] },
      { id: 'service-output', kind: 'service', points: [[180, 586], [180, 924]] },
      { id: 'service-fanout', kind: 'service', points: [[170, 924], [180, 924]] },
      { id: 'service-tunnel', kind: 'service', points: [[170, 924], [170, 1056], [160, 1056]], arrow: true },
      { id: 'service-codex', kind: 'service', points: [[180, 924], [180, 1226], [160, 1226]], arrow: true },
      { id: 'grok-access', kind: 'service', points: [[354, 586], [354, 1064], [346, 1064]], arrow: true },
      { id: 'tunnel-pi', kind: 'service', points: [[87, 1008], [87, 772]], arrow: true },
      { id: 'tunnel-colab', kind: 'service', points: [[140, 1104], [190, 1104], [190, 1380], [214, 1380], [214, 1528]], arrow: true },
      { id: 'codex-output', kind: 'service', points: [[87, 1274], [87, 1420]] },
      { id: 'codex-cloud', kind: 'service', points: [[87, 1420], [87, 1528]], arrow: true },
      { id: 'codex-dots', kind: 'service', points: [[87, 1420], [180, 1420], [180, 1731], [160, 1731]], arrow: true },
      { id: 'home-pi', kind: 'lan', points: [[82, 530], [82, 616]], arrow: true },
    ],
    labels: [
      { x: 180, y: 312, width: 330, text: 'Codex 원격 · Claude Remote Control', kind: 'remote' },
      { x: 180, y: 462, width: 94, text: 'RustDesk', kind: 'remote', rotate: -90 },
      { x: 82, y: 573, width: 70, text: 'LAN', kind: 'lan' },
    ],
    junctions: [
      { point: [144, 312], kind: 'remote' }, { point: environmentServiceGroup.junctions.mobile, kind: 'service' },
      { point: [354, 494], kind: 'service' }, { point: environmentServiceGroup.forks.mobile, kind: 'service' },
      { point: [87, 1420], kind: 'service' },
      { point: environmentGrokGroup.junctions.mobile, kind: 'service' },
    ],
  },
};

export const environmentDiagramNotes = [
  '내 기기는 집 PC·노트북·안드로이드폰·라즈베리파이 4대입니다. 외부 실행 환경 4개 중 그록봇은 접속 수단 옆의 별도 머신 영역에, Codex 클라우드·OpenAI Dots·Google Colab은 아래에 표시합니다. 접속 수단은 머신과 따로 구분합니다.',
  '스마트폰의 Codex 앱·Claude 앱으로 집 PC와 노트북의 실행 세션을 원격 조작합니다. 코드는 해당 PC에서 실행되며, Codex 클라우드·Dots 작업과는 별도 경로입니다.',
  '회색 점선은 세 기기가 각각 서비스를 이용한다는 논리적 관계이며, 선이 만나는 점은 네트워크 장비나 프록시가 아닙니다. 내 기기 영역 안에서 세 기기의 선을 합친 뒤, 접속 수단 쪽 선은 카드 위에서 갈라져 Cloudflare Tunnel과 Codex에 연결됩니다. 그록봇 앱 접속은 세 기기의 선이 합쳐진 뒤 한 줄로 이어지며, 내 기기 영역의 오른쪽 합류선에서 별도로 내려옵니다. 아래쪽에서 접속 수단의 분기선과 연결하지 않습니다. Pi의 서비스 제공 경로는 별도이며, Pi와 Colab의 실제 Cloudflare Tunnel은 각각 별개입니다.',
  '집 PC ↔ 노트북은 RustDesk, 집 PC와 Pi는 내부망(LAN)으로 연결됩니다. 에셋 라이브러리는 Tunnel 공개 대상이 아닌 LAN·Tailscale 전용입니다.',
  'Google Colab은 LLM 추론 서버와 ComfyUI 이미지·영상 생성 작업에 사용합니다. ComfyUI는 별도 머신이 아닌 Colab 카드 안의 작업 용도로 표시합니다.',
  '초록 실선은 내부망(LAN) 연결, 초록 점선 테두리는 Tailscale VPN 가입 범위입니다. 내 기기 4대와 외부 그록봇만 VPN 범위에 포함하고, Cloudflare Tunnel·Codex 도구와 나머지 외부 실행 환경은 범위 밖에 둡니다. 모든 선이 Tailscale을 거치거나 현재 서비스가 가동 중임을 뜻하지 않습니다.',
] as const;
