import { portfolioLinkedExperiments } from './deployment.ts';

type Point = readonly [number, number];
type Box = { x: number; y: number; width: number; height: number };
type Node = Box & { id: string; title: string; lines: readonly string[] };
type Layout = {
  width: number;
  height: number;
  nodes: readonly Node[];
  links: readonly { from: string; to: string; points: readonly Point[] }[];
  labels: readonly { x: number; y: number; text: string; width: number }[];
};

/** API 기둥은 한 축에 고정하고, 독립 실행 링크 두 개만 오른쪽으로 분기한다. */
function layout(compact: boolean): Layout {
  const axis = compact ? 76 : 180;
  const mainX = compact ? 4 : 65;
  const mainWidth = compact ? 144 : 230;
  const branchX = compact ? 160 : 420;
  const demoX = compact ? 172 : 520;
  const demoWidth = compact ? 164 : 280;
  const nodes: readonly Node[] = [
    { id: 'PortfolioPages', title: 'GitHub Pages', lines: ['포트폴리오 화면'], x: mainX, y: 20, width: mainWidth, height: 84 },
    { id: 'Browser', title: '브라우저', lines: [], x: mainX, y: 164, width: mainWidth, height: 64 },
    { id: 'Worker', title: compact ? 'Cloudflare' : 'Cloudflare Worker', lines: compact ? ['Worker', '챗봇 · 기록 API'] : ['챗봇 · 공개 기록 API'], x: mainX, y: 335, width: mainWidth, height: 88 },
    { id: 'ColabTunnel', title: 'Cloudflare', lines: ['Tunnel'], x: mainX, y: compact ? 608 : 535, width: mainWidth, height: 80 },
    { id: 'Colab', title: compact ? 'Google Colab' : 'Google Colab · GPU', lines: compact ? ['GPU · LLM', '추론 서버'] : ['LLM 추론 서버'], x: mainX, y: compact ? 791 : 680, width: mainWidth, height: 80 },
    { id: 'GPTSites', title: 'GPT Sites', lines: ['AI 활용 실험', ...portfolioLinkedExperiments[0].experiments.map(item => item.label)], x: demoX, y: 274, width: demoWidth, height: 242 },
    { id: 'StaticDemo', title: compact ? 'Cloudflare' : 'Cloudflare 정적 웹', lines: compact ? ['정적 웹 · 현대전', '샘플 실행 링크', 'Workers'] : ['현대전 샘플', '등록된 실행 링크', 'Workers'], x: demoX, y: compact ? 626 : 570, width: demoWidth, height: compact ? 170 : 110 },
  ];
  const node = (id: string) => nodes.find(item => item.id === id)!;
  const straight = (from: string, to: string) => ({ from, to, points: [[axis, node(from).y + node(from).height], [axis, node(to).y]] as readonly Point[] });
  const branch = (to: string) => {
    const target = node(to);
    const y = target.y + target.height / 2;
    return { from: 'Browser', to, points: [[mainX + mainWidth, 196], [branchX, 196], [branchX, y], [demoX, y]] as readonly Point[] };
  };
  return {
    width: compact ? 340 : 850,
    height: compact ? 910 : 780,
    nodes,
    links: [straight('PortfolioPages', 'Browser'), straight('Browser', 'Worker'), straight('Worker', 'ColabTunnel'), straight('ColabTunnel', 'Colab'), branch('GPTSites'), branch('StaticDemo')],
    labels: [
      { x: axis, y: 134, text: '화면 제공', width: 88 },
      { x: axis, y: 280, text: 'API 요청', width: 88 },
      { x: axis, y: compact ? 515 : 480, text: '추론 요청', width: 88 },
      { x: compact ? 254 : 630, y: 236, text: '실험 데모 열기', width: 144 },
    ],
  };
}

export const portfolioDiagramLayouts = { desktop: layout(false), mobile: layout(true) } as const;
export function portfolioConnectionPath(points: readonly Point[]) {
  return points.map(([x, y], index) => `${index ? 'L' : 'M'} ${x} ${y}`).join(' ');
}
