export type AccessClientId = 'Home' | 'Laptop' | 'Android';
export type AccessTargetId = 'ComputeEngine' | 'CodexCloud' | 'OpenAIDots' | 'Colab' | 'Pi' | 'Grok' | 'ClaudeCode';

export const developmentAccessTargets: Record<AccessTargetId, string> = {
  ComputeEngine: 'Google Compute Engine',
  CodexCloud: 'Codex 클라우드',
  OpenAIDots: 'OpenAI Dots',
  Colab: 'Google Colab · LLM 추론 서버',
  Pi: '라즈베리파이',
  Grok: '그록봇 · 독립 머신',
  ClaudeCode: 'Claude Code',
};

type DevelopmentAccessRoute = {
  id: string;
  target: AccessTargetId;
  clients: readonly AccessClientId[];
  method: string;
  via?: string;
  channelNote?: string;
  targetRole?: string;
  historical?: boolean;
  description: string;
};

export const developmentAccessRoutes: readonly DevelopmentAccessRoute[] = [
  {
    id: 'gce-console', target: 'ComputeEngine', clients: ['Home', 'Laptop'], method: 'Google Cloud 콘솔', historical: true,
    targetRole: '이전 인프라 · 현재 미사용',
    description: 'Pi 구매·설정 이전의 인프라 환경입니다. 당시 Google Cloud 콘솔에서 원격 작업했으며, Tailscale에는 가입하지 않았습니다.',
  },
  {
    id: 'pi-ssh', target: 'Pi', clients: ['Home'], method: '내부망 · LAN · SSH', targetRole: '기기 관리',
    description: '집 PC에서 Pi의 내부망 주소로 SSH 관리 접속을 합니다.',
  },
  {
    id: 'pi-services', target: 'Pi', clients: ['Home', 'Laptop', 'Android'], method: 'Tunnel 접속', via: 'Cloudflare Tunnel', targetRole: '웹 · API 서비스',
    channelNote: '환경별 별도 터널',
    description: 'Pi의 공개 웹·API를 이용합니다. 에셋 라이브러리는 LAN·Tailscale 전용으로 제외합니다.',
  },
  {
    id: 'codex-service', target: 'CodexCloud', clients: ['Home', 'Laptop', 'Android'], method: '작업 도구', via: 'Codex',
    description: 'Codex를 통해 클라우드 작업 환경을 이용합니다.',
  },
  {
    id: 'dots-service', target: 'OpenAIDots', clients: ['Home', 'Laptop', 'Android'], method: '작업 도구', via: 'Codex',
    description: 'Codex를 통해 Dots 환경을 이용합니다.',
  },
  {
    id: 'grok-app', target: 'Grok', clients: ['Home', 'Laptop', 'Android'], method: '앱 접속',
    description: '세 기기의 앱에서 독립 그록봇 머신을 이용합니다.',
  },
  {
    id: 'colab-tunnel', target: 'Colab', clients: ['Home', 'Laptop', 'Android'], method: 'Tunnel 접속', via: 'Cloudflare Tunnel',
    channelNote: '환경별 별도 터널',
    description: 'Colab의 별도 Tunnel을 통해 LLM 추론 서버에 접속합니다.',
  },
  {
    id: 'claude-remote', target: 'ClaudeCode', clients: ['Android'], method: '원격 작업', via: 'Claude Remote Control',
    targetRole: '집 PC · 노트북에서 실행',
    description: '스마트폰에서 집 PC·노트북의 Claude Code 세션을 원격으로 이용합니다.',
  },
];

type DevelopmentAccessGroup = {
  id: string;
  clients: readonly AccessClientId[];
  historical: boolean;
  routes: DevelopmentAccessRoute[];
};

/** 접속 기기 집합이 같을 때만 묶고, 과거 환경과 현재 경로는 서로 섞지 않는다. */
export function groupDevelopmentAccessRoutes(routes: readonly DevelopmentAccessRoute[]): DevelopmentAccessGroup[] {
  const groups = new Map<string, DevelopmentAccessGroup>();
  for (const route of routes) {
    const historical = Boolean(route.historical);
    const id = `${historical ? 'historical' : 'current'}-${[...route.clients].sort().join('-')}`;
    let group = groups.get(id);
    if (!group) {
      group = { id, clients: route.clients, historical, routes: [] };
      groups.set(id, group);
    }
    group.routes.push(route);
  }
  return [...groups.values()];
}

type DevelopmentAccessChannel = {
  id: string;
  label: string;
  note?: string;
  routes: DevelopmentAccessRoute[];
};

/** 같은 기기 묶음 안에서 접속 수단을 공유하고, 그 뒤의 대상만 갈라지게 표시한다. */
export function groupDevelopmentAccessChannels(routes: readonly DevelopmentAccessRoute[]): DevelopmentAccessChannel[] {
  const channels = new Map<string, DevelopmentAccessChannel>();
  for (const route of routes) {
    const key = JSON.stringify([[...route.clients].sort(), Boolean(route.historical), route.method, route.via ?? null, route.channelNote ?? null]);
    let channel = channels.get(key);
    if (!channel) {
      channel = { id: route.id, label: route.via ?? route.method, note: route.channelNote, routes: [] };
      channels.set(key, channel);
    }
    channel.routes.push(route);
  }
  return [...channels.values()];
}

export const developmentAccessDescription =
  '접속 기기 → 접속 수단 → 대상 순서로 읽습니다. 같은 기기 묶음에서 Cloudflare Tunnel과 Codex를 한 번씩 표시하고 그 뒤에서 대상 환경으로 갈라집니다. Cloudflare Tunnel 칩은 공통 접속 수단을 뜻하며, Pi와 Colab의 실제 터널은 각각 별개입니다. Codex는 Codex 클라우드와 OpenAI Dots를 이용하는 작업 도구이며 네트워크 프록시를 뜻하지 않습니다. 내부망 SSH는 집 PC에서 Pi로 향하는 관리 경로입니다. 에셋 라이브러리는 Tunnel 공개 대상이 아닌 LAN·Tailscale 전용입니다. 독립 그록봇 머신은 세 기기의 앱에서 이용합니다. Claude Remote Control은 스마트폰에서 집 PC·노트북의 Claude Code를 이용하는 경로만 표시합니다. GCE는 Pi 구매·설정 이전에 사용한 과거 환경이며 현재 미사용입니다. 화살표는 도구를 이용하는 방향이며, 모든 접속이 Tailscale을 거친다는 뜻은 아닙니다. 사용자가 확인한 환경 구성으로, 현재 서비스 가동 상태를 검증한 그림은 아닙니다.';
