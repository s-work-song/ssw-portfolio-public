'use client';

/**
 * 스타일 가이드에서 사이트 전체의 시즌 테마와 눈 내리기를 바로 바꾸는 단추들이다.
 *
 * 사이트 테마가 켜져 있으면 이 화면 자체도 장식·금빛 테두리·눈에 덮여 견본을 보기 어려우므로,
 * 설정 화면까지 가지 않고 여기서 끄거나 바꿀 수 있게 한다. 값은 설정 화면과 같은 곳
 * (SeasonController의 setSeasonThemePreference·setSeasonSnow, localStorage)에 저장되므로
 * 설정 화면의 선택과 늘 같다. `ApplySeasonButton`은 미리보기 칸마다 붙는 "이 테마 적용" 단추다.
 */
import { setSeasonSnow, setSeasonThemePreference } from '@/features/seasonal/SeasonController';
import { SEASON_NONE, SEASON_THEMES, type SeasonThemePreference } from '@/features/seasonal/seasonPolicy';
import { useSeasonSnow, useSeasonThemePreference } from '@/features/seasonal/useSeasonSettings';
import styles from './StyleGuide.module.css';

/** 상단 단추 목록이다. 설정 화면과 같은 순서(자동·끔 뒤에 등록표 순서)다. */
const OPTIONS: readonly { value: SeasonThemePreference; label: string }[] = [
  { value: 'auto', label: '자동' },
  { value: 'off', label: '끔' },
  ...SEASON_THEMES.map(({ id, label }) => ({ value: id, label })),
];

export default function SiteSeasonControls() {
  const preference = useSeasonThemePreference();
  const snow = useSeasonSnow();

  return (
    <div className={styles.siteControls}>
      <div className={styles.siteControlsHead}>
        <span className={styles.siteControlsLabel}>사이트 테마</span>
        <span className={styles.siteControlsNote}>설정에 저장되며 사이트 전체에 적용됩니다.</span>
      </div>
      <div role="radiogroup" aria-label="사이트 시즌 테마" className={styles.siteChips}>
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={preference === option.value}
            className={styles.siteChip}
            onClick={() => setSeasonThemePreference(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className={`${styles.siteChips} ${styles.siteSnowActions}`}>
        <button
          type="button"
          role="switch"
          aria-checked={snow}
          className={`${styles.siteChip} ${styles.siteSnow}`}
          onClick={() => setSeasonSnow(!snow)}
        >
          눈 {snow ? '켬' : '끔'}
        </button>
        <a className={styles.snowPreviewLink} href="#particle-preview">눈·계절 효과 미리보기 ↓</a>
      </div>
      <p className={styles.siteSnowNote}>사이트의 눈은 겨울·크리스마스 테마에서만 내립니다. 아래 미리보기는 별도로 재생됩니다.</p>
    </div>
  );
}

/**
 * 미리보기 칸의 테마를 사이트에 바로 적용하는 단추다.
 * "꾸밈 없음" 칸(SEASON_NONE)은 테마 끄기(off)로 적용한다. 이미 그 선택이면 눌린 상태로 보인다.
 */
export function ApplySeasonButton({ themeId, label }: { themeId: string; label: string }) {
  const preference = useSeasonThemePreference();
  const value = (themeId === SEASON_NONE ? 'off' : themeId) as SeasonThemePreference;
  const active = preference === value;
  const text = themeId === SEASON_NONE ? '테마 끄기' : '사이트에 적용';

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${label}: ${text}`}
      className={styles.applyButton}
      onClick={() => setSeasonThemePreference(value)}
    >
      {active ? '적용 중' : text}
    </button>
  );
}
