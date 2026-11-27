/**
 * 시즌 테마마다 소개 화면을 줄여 그린 미리보기 격자다(스타일 가이드의 테마 미리보기 절).
 *
 * 칸마다 바깥 상자에 `data-season`을 달아 그 칸의 테마를 고른다. 시즌 효과(색 토큰·리본 띠·
 * 안내 상자 막대·장식 겹·버튼 무늬)는 가장 가까운 조상의 data-season을 따르므로, 사이트 전체
 * 테마(`<html data-season>`)나 저장된 선택(data-season-theme·localStorage)은 건드리지 않고
 * 칸 안만 그 테마로 그려진다. 눈 내리기 캔버스는 칸에 두지 않는다.
 *
 * 견본은 실제 소개 화면 크기로 짠 뒤 CSS zoom으로 줄인다(StyleGuide.module.css의 .mock).
 * 장식 그림 크기가 실제 소개 카드에 맞춰져 있어 작은 크기로 다시 짜면 비율이 달라지기 때문이다.
 * 순수 미리보기라 스크린 리더에서는 빼고(버튼도 누를 수 없는 span), 칸 이름은 figcaption이 알린다.
 * 칸 이름 옆 단추(ApplySeasonButton)로 그 테마를 사이트 전체에 바로 적용하거나 끌 수 있다.
 */
import AboutDecorativeGrid from '@/components/layout/AboutDecorativeGrid';
import { Callout, Card, Panel, cardClassName } from '@/components/surface/Surface';
import SeasonDecoration from '@/features/seasonal/SeasonDecoration';
import { SEASON_NONE, SEASON_THEMES } from '@/features/seasonal/seasonPolicy';
import { ApplySeasonButton } from './SiteSeasonControls';
import styles from './StyleGuide.module.css';

/** 미리보기 칸 목록이다. 기준이 되는 꾸밈 없음을 먼저 두고 등록표 순서를 따른다. */
const PREVIEW_THEMES: readonly { id: string; label: string; description: string }[] = [
  { id: SEASON_NONE, label: '꾸밈 없음', description: '장식 없이 기본 화면' },
  ...SEASON_THEMES.map(({ id, label, description }) => ({ id, label, description })),
];

/** 소개 화면을 줄인 견본이다. 소개 패널·눈에 띄는 카드·안내 상자·버튼 두 개로 짠다. */
function OverviewMock() {
  return (
    <div className={styles.mock} aria-hidden="true">
      <Panel as="div" padding="none" className={styles.mockHero}>
        <AboutDecorativeGrid />
        <SeasonDecoration slot="intro" />
        <div className={styles.mockHeroBody}>
          <p className={styles.mockEyebrow}>Overview</p>
          <p className={styles.mockTitle}>안녕하세요, 소개 화면입니다.</p>
          <p className={styles.mockText}>
            패널 장식과 위 가장자리 띠, 장식 강조색이 이 테마에서 어떻게 보이는지 줄여서 보여 줍니다.
          </p>
        </div>
      </Panel>
      <div className={styles.mockRow}>
        <Card raised featured className={styles.mockCard}>
          <SeasonDecoration slot="card" />
          <p className={styles.mockEyebrow}>Featured</p>
          <p className={styles.mockCardTitle}>눈에 띄는 카드</p>
          <p className={styles.mockSmall}>위 가장자리 띠와 모서리 장식</p>
        </Card>
        <Callout tone="soft" className={styles.mockCallout}>
          <p className={styles.mockCardTitle}>안내 상자</p>
          <p className={styles.mockSmall}>왼쪽 막대는 장식 강조색</p>
        </Callout>
      </div>
      <div className={styles.mockActions}>
        <span className={`hover-btn-primary ${styles.mockPrimary}`}>주요 버튼</span>
        <span className={`hover-btn-secondary ${styles.mockSecondary}`}>보조 버튼</span>
      </div>
    </div>
  );
}

export default function ThemePreviewGrid() {
  return (
    <div className={styles.themeGrid}>
      {PREVIEW_THEMES.map((theme) => (
        <figure key={theme.id} className={styles.themeTile}>
          <div data-season={theme.id} className={cardClassName({ tone: 'base' }, styles.themeStage)}>
            <OverviewMock />
          </div>
          <figcaption className={styles.themeCaption}>
            <span className={styles.themeName}>{theme.label}</span>
            <code className={styles.themeId}>{theme.id}</code>
            <ApplySeasonButton themeId={theme.id} label={theme.label} />
            <span className={styles.themeNote}>{theme.description}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
