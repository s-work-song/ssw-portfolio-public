export type MachineId = 'Home' | 'Laptop' | 'Android' | 'Pi' | 'Grok';
export type Point = readonly [number, number];
export type ConnectionKind = 'remote' | 'lan';

type Machine = {
  label: string;
  lines: readonly string[];
  compactLines?: readonly string[];
  scope: 'tailnet';
  x: number;
  y: number;
};

export type DevelopmentConnection = {
  id: string;
  from: MachineId;
  to: MachineId;
  kind: ConnectionKind;
  label: string;
  route: readonly Point[];
};

export const topologySize = { width: 920, height: 650, machineWidth: 208, machineHeight: 72 } as const;

/** Fixed rows keep peers aligned; these are drawing coordinates, not network addresses. */
export const developmentMachines: Record<MachineId, Machine> = {
  Home: { label: '집 PC', lines: ['집 PC'], scope: 'tailnet', x: 80, y: 156 },
  Laptop: { label: '노트북', lines: ['노트북'], scope: 'tailnet', x: 80, y: 356 },
  Pi: { label: '라즈베리파이', lines: ['라즈베리파이'], scope: 'tailnet', x: 632, y: 156 },
  Android: { label: '안드로이드 스마트폰', lines: ['안드로이드', '스마트폰'], scope: 'tailnet', x: 632, y: 356 },
  Grok: { label: '그록봇', lines: ['그록봇 · 독립 머신', '앱 접속은 위 경로 참고'], scope: 'tailnet', x: 356, y: 536 },
};

export const developmentConnections: readonly DevelopmentConnection[] = [
  { id: 'rustdesk', from: 'Home', to: 'Laptop', kind: 'remote', label: 'RustDesk 원격 연결', route: [[184, 228], [184, 356]] },
  { id: 'home-lan', from: 'Home', to: 'Pi', kind: 'lan', label: '내부망 · LAN', route: [[288, 192], [632, 192]] },
  { id: 'phone-home', from: 'Home', to: 'Android', kind: 'remote', label: 'Codex 원격 · Claude Remote Control', route: [[252, 228], [252, 284], [340, 284], [340, 392], [632, 392]] },
  { id: 'phone-laptop', from: 'Laptop', to: 'Android', kind: 'remote', label: 'Codex 원격 · Claude Remote Control', route: [[288, 392], [632, 392]] },
];

/** The phone is the client; logical endpoints above retain their drawing-order identity. */
export const phoneRemoteGroup = {
  id: 'phone-pcs',
  source: 'Android',
  targets: ['Home', 'Laptop'],
  connectionIds: ['phone-home', 'phone-laptop'],
  label: 'Codex 원격 · Claude Remote Control',
  labelPosition: { x: 488, y: 392, width: 268 },
  junction: [340, 392],
} as const;

/** Render a shared stem once rather than painting the overlapping logical phone routes twice. */
export const developmentDrawingRoutes: readonly { id: string; kind: ConnectionKind; route: readonly Point[] }[] = [
  ...developmentConnections.filter(connection => !phoneRemoteGroup.connectionIds.some(id => id === connection.id)),
  { id: 'phone-shared', kind: 'remote', route: [[632, 392], phoneRemoteGroup.junction] },
  { id: 'phone-home', kind: 'remote', route: [phoneRemoteGroup.junction, [340, 284], [252, 284], [252, 228]] },
  { id: 'phone-laptop', kind: 'remote', route: [phoneRemoteGroup.junction, [288, 392]] },
];

export const tailnetMachines: readonly MachineId[] = ['Home', 'Laptop', 'Pi', 'Android', 'Grok'];
export const developmentNetworkTitle = 'Tailscale 가입 기기 · 기기 간 연결';
export const developmentNetworkNotes = [
  '집 PC·노트북·스마트폰·라즈베리파이·독립 그록봇 머신이 Tailscale 가입 기기입니다. 박스는 가입 기기 묶음이며, 모든 원격 작업의 VPN 경유를 뜻하지 않습니다.',
  '집 PC ↔ 노트북은 RustDesk 원격 연결, 집 PC ↔ 라즈베리파이는 내부망(LAN)을 사용합니다.',
  '스마트폰에서 집 PC와 노트북 각각의 Codex 원격·Claude Remote Control을 이용합니다.',
  '그록봇의 앱 접속과 외부 클라우드·Tunnel 서비스 이용은 위의 접속 경로 그림에서 따로 표시합니다.',
] as const;
export const developmentNetworkDescription = developmentNetworkNotes.join(' ');

/** Emit only horizontal/vertical segments. Reject a diagonal rather than hiding a layout mistake. */
export function orthogonalPath(points: readonly Point[]) {
  if (points.length < 2) throw new Error('A connection needs two endpoints');
  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let index = 1; index < points.length; index += 1) {
    const [x, y] = points[index];
    const [previousX, previousY] = points[index - 1];
    if (x === previousX) path += ` V ${y}`;
    else if (y === previousY) path += ` H ${x}`;
    else throw new Error('Development connections must be orthogonal');
  }
  return path;
}
