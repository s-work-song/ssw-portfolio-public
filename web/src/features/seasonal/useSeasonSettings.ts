'use client';

/**
 * 시즌 테마와 눈 내리기 설정의 현재 값을 구독하는 훅이다.
 *
 * 값의 출처는 부트 스크립트와 SeasonController가 심는 `<html>`의 data 속성이다.
 * 같은 탭에서 설정을 바꾸든 다른 탭의 storage 변경이든 SeasonController가 SEASON_CHANGE_EVENT를
 * 내므로, 그 이벤트만 들으면 설정 화면과 스타일 가이드가 같은 값을 본다. 서버 렌더에서는 기본값이다.
 */
import { useSyncExternalStore } from 'react';
import { SEASON_CHANGE_EVENT } from './SeasonController';
import {
  DEFAULT_SEASON_SNOW,
  DEFAULT_SEASON_SNOW_AMOUNT,
  DEFAULT_SEASON_SNOW_BEHIND_CARDS,
  DEFAULT_SEASON_THEME_PREFERENCE,
  normalizeSeasonSnow,
  normalizeSeasonSnowAmount,
  normalizeSeasonSnowBehindCards,
  normalizeSeasonThemePreference,
  SEASON_NONE,
  type SeasonSnowAmount,
  type SeasonThemePreference,
} from './seasonPolicy';
import { DEFAULT_SEASON_WEATHER_ENABLED, normalizeSeasonWeatherEnabled, SEASON_WEATHER_EFFECTS, type SeasonWeatherId } from './seasonWeatherPolicy';

function subscribeSeason(onChange: () => void): () => void {
  window.addEventListener(SEASON_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(SEASON_CHANGE_EVENT, onChange);
}

function seasonThemeSnapshot(): SeasonThemePreference {
  return normalizeSeasonThemePreference(document.documentElement.dataset.seasonTheme);
}

function seasonSnowSnapshot(): boolean {
  return normalizeSeasonSnow(document.documentElement.dataset.seasonSnow);
}

function seasonSnowAmountSnapshot(): SeasonSnowAmount {
  return normalizeSeasonSnowAmount(document.documentElement.dataset.seasonSnowAmount);
}

function seasonSnowBehindCardsSnapshot(): boolean {
  return normalizeSeasonSnowBehindCards(document.documentElement.dataset.seasonSnowBehindCards);
}

/** 지금 고른 시즌 테마(자동·끔·테마 이름)다. */
export function useSeasonThemePreference(): SeasonThemePreference {
  return useSyncExternalStore(subscribeSeason, seasonThemeSnapshot, () => DEFAULT_SEASON_THEME_PREFERENCE);
}

/** 눈 내리기를 켰는지다. */
export function useSeasonSnow(): boolean {
  return useSyncExternalStore(subscribeSeason, seasonSnowSnapshot, () => DEFAULT_SEASON_SNOW);
}

/** 효과별 켜기/끄기 값이다. 어느 테마에서 보이는지는 렌더러가 판정한다. */
export function useSeasonWeather(effect: SeasonWeatherId): boolean {
  return useSyncExternalStore(subscribeSeason,
    () => normalizeSeasonWeatherEnabled(document.documentElement.dataset[SEASON_WEATHER_EFFECTS[effect].dataset]),
    () => DEFAULT_SEASON_WEATHER_ENABLED);
}

/** 눈 양(적게·보통·많이)이다. */
export function useSeasonSnowAmount(): SeasonSnowAmount {
  return useSyncExternalStore(subscribeSeason, seasonSnowAmountSnapshot, () => DEFAULT_SEASON_SNOW_AMOUNT);
}

/** 지금 실제로 보이는 시즌 테마(`<html data-season>`)다. 장식이 없으면 none이다. */
export function useActiveSeason(): string {
  return useSyncExternalStore(subscribeSeason, () => document.documentElement.dataset.season ?? SEASON_NONE, () => SEASON_NONE);
}

export function useSeasonSnowBehindCards(): boolean {
  return useSyncExternalStore(subscribeSeason, seasonSnowBehindCardsSnapshot, () => DEFAULT_SEASON_SNOW_BEHIND_CARDS);
}
