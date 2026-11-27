import {
  environmentDiagramNotes, environmentGroups, environmentLayouts, environmentNodes, environmentPhoneApps, environmentTailnet,
  type EnvironmentLayout,
} from '@/features/architecture/data/developmentEnvironmentDiagram';
import { orthogonalPath } from '@/features/architecture/data/developmentTopology';
import styles from './DevelopmentEnvironmentDiagram.module.css';

function Node({ node, layout }: { node: typeof environmentNodes[number]; layout: EnvironmentLayout }) {
  const [x, y, width, height] = node[layout];
  const mobile = layout === 'mobile';
  const pc = node.id === 'Home' || node.id === 'Laptop';
  const phone = node.id === 'Android';
  const titles = mobile ? (node.mobileTitle ?? [node.title]) : [node.title];
  const lines = mobile ? (node.mobileLines ?? node.lines) : node.lines;
  const center = x + width / 2;
  const titleY = y + (phone || pc ? 30 : 28);
  const sessionInset = mobile ? 8 : 12;

  return (
    <g className={[styles.node, styles[node.kind], pc ? styles.pc : '', phone ? styles.phone : ''].join(' ')}
      data-environment-node={node.id} data-environment-machine={node.kind === 'machine' ? node.id : undefined}>
      <rect x={x} y={y} width={width} height={height} rx={12} />
      <text className={styles.nodeTitle} x={center} textAnchor="middle">
        {titles.map((title, index) => <tspan key={title} x={center} y={titleY + index * 22}>{title}</tspan>)}
      </text>
      {phone ? (
        <>
          <text className={styles.detail} x={center} y={y + 53} textAnchor="middle">폰에서 조작 · 코드는 PC에서 실행</text>
          {environmentPhoneApps.map((app, index) => (
            <g key={app.id} className={styles.app} data-environment-app={app.id}>
              <rect x={x + 16} y={y + 68 + index * 52} width={width - 32} height={44} rx={7} />
              <text x={center} y={y + 87 + index * 52} textAnchor="middle">{app.label}</text>
              <text className={styles.appMethod} x={center} y={y + 104 + index * 52} textAnchor="middle">{app.method}</text>
            </g>
          ))}
        </>
      ) : pc ? (
        <>
          <text className={styles.detail} x={center} y={y + 54} textAnchor="middle">실제 작업 실행</text>
          {environmentPhoneApps.map((app, index) => (
            <g key={app.id} className={styles.session} data-environment-session={app.session}>
              <rect x={x + sessionInset} y={y + 68 + index * 35} width={width - sessionInset * 2} height={28} rx={6} />
              <text x={center} y={y + 87 + index * 35} textAnchor="middle">{app.session}</text>
            </g>
          ))}
        </>
      ) : (
        <text className={styles.detail} x={center} textAnchor="middle">
          {lines.map((line, index) => <tspan key={line} x={center} y={titleY + titles.length * 22 + index * 21}>{line}</tspan>)}
        </text>
      )}
      {node.kind === 'machine' && <text className={styles.membership} x={center} y={y + height - 12} textAnchor="middle">Tailscale 가입 기기</text>}
    </g>
  );
}

/** Both responsive views are generated from the same identities; only one is visible/accessible. */
function Diagram({ layout }: { layout: EnvironmentLayout }) {
  const drawing = environmentLayouts[layout];
  const prefix = `development-environment-${layout}`;
  return (
    <div className={styles[layout]}>
      <svg className={styles.diagram} viewBox={`0 0 ${drawing.width} ${drawing.height}`} role="img"
        data-environment-layout={layout} aria-labelledby={`${prefix}-title ${prefix}-description`}>
        <title id={`${prefix}-title`}>기기 · 앱 · 실행 환경 연결도</title>
        {/* 자세한 설명은 그림 아래 목록이 맡는다. 같은 글을 화면 낭독기가 두 번 읽지 않게 요약만 둔다. */}
        <desc id={`${prefix}-description`}>내 기기 4대와 외부 실행 환경 4개의 연결 관계입니다. 선의 의미는 그림 아래 목록에 정리했습니다.</desc>
        <defs>
          {(['remote', 'service', 'lan'] as const).map(kind => (
            <marker key={kind} id={`${prefix}-${kind}-arrow`} viewBox="0 0 10 10" refX={9} refY={5}
              markerWidth={6} markerHeight={6} orient="auto-start-reverse" markerUnits="userSpaceOnUse">
              <path className={[styles.arrow, styles[kind]].join(' ')} d="M 1 1 L 9 5 L 1 9" />
            </marker>
          ))}
        </defs>
        <g className={styles.regions}>
          {environmentGroups.map(group => {
            const [x, y, width, height] = group[layout];
            const atEnd = group.titleAnchor === 'end';
            return (
              <g key={group.id} className={styles[group.id]} data-environment-group={group.id}>
                <rect x={x} y={y} width={width} height={height} rx={14} />
                <text x={atEnd ? x + width - 12 : x + 12} y={y + 28} textAnchor={atEnd ? 'end' : 'start'}>
                  {layout === 'mobile' ? group.mobileTitle : group.title}
                </text>
              </g>
            );
          })}
        </g>
        <g className={styles.tailnet} data-environment-tailnet="membership">
          <path d={`${orthogonalPath(environmentTailnet[layout].outline)} Z`} />
          <text x={environmentTailnet[layout].title[0]} y={environmentTailnet[layout].title[1]} textAnchor="end">{environmentTailnet.title}</text>
        </g>
        <g className={styles.connections}>
          {drawing.routes.map(route => (
            <path key={route.id} className={styles[route.kind]} d={orthogonalPath(route.points)}
              data-environment-route={route.id} data-environment-kind={route.kind}
              markerEnd={route.arrow ? `url(#${prefix}-${route.kind}-arrow)` : undefined}
              markerStart={route.both ? `url(#${prefix}-${route.kind}-arrow)` : undefined} />
          ))}
          {drawing.junctions.map(({ point: [x, y], kind }) => <circle key={`${x}-${y}`} className={[styles.junction, styles[kind]].join(' ')} cx={x} cy={y} r={3} />)}
        </g>
        {environmentNodes.map(node => <Node key={node.id} node={node} layout={layout} />)}
        <g className={styles.pathLabels}>
          {drawing.labels.map(label => (
            <g key={label.text + label.x} className={styles[label.kind]}
              transform={label.rotate ? `rotate(${label.rotate} ${label.x} ${label.y})` : undefined}>
              <rect x={label.x - label.width / 2} y={label.y - 13} width={label.width} height={26} rx={6} />
              <text x={label.x} y={label.y + 5} textAnchor="middle">{label.text}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

export default function DevelopmentEnvironmentDiagram() {
  return (
    <figure className={styles.figure} aria-labelledby="development-topology-title" aria-describedby="development-topology-description">
      <figcaption id="development-topology-title">기기 · 앱 · 실행 환경 연결도</figcaption>
      <p className={styles.lead}>내 기기 4대와 외부 실행 환경 4개를 구분했습니다. 파란 선은 원격 작업, 회색 점선은 서비스 이용입니다. 초록 실선은 LAN, 초록 점선 테두리는 Tailscale VPN 가입 범위입니다.</p>
      <div className={styles.legend} aria-label="연결선 구분">
        <span><i className={styles.remote} />원격 작업</span>
        <span><i className={styles.service} />서비스 이용</span>
        <span><i className={styles.lan} />LAN · <i className={styles.vpn} />VPN</span>
      </div>
      <Diagram layout="desktop" />
      <Diagram layout="mobile" />
      <aside className={styles.history} aria-label="이전 개발 환경 · 현재 미사용">
        <strong>이전 환경 · Google Compute Engine</strong>
        <p>Pi 구매 이전에는 집 PC·노트북에서 Google Cloud 콘솔로 관리했습니다. 현재 미사용이며, Tailscale 가입 기기가 아닙니다.</p>
      </aside>
      <ul id="development-topology-description" className={styles.notes}>
        {environmentDiagramNotes.map(note => <li key={note}>{note}</li>)}
      </ul>
    </figure>
  );
}
