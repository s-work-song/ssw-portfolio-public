/**
 * 시즌 테마 장식이다. 자리(slot)마다 테마별 그림을 한 겹씩 두고,
 * `<html data-season>`과 같은 테마의 겹만 CSS가 보이게 한다.
 *
 * 모든 테마의 그림이 늘 마크업에 있고 CSS가 고르므로, 부트 스크립트가 첫 페인트 전에
 * 속성을 심으면 하이드레이션을 기다리지 않고 맞는 장식이 바로 보인다(늦게 끼어들며
 * 레이아웃이 밀리지 않는다). 순수 장식이라 스크린 리더·클릭·키보드에서 빠지고,
 * 움직이지 않으므로 모션 설정과 얽히지 않는다(눈 내리기는 `SnowLayer`가 따로 맡는다).
 *
 * 테마를 더하려면 seasonPolicy의 SEASON_THEMES에 한 줄, 아래 `ART`에 자리별 그림,
 * CSS의 보임 규칙과 색 토큰을 더한다.
 */
import type { ReactNode } from 'react';
import { SEASON_THEMES, type SeasonThemeId } from './seasonPolicy';
import {
  BlossomBranch, Blossom, FirTree, Garland, Icicles, MapleLeaf, Snowflake, Star, Stocking, Sun, Waves,
} from './SeasonArt';
import styles from './SeasonDecoration.module.css';

/** 장식을 붙이는 자리다. 자리마다 크기와 구성이 다르다. */
export type SeasonDecorationSlot = 'header' | 'intro' | 'card' | 'panel';

/** 테마별·자리별 그림이다. */
const ART: Record<SeasonThemeId, Record<SeasonDecorationSlot, ReactNode>> = {
  christmas: {
    header: <Stocking className={styles.headerIcon} />,
    intro: (
      <>
        <Garland className={styles.introTopBand} />
        <FirTree className={styles.introCornerArt} />
      </>
    ),
    card: (
      <>
        <Garland className={styles.cardBand} swags={2} width={200} />
        <Star className={styles.cardIcon} />
      </>
    ),
    panel: <Star className={styles.panelIcon} />,
  },
  winter: {
    header: <Snowflake className={styles.headerIcon} />,
    intro: (
      <>
        <Icicles className={styles.introTopBand} />
        <Snowflake className={styles.introCornerArt} />
        <Snowflake className={styles.introCornerArtSmall} />
      </>
    ),
    card: (
      <>
        <Icicles className={styles.cardBand} width={160} />
        <Snowflake className={styles.cardIcon} />
      </>
    ),
    panel: <Snowflake className={styles.panelIcon} />,
  },
  spring: {
    header: <Blossom className={styles.headerIcon} />,
    intro: (
      <>
        <BlossomBranch className={styles.introTopRight} />
        <Blossom className={styles.introCornerArtSmall} />
      </>
    ),
    card: <BlossomBranch className={styles.cardBranch} />,
    panel: <Blossom className={styles.panelIcon} />,
  },
  summer: {
    header: <Sun className={styles.headerIcon} />,
    intro: (
      <>
        <Sun className={styles.introSun} />
        <Waves className={styles.introBottomBand} />
      </>
    ),
    card: (
      <>
        <Waves className={styles.cardWaves} width={240} />
        <Sun className={styles.cardIcon} />
      </>
    ),
    panel: <Sun className={styles.panelIcon} />,
  },
  autumn: {
    header: <MapleLeaf className={styles.headerIcon} />,
    intro: (
      <>
        <MapleLeaf className={styles.leafLarge} tone="red" />
        <MapleLeaf className={styles.leafMedium} tone="orange" />
        <MapleLeaf className={styles.leafSmall} tone="yellow" />
        <MapleLeaf className={styles.leafFallA} tone="orange" />
        <MapleLeaf className={styles.leafFallB} tone="red" />
      </>
    ),
    card: (
      <>
        <MapleLeaf className={styles.cardIcon} tone="orange" />
        <MapleLeaf className={styles.cardIcon} tone="red" />
      </>
    ),
    panel: <MapleLeaf className={styles.panelIcon} tone="red" />,
  },
};

export default function SeasonDecoration({ slot }: { slot: SeasonDecorationSlot }) {
  return (
    <span aria-hidden="true" className={`${styles.slot} ${styles[slot]}`} data-season-slot={slot}>
      {SEASON_THEMES.map((theme) => (
        <span key={theme.id} className={styles.layer} data-season-layer={theme.id}>
          {ART[theme.id][slot]}
        </span>
      ))}
    </span>
  );
}
