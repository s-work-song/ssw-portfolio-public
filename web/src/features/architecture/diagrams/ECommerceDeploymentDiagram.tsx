'use client';

import { useEffect, useId, useSyncExternalStore } from 'react';
import { commerceConnectionPath, commerceDiagramGroups, commerceDiagramLinks, commerceDiagramNodes, commerceDiagramSize } from '@/features/architecture/data/commerceDiagram';
import MermaidDiagram from '../../../components/diagrams/MermaidDiagram';
import figureStyles from '../../../components/diagrams/MermaidDiagram.module.css';
import styles from './ECommerceDeploymentDiagram.module.css';

const compactQuery = '(max-width: 760px)';
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(compactQuery);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
const getCompact = () => window.matchMedia(compactQuery).matches;
const getServerCompact = () => false;

type Props = { title: string; description: string; compactDiagram: string; onSettled?: () => void };

/** Desktop coordinates align peer systems; narrow screens retain the compact Mermaid view. */
export default function ECommerceDeploymentDiagram({ title, description, compactDiagram, onSettled }: Props) {
  const compact = useSyncExternalStore(subscribe, getCompact, getServerCompact);
  const captionId = useId();
  const descriptionId = useId();
  const markerId = `${useId().replace(/:/gu, '')}-commerce-arrow`;

  useEffect(() => {
    // On mobile hydration, wait for the compact renderer instead of releasing from the SSR SVG.
    if (!compact && !getCompact()) onSettled?.();
  }, [compact, onSettled]);

  if (compact) return <MermaidDiagram diagram={compactDiagram} title={title} description={description} onSettled={onSettled} />;

  return (
    <figure className={figureStyles.figure}>
      <figcaption id={captionId} className={figureStyles.caption}>{title}</figcaption>
      <div className={figureStyles.viewport} tabIndex={0} role="img" aria-labelledby={captionId} aria-describedby={descriptionId}>
        <div className={figureStyles.svg} data-diagram-status="ready" data-commerce-layout="balanced">
          <svg className={styles.diagram} viewBox={`0 0 ${commerceDiagramSize.width} ${commerceDiagramSize.height}`} aria-hidden="true" focusable="false">
            <defs><marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path className={styles.arrow} d="M 0 0 L 10 5 L 0 10 Z" /></marker></defs>
            {commerceDiagramGroups.map(group => (
              <g key={group.id} className={styles.group} data-commerce-group={group.id}>
                <rect x={group.x} y={group.y} width={group.width} height={group.height} rx="12" />
                <text x={group.x + group.width / 2} y={group.y + 25}>{group.title}</text>
              </g>
            ))}
            <g className={styles.connections}>
              {commerceDiagramLinks.map(link => <path key={`${link.from}-${link.to}`} data-commerce-link={`${link.from}-${link.to}`} d={commerceConnectionPath(link.route)} markerEnd={`url(#${markerId})`} />)}
            </g>
            {commerceDiagramLinks.filter(link => link.label).map(link => {
              const label = link.label!;
              const height = label.lines.length * 20 + 8;
              return <g key={`${link.from}-${link.to}-label`} className={styles.linkLabel}>
                <rect x={label.x - label.width / 2} y={label.y - height / 2} width={label.width} height={height} rx="4" />
                <text x={label.x} y={label.y - (label.lines.length - 1) * 10}>
                  {label.lines.map((line, index) => <tspan key={line} x={label.x} dy={index ? 20 : 0}>{line}</tspan>)}
                </text>
              </g>;
            })}
            {commerceDiagramNodes.map(node => {
              const count = node.lines.length + 1;
              const lineHeight = node.kind === 'service' ? 20 : 22;
              const firstY = node.y + node.height / 2 - (count - 1) * lineHeight / 2;
              return <g key={node.id} data-commerce-node={node.id} className={[styles.node, node.kind === 'service' ? styles.service : '', node.kind === 'database' ? styles.database : ''].join(' ')}>
                <rect x={node.x} y={node.y} width={node.width} height={node.height} rx={node.kind === 'database' ? 18 : 7} />
                <text x={node.x + node.width / 2} y={firstY}>
                  <tspan className={styles.nodeTitle} x={node.x + node.width / 2}>{node.title}</tspan>
                  {node.lines.map(line => <tspan key={line} x={node.x + node.width / 2} dy={lineHeight}>{line}</tspan>)}
                </text>
              </g>;
            })}
            <text className={styles.note} x="220" y="894">
              <tspan x="220">커머스 업무 데이터는 전용 DB에 보관</tspan>
              <tspan x="220" dy="23">공용 파일·채팅 저장소와 분리</tspan>
            </text>
          </svg>
        </div>
      </div>
      <ul id={descriptionId} className={figureStyles.description}>
        {description.split('\n').filter(Boolean).map(line => <li key={line}>{line}</li>)}
      </ul>
    </figure>
  );
}
