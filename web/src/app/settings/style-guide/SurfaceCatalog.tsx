/**
 * 공통 표면 부품(components/surface)의 변형을 모두 실물로 늘어놓는 견본이다.
 *
 * 견본마다 부품에 넘긴 옵션 객체를 그대로 코드 조각으로 바꿔 보여 주므로, 화면의 모양과
 * 적힌 사용법이 어긋나지 않는다. Panel 견본은 점선 상자로 부품이 정한 안쪽 여백을 드러내고,
 * 여백이 없는 Card·Inset·Callout은 견본 쪽에서 여백을 더한다.
 */
import {
  Callout,
  Card,
  Inset,
  Panel,
  calloutClassName,
  cardClassName,
  insetClassName,
  panelClassName,
  type CalloutOptions,
  type CardOptions,
  type PanelOptions,
} from '@/components/surface/Surface';
import styles from './StyleGuide.module.css';

type SnippetOptions = Record<string, string | boolean | undefined>;

/** 옵션 객체를 `<Card tone="muted" featured>` 같은 JSX 조각으로 바꾼다. 빠진 옵션은 기본값이다. */
function snippet(name: string, options: SnippetOptions): string {
  const props = Object.entries(options).flatMap(([key, value]) => {
    if (value === undefined) return [];
    if (value === true) return [key];
    if (value === false) return [`${key}={false}`];
    return [`${key}="${value}"`];
  });
  return `<${[name, ...props].join(' ')}>`;
}

function Snippet({ children }: { children: string }) {
  return (
    <p className={styles.snippet}>
      <code>{children}</code>
    </p>
  );
}

type Specimen<T> = { options: T; note: string };

const PANEL_SPECIMENS: readonly Specimen<PanelOptions>[] = [
  { options: {}, note: 'padding="md"(기본값). 페이지 최상위 섹션의 보통 여백' },
  { options: { padding: 'lg' }, note: '위아래를 더 넉넉히 두는 여백' },
  { options: { padding: 'none' }, note: '여백 없음. 안쪽 배치를 직접 짤 때' },
  { options: { tone: 'fill' }, note: '옅은 그라디언트 바탕. 마무리 안내처럼 쓴다' },
];

const CARD_SPECIMENS: readonly Specimen<CardOptions>[] = [
  { options: {}, note: 'tone="elev"(기본값). 떠 있는 카드' },
  { options: { tone: 'muted' }, note: '옅은 바탕(--bg-elev-2)' },
  { options: { tone: 'base' }, note: '페이지 바탕과 같은 색(--bg)' },
  { options: { raised: true }, note: '그림자를 둔다' },
  { options: { featured: true }, note: '시즌 테마의 위 가장자리 띠. 눈에 띄는 카드에만' },
  { options: { tone: 'muted', featured: true }, note: '옵션은 함께 쓸 수 있다' },
];

const INSET_SPECIMENS: readonly Specimen<{ dashed?: boolean }>[] = [
  { options: {}, note: '카드 안쪽의 작은 상자. 옅은 바탕' },
  { options: { dashed: true }, note: '점선 테두리. 보충 설명 등' },
];

const CALLOUT_SPECIMENS: readonly Specimen<CalloutOptions>[] = [
  { options: {}, note: 'tone="elev"(기본값), 바깥 테두리 켬' },
  { options: { tone: 'soft' }, note: '옅은 장식 강조색 바탕' },
  { options: { bordered: false }, note: '바깥 테두리 없이 막대만' },
  { options: { tone: 'soft', bordered: false }, note: '옅은 바탕 + 막대만' },
];

function GroupHead({ name, meta, children }: { name: string; meta: string; children: string }) {
  return (
    <>
      <div className={styles.groupHead}>
        <h3 className={styles.groupName}>{name}</h3>
        <span className={styles.groupMeta}>{meta}</span>
      </div>
      <p className={styles.groupText}>{children}</p>
    </>
  );
}

export default function SurfaceCatalog() {
  return (
    <>
      <div className={styles.group}>
        <GroupHead name="모서리 규칙" meta="Surface.module.css">
          모서리는 세 가지로 통일한다. 테두리·바탕·그림자는 전역 토큰만 쓰고, 시즌 테마는 이 부품의 클래스와
          --decor-accent* 토큰으로만 닿는다.
        </GroupHead>
        <ul className={styles.radiusRule}>
          <li>Panel 24</li>
          <li>Card 16</li>
          <li>Inset 12</li>
          <li>Callout 12</li>
        </ul>
      </div>

      <div className={styles.group}>
        <GroupHead name="Panel" meta="padding none·md·lg / tone default·fill">
          페이지 최상위 섹션이다. 기본 요소는 section이고, 그림자를 둔다. 점선 상자가 내용 영역이다.
        </GroupHead>
        <div className={styles.specimenGrid}>
          {PANEL_SPECIMENS.map(({ options, note }) => (
            <div key={snippet('Panel', options)} className={styles.specimen}>
              <Panel as="div" {...options} className={styles.panelSpecimen}>
                <div className={styles.paddingProbe}>
                  <p className={styles.specimenNote}>{note}</p>
                </div>
              </Panel>
              <Snippet>{snippet('Panel', options)}</Snippet>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <GroupHead name="Card" meta="tone elev·muted·base / raised / featured">
          목록·격자에서 반복되는 항목이다. 안쪽 여백은 쓰는 쪽이 정한다.
        </GroupHead>
        <div className={styles.specimenGrid}>
          {CARD_SPECIMENS.map(({ options, note }) => (
            <div key={snippet('Card', options)} className={styles.specimen}>
              <Card {...options} className={styles.specimenBox}>
                <p className={styles.specimenNote}>{note}</p>
              </Card>
              <Snippet>{snippet('Card', options)}</Snippet>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <GroupHead name="Inset" meta="dashed">
          카드 안쪽에 들어가는 작은 상자다.
        </GroupHead>
        <div className={styles.specimenGrid}>
          {INSET_SPECIMENS.map(({ options, note }) => (
            <div key={snippet('Inset', options)} className={styles.specimen}>
              <Inset {...options} className={styles.specimenBox}>
                <p className={styles.specimenNote}>{note}</p>
              </Inset>
              <Snippet>{snippet('Inset', options)}</Snippet>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <GroupHead name="Callout" meta="tone elev·soft / bordered">
          왼쪽 강조 막대가 있는 안내·인용 상자다. 막대 색은 장식 강조색(--decor-accent)이다.
        </GroupHead>
        <div className={styles.specimenGrid}>
          {CALLOUT_SPECIMENS.map(({ options, note }) => (
            <div key={snippet('Callout', options)} className={styles.specimen}>
              <Callout {...options} className={styles.specimenBox}>
                <p className={styles.specimenNote}>{note}</p>
              </Callout>
              <Snippet>{snippet('Callout', options)}</Snippet>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <GroupHead name="클래스 이름 도우미" meta="panelClassName · cardClassName · insetClassName · calloutClassName">
          요소를 직접 그려야 하는 곳(목록 항목, Link, 다른 부품의 루트 등)은 같은 모양을 클래스 이름으로 받는다.
          둘째 인자로 더할 클래스를 넘긴다. 아래 목록 항목(li)이 각 도우미로 그린 실물이다.
        </GroupHead>
        <ul className={styles.helperList}>
          <li className={panelClassName({}, styles.helperPanel)}>
            <Snippet>{'panelClassName({ padding, tone }, extra)'}</Snippet>
            <p className={styles.specimenNote}>Panel과 같은 모양</p>
          </li>
          <li className={cardClassName({ tone: 'muted' }, styles.helperItem)}>
            <Snippet>{"cardClassName({ tone: 'muted' }, extra)"}</Snippet>
            <p className={styles.specimenNote}>Card와 같은 모양(tone·raised·featured)</p>
          </li>
          <li className={insetClassName({ dashed: true }, styles.helperItem)}>
            <Snippet>{'insetClassName({ dashed: true }, extra)'}</Snippet>
            <p className={styles.specimenNote}>Inset과 같은 모양</p>
          </li>
          <li className={calloutClassName({ tone: 'soft' }, styles.helperItem)}>
            <Snippet>{"calloutClassName({ tone: 'soft' }, extra)"}</Snippet>
            <p className={styles.specimenNote}>Callout과 같은 모양(tone·bordered)</p>
          </li>
        </ul>
      </div>
    </>
  );
}
