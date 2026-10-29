'use client';

import Script from 'next/script';
import { useEffect, useId, useRef, useState } from 'react';
import styles from './MermaidDiagram.module.css';
import { straightenRenderedEdges } from './straightenEdges';

type Mermaid = {
  initialize(config: Record<string, unknown>): void;
  render(id: string, source: string): Promise<{ svg: string }>;
};

type Props = {
  diagram: string;
  compactDiagram?: string;
  title: string;
  description: string;
  className?: string;
  onSettled?: () => void;
  /** 준비 중·실패 안내 문구. 생략하면 배포 구성도용 문구를 쓴다. */
  waitingText?: string;
  failedText?: string;
  /** step 곡선 흐름도에서 경유점 때문에 생긴 계단식 꺾임을 그린 뒤 줄인다. */
  straightenEdges?: boolean;
};

const scriptUrl = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/vendor/mermaid/mermaid.tiny-12.1.0.js`;
let rendering: Promise<unknown> = Promise.resolve();
let renderNumber = 0;

function mermaidApi() {
  return (window as Window & { mermaid?: Mermaid }).mermaid;
}

/**
 * 같은 스크립트를 쓰는 흐름도가 여럿이면, 먼저 마운트된 쪽이 내려받는 중에도 Next Script가
 * 나중 인스턴스에 onReady를 먼저 알린다. 그때는 엔진이 아직 없으므로 실제로 생길 때까지 기다린다.
 */
async function waitForMermaid(timeoutMs = 15_000) {
  const started = Date.now();
  let api = mermaidApi();
  while (!api) {
    if (Date.now() - started > timeoutMs) throw new Error('Mermaid did not initialize');
    await new Promise((resolve) => setTimeout(resolve, 50));
    api = mermaidApi();
  }
  return api;
}

function themeColor(value: string, fallback: string) {
  const color = value.trim();
  if (/^#[\da-f]{3,8}$/iu.test(color)) return color;
  const channels = color.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/iu);
  return channels
    ? `#${channels.slice(1, 4).map((channel) => Number(channel).toString(16).padStart(2, '0')).join('')}`
    : fallback;
}

/** Only fixed repository-authored source is rendered; never accept chat/user input. */
export default function MermaidDiagram({
  diagram, compactDiagram, title, description, className, onSettled,
  waitingText = '배포 구성도를 준비하고 있습니다.',
  failedText = '배포 구성도 대신 아래 설명을 확인해 주세요.',
  straightenEdges = false,
}: Props) {
  const figureRef = useRef<HTMLElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const captionId = useId();
  const descriptionId = useId();
  const [nearViewport, setNearViewport] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [status, setStatus] = useState<'waiting' | 'ready' | 'failed'>('waiting');

  // ready는 SVG와 placeholder 상태가 DOM에 반영된 뒤, failed는 대체 안내가 준비된 뒤 알린다.
  useEffect(() => {
    if (status !== 'waiting') onSettled?.();
  }, [onSettled, status]);

  useEffect(() => {
    const figure = figureRef.current;
    if (!figure) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: '240px' });
    observer.observe(figure);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!engineReady) return;
    let active = true;
    let revision = 0;
    let pendingStraighten: ResizeObserver | undefined;
    const compact = window.matchMedia('(max-width: 760px)');

    const draw = () => {
      const currentRevision = ++revision;
      // Mermaid's configuration is global: keep initialize + render together.
      rendering = rendering.catch(() => undefined).then(async () => {
        if (!active || currentRevision !== revision) return;
        await document.fonts.ready;
        const api = await waitForMermaid();
        if (!active || currentRevision !== revision) return;
        const css = getComputedStyle(document.documentElement);
        const text = themeColor(css.getPropertyValue('--text'), '#14161f');
        const surface = themeColor(css.getPropertyValue('--bg-elev-2'), '#f3f4fa');
        const background = themeColor(css.getPropertyValue('--bg-elev'), '#ffffff');
        const accent = themeColor(css.getPropertyValue('--accent'), '#4169e1');
        const muted = themeColor(css.getPropertyValue('--text-dim'), '#525872');
        api.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          suppressErrorRendering: true,
          theme: 'base',
          look: 'classic',
          fontFamily: 'Pretendard, Noto Sans KR, system-ui, sans-serif',
          htmlLabels: false,
          themeVariables: {
            darkMode: document.documentElement.dataset.theme === 'dark',
            fontSize: '14px',
            primaryColor: surface,
            primaryTextColor: text,
            primaryBorderColor: accent,
            lineColor: muted,
            secondaryColor: surface,
            tertiaryColor: background,
            clusterBkg: background,
            clusterBorder: accent,
            edgeLabelBackground: background,
            titleColor: text,
          },
          flowchart: {
            curve: 'linear',
            nodeSpacing: 20,
            rankSpacing: 28,
            padding: 12,
            subGraphTitleMargin: { top: 6, bottom: 12 },
          },
        });
        const source = compact.matches && compactDiagram ? compactDiagram : diagram;
        const { svg } = await api.render(`deployment-diagram-${++renderNumber}`, source);
        if (!active || currentRevision !== revision || !svgRef.current) return;
        // Mermaid's strict mode sanitizes its SVG output before it reaches here.
        svgRef.current.innerHTML = svg;
        const rendered = svgRef.current.querySelector('svg');
        if (rendered) {
          rendered.setAttribute('aria-hidden', 'true');
          rendered.setAttribute('focusable', 'false');
          const width = rendered.viewBox.baseVal.width;
          // Keep natural label sizes on desktop and fit narrow screens without scrolling.
          rendered.style.width = `${width}px`;
          rendered.style.maxWidth = '100%';
          pendingStraighten?.disconnect();
          pendingStraighten = undefined;
          if (straightenEdges && !straightenRenderedEdges(rendered)) {
            // 접힌 영역 안에서 다시 그려 크기를 잴 수 없으면, 보이게 될 때 한 번 편다.
            const observer = new ResizeObserver(() => {
              if (straightenRenderedEdges(rendered)) observer.disconnect();
            });
            observer.observe(rendered);
            pendingStraighten = observer;
          }
        }
        setStatus('ready');
      }).catch(() => {
        if (active && currentRevision === revision) setStatus('failed');
      });
    };
    draw();
    const themeObserver = new MutationObserver(draw);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });
    compact.addEventListener('change', draw);
    return () => {
      active = false;
      pendingStraighten?.disconnect();
      themeObserver.disconnect();
      compact.removeEventListener('change', draw);
    };
  }, [compactDiagram, diagram, engineReady, straightenEdges]);

  return (
    <figure ref={figureRef} className={[styles.figure, className].filter(Boolean).join(' ')}>
      <figcaption id={captionId} className={styles.caption}>{title}</figcaption>
      {nearViewport && (
        <Script
          src={scriptUrl}
          strategy="afterInteractive"
          onLoad={() => setEngineReady(true)}
          onReady={() => setEngineReady(true)}
          onError={() => setStatus('failed')}
        />
      )}
      <div className={styles.viewport} tabIndex={0} role="img" aria-labelledby={captionId} aria-describedby={descriptionId}>
        <div ref={svgRef} className={styles.svg} data-diagram-status={status} />
        {status !== 'ready' && (
          <p className={styles.placeholder} role="status">
            {status === 'failed' ? failedText : waitingText}
          </p>
        )}
      </div>
      <ul id={descriptionId} className={styles.description}>
        {description.split('\n').filter(line => line.trim()).map(line => <li key={line}>{line}</li>)}
      </ul>
    </figure>
  );
}
