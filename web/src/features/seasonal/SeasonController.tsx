'use client';

/**
 * 시즌 테마와 계절 효과 설정의 `<html>` 속성을
 * 첫 페인트 뒤에도 맞게 유지한다.
 *
 * 첫 판정은 부트 스크립트가 한다. 이 구성 요소는 그 뒤의 변화만 맡는다.
 * - 한국 시간 자정마다 한 번 다시 판정한다(자동 테마는 날짜가 바뀔 때만 달라진다).
 * - 탭으로 돌아왔을 때 다시 판정한다(잠자기·오래 둔 탭).
 * - 다른 탭에서 선택을 바꾸면(storage 이벤트) 따라 바꾼다.
 * 주소 쿼리(`?season=`·`?snow=`)로 들어와 탭 저장소(sessionStorage)에 덮어쓴 값이 있으면 그 값이 먼저다.
 * 화면에 그리는 것은 없다.
 */
import { useEffect } from 'react';
import {
  SEASON_SNOW_AMOUNT_STORAGE_KEY,
  SEASON_SNOW_BEHIND_CARDS_STORAGE_KEY,
  SEASON_SNOW_STORAGE_KEY,
  SEASON_THEME_STORAGE_KEY,
  nextKstMidnight,
  normalizeSeasonSnow,
  normalizeSeasonSnowAmount,
  normalizeSeasonSnowBehindCards,
  normalizeSeasonThemePreference,
  resolveSeasonTheme,
  type SeasonSnowAmount,
  type SeasonThemePreference,
} from './seasonPolicy';
import { normalizeSeasonWeatherEnabled, SEASON_WEATHER_EFFECTS, SEASON_WEATHER_IDS, type SeasonWeatherId } from './seasonWeatherPolicy';

/** 설정 화면이 선택 변화를 듣는 창 이벤트 이름이다. */
export const SEASON_CHANGE_EVENT = 'ssw:season-change';

/** setTimeout이 받는 최대 지연(약 24.8일)이다. 넘으면 즉시 실행되므로 자른다. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/** 탭 저장소의 쿼리 덮어쓰기를 먼저 보고, 없으면 저장된 설정을 읽는다. */
function readStorage(key: string): string | null {
  try {
    const override = window.sessionStorage.getItem(key);
    if (override !== null) return override;
  } catch {
    // 탭 저장소가 막혀 있으면 저장된 설정만 본다.
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** 직접 고른 값은 저장하고, 같은 키의 쿼리 덮어쓰기는 지운다(고른 값이 바로 보이도록). */
function writeStorage(key: string, value: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // 탭 저장소가 막혀 있으면 덮어쓰기도 없다.
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 저장소가 막힌 환경에서도 지금 화면은 바뀌어야 한다.
  }
}

/**
 * 시즌 설정이 담기는 저장 키 전체다. 다른 탭의 변경 감지와 설정 초기화가 같은 목록을 쓴다.
 * 시즌 설정을 더하면 이 목록에도 넣어야 초기화와 탭 동기화에서 빠지지 않는다.
 */
const SEASON_SETTING_STORAGE_KEYS: readonly string[] = [
  SEASON_THEME_STORAGE_KEY,
  SEASON_SNOW_STORAGE_KEY,
  SEASON_SNOW_AMOUNT_STORAGE_KEY,
  SEASON_SNOW_BEHIND_CARDS_STORAGE_KEY,
  ...SEASON_WEATHER_IDS.map((id) => SEASON_WEATHER_EFFECTS[id].storage),
];

/** 저장된 선택과 같은 키의 쿼리 덮어쓰기를 함께 지운다. 읽을 때 기본값으로 접힌다. */
function removeStorage(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // 탭 저장소가 막혀 있으면 덮어쓰기도 없다.
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    // 저장소가 막힌 환경에서도 지금 화면은 바뀌어야 한다.
  }
}

/** 저장된 선택으로 문서 루트의 속성을 바른다. */
function applySeason(): void {
  const dataset = document.documentElement.dataset;
  const preference = normalizeSeasonThemePreference(readStorage(SEASON_THEME_STORAGE_KEY));
  dataset.seasonTheme = preference;
  dataset.season = resolveSeasonTheme(preference, Date.now());
  dataset.seasonSnow = String(normalizeSeasonSnow(readStorage(SEASON_SNOW_STORAGE_KEY)));
  dataset.seasonSnowAmount = normalizeSeasonSnowAmount(readStorage(SEASON_SNOW_AMOUNT_STORAGE_KEY));
  dataset.seasonSnowBehindCards = String(normalizeSeasonSnowBehindCards(readStorage(SEASON_SNOW_BEHIND_CARDS_STORAGE_KEY)));
  for (const id of SEASON_WEATHER_IDS) {
    const effect = SEASON_WEATHER_EFFECTS[id];
    dataset[effect.dataset] = String(normalizeSeasonWeatherEnabled(readStorage(effect.storage)));
  }
  window.dispatchEvent(new Event(SEASON_CHANGE_EVENT));
}

/** 설정 화면에서 테마를 고를 때 쓴다. */
export function setSeasonThemePreference(preference: SeasonThemePreference): void {
  writeStorage(SEASON_THEME_STORAGE_KEY, preference);
  applySeason();
}

/** 설정 화면에서 눈 내리기를 켜고 끌 때 쓴다. */
export function setSeasonSnow(enabled: boolean): void {
  writeStorage(SEASON_SNOW_STORAGE_KEY, String(enabled));
  applySeason();
}

export function setSeasonWeather(effect: SeasonWeatherId, enabled: boolean): void {
  writeStorage(SEASON_WEATHER_EFFECTS[effect].storage, String(enabled));
  applySeason();
}

/** 계절 효과 공통 양이다. 기존 눈 설정의 저장 키를 유지한다. */
export function setSeasonSnowAmount(amount: SeasonSnowAmount): void {
  writeStorage(SEASON_SNOW_AMOUNT_STORAGE_KEY, amount);
  applySeason();
}

export function setSeasonSnowBehindCards(enabled: boolean): void {
  writeStorage(SEASON_SNOW_BEHIND_CARDS_STORAGE_KEY, String(enabled));
  applySeason();
}

/** 설정 초기화에서 쓴다. 시즌 테마와 계절 효과 설정을 모두 기본값으로 되돌린다. */
export function resetSeasonSettings(): void {
  for (const key of SEASON_SETTING_STORAGE_KEYS) removeStorage(key);
  applySeason();
}

export default function SeasonController() {
  useEffect(() => {
    let timer: number | null = null;

    const refresh = () => {
      applySeason();
      if (timer !== null) window.clearTimeout(timer);
      const now = Date.now();
      // 자정을 살짝 넘긴 뒤 판정해 경계 바로 앞에서 깨는 일을 피한다.
      timer = window.setTimeout(refresh, Math.min(nextKstMidnight(now) - now + 1000, MAX_TIMEOUT_MS));
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    const onStorage = (event: StorageEvent) => {
      // key가 null이면 다른 탭이 저장소를 통째로 비운 것이다.
      if (event.key === null || SEASON_SETTING_STORAGE_KEYS.includes(event.key)) refresh();
    };

    refresh();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return null;
}
