/**
 * 사이트의 카드·패널 표면을 그리는 공통 부품이다.
 *
 * 페이지마다 인라인 스타일과 모듈 CSS로 제각각 그리던 상자를 네 가지 역할로 묶는다.
 * - Panel: 페이지 최상위 섹션(모서리 24, 그림자)
 * - Card: 목록·격자에서 반복되는 항목(모서리 16)
 * - Inset: 카드 안쪽에 들어가는 작은 상자(모서리 12, 옅은 바탕)
 * - Callout: 왼쪽 강조 막대가 있는 안내·인용 상자(모서리 12)
 *
 * 모양(모서리·테두리·바탕·그림자)은 이 부품이 정하고, 배치(여백 일부·flex·gap 등)는
 * 쓰는 쪽이 className이나 style로 더한다. 시즌 테마(features/seasonal)는 이 부품의
 * 클래스와 `--decor-accent*` 토큰에만 연결하므로, 새 표면도 이 부품을 쓰면 테마가 따라온다.
 *
 * 요소를 직접 그려야 하는 곳(스타일 객체를 펼쳐 쓰는 목록 항목, 다른 부품의 루트 등)은
 * 같은 모양을 `panelClassName`·`cardClassName`·`insetClassName`·`calloutClassName`으로 받는다.
 *
 * 서버 컴포넌트에서도 쓸 수 있도록 상태나 효과를 두지 않는다.
 */
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import styles from './Surface.module.css';

type SurfaceTag = 'section' | 'article' | 'aside' | 'div' | 'li' | 'blockquote' | 'figure';

type BaseProps = {
  /** 그릴 HTML 요소다. 의미에 맞게 고른다(기본: Panel은 section, 나머지는 div). */
  as?: SurfaceTag;
  children?: ReactNode;
  className?: string;
  /** 둘러보기(guided tour)가 가리키는 대상 이름이다. */
  guidedTourTarget?: string;
} & Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'className'>;

function join(...names: (string | false | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}

function Surface({
  as,
  fallback,
  className,
  guidedTourTarget,
  children,
  ...rest
}: BaseProps & { fallback: SurfaceTag }) {
  const Tag = (as ?? fallback) as ElementType;
  return (
    <Tag className={className} data-guided-tour-target={guidedTourTarget} {...rest}>
      {children}
    </Tag>
  );
}

export type PanelPadding = 'none' | 'md' | 'lg';
export type PanelTone = 'default' | 'fill';
export type PanelOptions = { padding?: PanelPadding; tone?: PanelTone };

/** Panel과 같은 모양의 클래스 이름이다. */
export function panelClassName({ padding = 'md', tone = 'default' }: PanelOptions = {}, extra?: string): string {
  return join(styles.panel, styles[`pad-${padding}`], tone === 'fill' && styles.fill, extra);
}

/**
 * 페이지 최상위 섹션이다.
 * padding: md = clamp(20px, 5vw, 36px), lg = 위아래 clamp(26px, 5vw, 40px)·좌우 clamp(18px, 4vw, 32px).
 * tone: fill은 마무리 안내처럼 옅은 그라디언트 바탕을 쓴다.
 */
export function Panel({ padding, tone, className, ...rest }: BaseProps & PanelOptions) {
  return (
    <Surface
      fallback="section"
      className={panelClassName({ padding, tone }, className)}
      data-surface="panel"
      {...rest}
    />
  );
}

export type CardTone = 'elev' | 'muted' | 'base';
export type CardOptions = { tone?: CardTone; raised?: boolean; featured?: boolean };

/** Card와 같은 모양의 클래스 이름이다. */
export function cardClassName({ tone = 'elev', raised = false, featured = false }: CardOptions = {}, extra?: string): string {
  return join(styles.card, styles[`card-${tone}`], raised && styles.raised, featured && styles.featured, extra);
}

/**
 * 목록·격자에서 반복되는 항목이다.
 * tone: elev = 떠 있는 카드(--bg-elev), muted = 옅은 바탕(--bg-elev-2), base = 페이지 바탕(--bg).
 * raised: 그림자를 둔다. featured: 시즌 테마의 위 가장자리 띠를 단다(눈에 띄는 카드에만).
 */
export function Card({ tone, raised, featured, className, ...rest }: BaseProps & CardOptions) {
  return (
    <Surface
      fallback="div"
      className={cardClassName({ tone, raised, featured }, className)}
      data-surface="card"
      {...rest}
    />
  );
}

/** Inset과 같은 모양의 클래스 이름이다. */
export function insetClassName({ dashed = false }: { dashed?: boolean } = {}, extra?: string): string {
  return join(styles.inset, dashed && styles.dashed, extra);
}

/** 카드 안쪽에 들어가는 작은 상자다. dashed: 점선 테두리(보충 설명 등). */
export function Inset({ dashed, className, ...rest }: BaseProps & { dashed?: boolean }) {
  return (
    <Surface
      fallback="div"
      className={insetClassName({ dashed }, className)}
      data-surface="inset"
      {...rest}
    />
  );
}

export type CalloutTone = 'elev' | 'soft';
export type CalloutOptions = { tone?: CalloutTone; bordered?: boolean };

/** Callout과 같은 모양의 클래스 이름이다. */
export function calloutClassName({ tone = 'elev', bordered = true }: CalloutOptions = {}, extra?: string): string {
  return join(styles.callout, styles[`callout-${tone}`], !bordered && styles.barOnly, extra);
}

/**
 * 왼쪽 강조 막대가 있는 안내·인용 상자다. 막대 색은 장식 강조색(--decor-accent)이다.
 * tone: elev = 떠 있는 바탕, soft = 옅은 장식 강조색 바탕.
 * bordered: 바깥 테두리를 함께 그린다(기본 켬). 끄면 막대만 남는다.
 */
export function Callout({ tone, bordered, className, ...rest }: BaseProps & CalloutOptions) {
  return (
    <Surface
      fallback="div"
      className={calloutClassName({ tone, bordered }, className)}
      data-surface="callout"
      {...rest}
    />
  );
}
