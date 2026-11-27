/** 실제 시즌 테마에 붙는 눈 이외의 효과와 개별 설정의 계약이다. */
export const SEASON_WEATHER_EFFECTS = {
  leaves: { season: 'autumn', themeLabel: '가을', label: '낙엽 날리기', dataset: 'seasonLeaves', storage: 'ssw-season-leaves' },
  petals: { season: 'spring', themeLabel: '봄', label: '벚꽃 흩날리기', dataset: 'seasonPetals', storage: 'ssw-season-petals' },
  rain: { season: 'summer', themeLabel: '여름', label: '비 내리기', dataset: 'seasonRain', storage: 'ssw-season-rain' },
} as const;

export const SEASON_WEATHER_IDS = ['leaves', 'petals', 'rain'] as const;
export type SeasonWeatherId = typeof SEASON_WEATHER_IDS[number];
export const DEFAULT_SEASON_WEATHER_ENABLED = true;

export function normalizeSeasonWeatherEnabled(value: unknown): boolean {
  return value === 'false' ? false : DEFAULT_SEASON_WEATHER_ENABLED;
}

export function isSeasonWeatherEnabled(effect: SeasonWeatherId, dataset: Readonly<Record<string, string | undefined>>): boolean {
  const definition = SEASON_WEATHER_EFFECTS[effect];
  return dataset.season === definition.season && normalizeSeasonWeatherEnabled(dataset[definition.dataset]);
}
