'use client';

import { useEffect, useId } from 'react';
import { sharedInfrastructureServices } from '@/features/architecture/data/sharedInfrastructureDiagram';
import figureStyles from '../../../components/diagrams/MermaidDiagram.module.css';
import diagramStyles from './ECommerceDeploymentDiagram.module.css';
import styles from './SharedInfrastructureDeploymentDiagram.module.css';

type Props = { title: string; description: string; onSettled?: () => void };

/** 서비스 간 의존 관계를 모두 펼치지 않고 배포 경계와 개별 워크로드를 보여준다. */
export default function SharedInfrastructureDeploymentDiagram({ title, description, onSettled }: Props) {
  const captionId = useId();
  const descriptionId = useId();
  const markerId = `${useId().replace(/:/gu, '')}-infra-arrow`;
  useEffect(() => { onSettled?.(); }, [onSettled]);

  return <figure className={figureStyles.figure}>
    <figcaption id={captionId} className={figureStyles.caption}>{title}</figcaption>
    <div className={[figureStyles.viewport, styles.desktop].join(' ')} tabIndex={0} role="img" aria-labelledby={captionId} aria-describedby={descriptionId}>
      <div className={figureStyles.svg} data-diagram-status="ready" data-infra-layout="services">
        <svg className={diagramStyles.diagram} viewBox="0 0 960 1060" aria-hidden="true" focusable="false">
          <defs><marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path className={diagramStyles.arrow} d="M 0 0 L 10 5 L 0 10 Z" /></marker></defs>
          <g className={diagramStyles.group}>
            <rect x="20" y="215" width="920" height="820" rx="14" />
            <text x="830" y="235">Raspberry Pi</text>
            <rect className={styles.cluster} x="50" y="250" width="860" height="750" rx="12" />
            <text className={styles.clusterTitle} x="734" y="274">K3s · 서비스별 독립 워크로드</text>
          </g>
          <g className={diagramStyles.node}>
            <rect x="340" y="22" width="280" height="64" rx="7" />
            <text x="480" y="54">브라우저 · 연동 서비스</text>
            <rect x="340" y="134" width="280" height="64" rx="7" />
            <text x="480" y="166">Cloudflare Tunnel</text>
            <rect x="340" y="302" width="280" height="64" rx="7" />
            <text x="480" y="323"><tspan className={diagramStyles.nodeTitle} x="480">Rust 공용 인프라 게이트웨이</tspan><tspan x="480" dy="23">요청 라우팅 · 공통 처리</tspan></text>
          </g>
          <g className={diagramStyles.connections}>
            <path d="M 480 86 V 134" markerEnd={`url(#${markerId})`} />
            <path d="M 480 198 V 302" markerEnd={`url(#${markerId})`} />
            <path d="M 480 366 V 414" markerEnd={`url(#${markerId})`} />
            <path d="M 480 848 V 922" markerEnd={`url(#${markerId})`} />
          </g>
          <g className={diagramStyles.linkLabel}>
            <rect x="418" y="96" width="124" height="28" rx="4" /><text x="480" y="110">공용 API 요청</text>
            <rect x="398" y="376" width="164" height="28" rx="4" /><text x="480" y="390">내부 서비스 연결</text>
            <rect x="344" y="873" width="272" height="28" rx="4" /><text x="480" y="887">서비스별 내부 의존 자원</text>
          </g>
          <g className={diagramStyles.group}><rect x="80" y="414" width="800" height="434" rx="10" /><text x="480" y="432">공용 기능 · 운영 서비스</text></g>
          {sharedInfrastructureServices.map((service, index) => {
            const x = index === 12 ? 393 : 96 + index % 4 * 200;
            const y = 453 + Math.floor(index / 4) * 98;
            return <g key={service.id} className={diagramStyles.node} data-infra-service={service.id}>
              <rect x={x} y={y} width="174" height="76" rx="7" />
              <text className={styles.serviceText} x={x + 87} y={y + 27}><tspan className={diagramStyles.nodeTitle} x={x + 87}>{service.title}</tspan><tspan x={x + 87} dy="24">{service.role}</tspan></text>
            </g>;
          })}
          <g className={diagramStyles.database}>
            <rect className={styles.storage} x="80" y="922" width="800" height="60" rx="14" />
            <text className={styles.storageText} x="480" y="941"><tspan x="480">서비스별 DB · 캐시 · 파일 볼륨</tspan><tspan x="480" dy="23">각 서비스의 내부 자원 · 공용 DB 하나를 공유한다는 뜻이 아님</tspan></text>
          </g>
        </svg>
      </div>
    </div>
    <div className={styles.mobile}>
      <p className={styles.access}>브라우저·연동 서비스 → Cloudflare Tunnel</p>
      <section className={styles.pi} aria-label="Raspberry Pi의 K3s 배포 구성">
        <h5>Raspberry Pi</h5>
        <div className={styles.clusterCard}>
          <h6>K3s · 서비스별 독립 워크로드</h6>
          <p className={styles.gateway}>Rust 공용 인프라 게이트웨이<br /><span>요청 라우팅 · 공통 처리</span></p>
          <p className={styles.mobileLabel}>↓ 내부 서비스 연결</p>
          <ul className={styles.services}>{sharedInfrastructureServices.map(service => <li key={service.id} data-infra-service={service.id}><strong>{service.title}</strong><span>{service.role}</span></li>)}</ul>
          <p className={styles.mobileStorage}>서비스별 DB · 캐시 · 파일 볼륨<br /><span>각 서비스의 내부 자원</span></p>
        </div>
      </section>
    </div>
    <ul id={descriptionId} className={figureStyles.description}>{description.split('\n').filter(Boolean).map(line => <li key={line}>{line}</li>)}</ul>
  </figure>;
}
