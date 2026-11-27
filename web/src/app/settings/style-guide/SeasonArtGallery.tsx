/**
 * 시즌 장식 그림(features/seasonal/SeasonArt)의 SVG 조각을 이름과 함께 늘어놓는 견본이다.
 *
 * 그림은 자리(slot) 없이 직접 그리므로 지금 시즌 테마와 관계없이 늘 보인다. 색은 그림 쪽 클래스가
 * --season-* 토큰으로 칠해 라이트·다크를 따르고, 크기만 이 화면의 클래스로 정한다.
 */
import type { ReactNode } from 'react';
import { Inset } from '@/components/surface/Surface';
import {
  Blossom,
  BlossomBranch,
  FirTree,
  Garland,
  Icicles,
  MapleLeaf,
  SantaSleigh,
  Snowflake,
  Star,
  Stocking,
  Sun,
  Waves,
} from '@/features/seasonal/SeasonArt';
import styles from './StyleGuide.module.css';

const ART_PIECES: readonly { name: string; note: string; art: ReactNode }[] = [
  { name: 'Star', note: '크리스마스 카드·패널 모서리', art: <Star className={styles.artIcon} /> },
  { name: 'Stocking', note: '크리스마스 머리글 제목 옆', art: <Stocking className={styles.artIcon} /> },
  { name: 'Snowflake', note: '겨울', art: <Snowflake className={styles.artIcon} /> },
  { name: 'Blossom', note: '봄', art: <Blossom className={styles.artIcon} /> },
  { name: 'Sun', note: '여름', art: <Sun className={styles.artIcon} /> },
  {
    name: 'MapleLeaf',
    note: '가을. tone="red"·"orange"·"yellow"',
    art: (
      <>
        <MapleLeaf className={styles.artSmallIcon} tone="red" />
        <MapleLeaf className={styles.artSmallIcon} tone="orange" />
        <MapleLeaf className={styles.artSmallIcon} tone="yellow" />
      </>
    ),
  },
  { name: 'Garland', note: '크리스마스 위 가장자리 띠. swags·width', art: <Garland className={styles.artBand} swags={2} width={200} /> },
  { name: 'FirTree', note: '크리스마스 소개 카드 모서리', art: <FirTree className={styles.artTree} /> },
  {
    name: 'SantaSleigh',
    note: '크리스마스 본문 뒤를 지나가는 썰매(SleighLayer). 배경에서는 옅게',
    art: <SantaSleigh className={styles.artBand} />,
  },
  { name: 'Icicles', note: '겨울 위 가장자리 띠. width', art: <Icicles className={styles.artBand} width={160} /> },
  { name: 'BlossomBranch', note: '봄 모서리 가지', art: <BlossomBranch className={styles.artBand} /> },
  { name: 'Waves', note: '여름 아래 가장자리 물결. width', art: <Waves className={styles.artWaves} width={240} /> },
];

export default function SeasonArtGallery() {
  return (
    <div className={styles.artGrid}>
      {ART_PIECES.map((piece) => (
        <figure key={piece.name} className={styles.artItem}>
          <Inset className={styles.artStage} aria-hidden="true">
            {piece.art}
          </Inset>
          <figcaption className={styles.artCaption}>
            <span className={styles.artName}>
              <code>{piece.name}</code>
            </span>
            <span className={styles.artNote}>{piece.note}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
