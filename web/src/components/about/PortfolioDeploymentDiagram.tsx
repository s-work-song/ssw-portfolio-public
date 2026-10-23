'use client';

import { useEffect, useId } from 'react';
import { portfolioConnectionPath, portfolioDiagramLayouts } from '@/data/portfolioDiagram';
import figureStyles from './MermaidDiagram.module.css';
import styles from './PortfolioDeploymentDiagram.module.css';

type Props = { title: string; description: string; onSettled?: () => void };

/** 2개 반응형 뷰는 같은 노드·연결을 사용하고, CSS로 한 뷰만 표시한다. */
export default function PortfolioDeploymentDiagram({ title, description, onSettled }: Props) {
  const captionId = useId();
  const descriptionId = useId();
  const markerPrefix = useId().replace(/:/gu, '');
  useEffect(() => { onSettled?.(); }, [onSettled]);

  return (
    <figure className={figureStyles.figure}>
      <figcaption id={captionId} className={figureStyles.caption}>{title}</figcaption>
      <div className={figureStyles.viewport} tabIndex={0} role="img" aria-labelledby={captionId} aria-describedby={descriptionId}>
        <div className={figureStyles.svg} data-diagram-status="ready">
          {(['desktop', 'mobile'] as const).map(layout => {
            const drawing = portfolioDiagramLayouts[layout];
            const markerId = `${markerPrefix}-${layout}-arrow`;
            return <svg key={layout} className={[styles.diagram, styles[layout]].join(' ')}
              viewBox={`0 0 ${drawing.width} ${drawing.height}`} data-portfolio-layout={layout} aria-hidden="true" focusable="false">
              <defs><marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path className={styles.arrow} d="M 0 0 L 10 5 L 0 10 Z" /></marker></defs>
              <g className={styles.connections}>
                {drawing.links.map(link => <path key={`${link.from}-${link.to}`} data-portfolio-link={`${link.from}-${link.to}`}
                  d={portfolioConnectionPath(link.points)} markerEnd={`url(#${markerId})`} />)}
              </g>
              {drawing.labels.map(label => <g key={label.text} className={styles.label}>
                <rect x={label.x - label.width / 2} y={label.y - 14} width={label.width} height={28} rx={4} />
                <text x={label.x} y={label.y}>{label.text}</text>
              </g>)}
              {drawing.nodes.map(node => {
                const center = node.x + node.width / 2;
                const firstY = node.y + node.height / 2 - node.lines.length * 12;
                return <g key={node.id} className={styles.node} data-portfolio-node={node.id}>
                  <rect x={node.x} y={node.y} width={node.width} height={node.height} rx={7} />
                  <text x={center} y={firstY}>
                    <tspan className={styles.title} x={center}>{node.title}</tspan>
                    {node.lines.map(line => <tspan key={line} x={center} dy={24}>{line}</tspan>)}
                  </text>
                </g>;
              })}
            </svg>;
          })}
        </div>
      </div>
      <ul id={descriptionId} className={figureStyles.description}>
        {description.split('\n').filter(Boolean).map(line => <li key={line}>{line}</li>)}
      </ul>
    </figure>
  );
}
