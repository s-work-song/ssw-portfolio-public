import {
  developmentConnections, developmentDrawingRoutes, developmentMachines, developmentNetworkTitle, developmentNetworkDescription,
  developmentNetworkNotes, orthogonalPath, phoneRemoteGroup, tailnetMachines, topologySize,
  type DevelopmentConnection, type MachineId,
} from '@/features/architecture/data/developmentTopology';
import styles from './DevelopmentTopology.module.css';

function PathLabel({ x, y, width, lines }: { x: number; y: number; width: number; lines: string[] }) {
  const height = lines.length === 1 ? 30 : 44;
  return (
    <g className={styles.pathLabel}>
      <rect x={x - width / 2} y={y - height / 2} width={width} height={height} rx={6} />
      <text x={x} textAnchor="middle" dominantBaseline="middle">
        {lines.map((line, index) => <tspan key={line} x={x} y={y + (index - (lines.length - 1) / 2) * 18}>{line}</tspan>)}
      </text>
    </g>
  );
}

function MachineCard({ id }: { id: MachineId }) {
  const machine = developmentMachines[id];
  return (
    <div className={styles.machineCard} data-machine-id={id} data-scope={machine.scope} aria-label={machine.label}>
      {(machine.compactLines ?? machine.lines).map(line => <span key={line}>{line}</span>)}
    </div>
  );
}

function ConnectionRow({ connection }: { connection: DevelopmentConnection }) {
  return (
    <div className={styles.connectionRow} data-connection-id={connection.id}>
      <p>{connection.label}</p>
      <div className={styles.pair}>
        <MachineCard id={connection.from} />
        <span aria-hidden="true" className={[styles.pairLine, styles[connection.kind]].join(' ')} />
        <MachineCard id={connection.to} />
      </div>
    </div>
  );
}

function PhoneRemoteRow() {
  return (
    <div className={styles.phoneRemote} data-connection-group={phoneRemoteGroup.id}>
      <MachineCard id={phoneRemoteGroup.source} />
      <div className={styles.phoneChannel}>
        <span className={styles.phoneStem} aria-hidden="true" />
        <p>{phoneRemoteGroup.label}</p>
      </div>
      <div className={styles.phoneTargets}>
        {phoneRemoteGroup.targets.map(id => (
          <div key={id} className={styles.phoneTarget} data-remote-target={id}>
            <MachineCard id={id} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Server-rendered SVG with fixed rows and orthogonal routes; no browser layout engine is needed. */
export default function DevelopmentTopology() {
  return (
    <figure className={styles.figure} aria-labelledby="development-topology-title" aria-describedby="development-topology-description">
      <figcaption id="development-topology-title">{developmentNetworkTitle}</figcaption>
      <div className={styles.legend} aria-label="연결선 구분">
        <span><i className={styles.remote} />기기 간 원격 작업</span>
        <span><i className={styles.lan} />내부망</span>
      </div>
      <div className={styles.desktop}>
        <svg className={styles.diagram} viewBox={`0 0 ${topologySize.width} ${topologySize.height}`}
          role="img" aria-labelledby="development-topology-svg-title development-topology-svg-description">
          <title id="development-topology-svg-title">{developmentNetworkTitle}</title>
          <desc id="development-topology-svg-description">{developmentNetworkDescription}</desc>
          <g className={styles.region} data-region="tailnet">
            <rect x={24} y={24} width={872} height={602} rx={16} />
            <text x={460} y={56} textAnchor="middle">Tailscale 가입 기기</text>
          </g>
          <g className={styles.machineGroup} data-group="work-pcs">
            <rect x={48} y={102} width={272} height={358} rx={12} />
            <text x={184} y={130} textAnchor="middle">작업 PC</text>
          </g>
          <g className={styles.machineGroup} data-group="connected-devices">
            <rect x={608} y={102} width={256} height={358} rx={12} />
            <text x={736} y={130} textAnchor="middle">서버 · 모바일</text>
          </g>
          <g className={styles.connections}>
            {developmentDrawingRoutes.map(connection => (
              <path key={connection.id} className={styles[connection.kind]} d={orthogonalPath(connection.route)}
                data-connection-id={connection.id} />
            ))}
            <circle className={styles.junction} cx={phoneRemoteGroup.junction[0]} cy={phoneRemoteGroup.junction[1]} r={3} />
          </g>
          <PathLabel x={184} y={292} width={128} lines={['RustDesk 원격 연결']} />
          <PathLabel x={460} y={192} width={132} lines={['내부망 · LAN']} />
          <PathLabel {...phoneRemoteGroup.labelPosition} lines={[phoneRemoteGroup.label]} />
          <g className={styles.machines}>
            {Object.entries(developmentMachines).map(([id, machine]) => (
              <g key={id} data-machine-id={id} data-scope={machine.scope}>
                <rect x={machine.x} y={machine.y} width={topologySize.machineWidth} height={topologySize.machineHeight} rx={8} />
                <text x={machine.x + topologySize.machineWidth / 2} textAnchor="middle" dominantBaseline="middle">
                  {machine.lines.map((line, index) => (
                    <tspan key={line} x={machine.x + topologySize.machineWidth / 2}
                      y={machine.y + topologySize.machineHeight / 2 + (index - (machine.lines.length - 1) / 2) * 21}>{line}</tspan>
                  ))}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>
      <div className={styles.mobile}>
        <section className={styles.mobileGroup} aria-label="Tailscale 가입 기기">
          <h4>Tailscale 가입 기기</h4>
          <ul className={styles.deviceList}>{tailnetMachines.map(id => <li key={id}>{developmentMachines[id].label}</li>)}</ul>
          <div className={styles.connectionStack}>
            {developmentConnections.filter(connection => !phoneRemoteGroup.connectionIds.some(id => id === connection.id))
              .map(connection => <ConnectionRow key={connection.id} connection={connection} />)}
            <PhoneRemoteRow />
          </div>
        </section>
      </div>
      <ul id="development-topology-description" className={styles.description}>
        {developmentNetworkNotes.map(note => <li key={note}>{note}</li>)}
      </ul>
    </figure>
  );
}
