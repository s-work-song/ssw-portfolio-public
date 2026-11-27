/**
 * 사이트 시즌 테마(사계절과 크리스마스 같은 행사)를 정하는 순수 모듈이다.
 *
 * 테마를 늘릴 때는 `SEASON_THEMES`에 한 줄을 더하고, 장식 그림(`SeasonDecoration`의
 * 테마별 표)과 색 토큰(globals.css)을 채운다. 판정 규칙은 이 파일 하나가 쥔다.
 *
 * 장식은 React 상태가 아니라 `<html data-season>`을 보는 CSS가 켜고 끈다.
 * 부트 스크립트가 첫 페인트 전에 `seasonBootSnippet()`으로 속성을 심고,
 * `SeasonController`가 날짜가 바뀌는 시각·탭 복귀 때 `resolveSeasonTheme`으로 다시 판정한다.
 * 두 판정이 같은 표(`SEASON_THEMES`)를 쓰므로 첫 화면과 이후 판정이 어긋나지 않는다.
 *
 * 날짜는 빌드 시각이 아니라 방문자 브라우저의 현재 시각을 한국 시간(KST)으로 바꿔 본다.
 */

/** 테마 하나의 정의다. 행사는 날짜 범위, 계절은 달 목록으로 기간을 정한다. */
export interface SeasonThemeDefinition {
  /** `<html data-season>` 값이자 저장 값이다. */
  readonly id: string;
  /** 설정 화면에 보이는 이름이다. */
  readonly label: string;
  /** 설정 화면의 짧은 설명이다. */
  readonly description: string;
  /** 행사는 계절보다 먼저 판정한다. */
  readonly kind: 'event' | 'season';
  /** 행사 기간(KST, 양 끝 포함). [시작 달, 시작 일, 끝 달, 끝 일]. 해가 바뀌는 범위도 된다. */
  readonly range?: readonly [number, number, number, number];
  /** 계절에 드는 달(KST, 1~12). */
  readonly months?: readonly number[];
  /** 이 테마에서 눈 내리기 설정이 켜져 있으면 눈을 내린다. */
  readonly snow: boolean;
  /** 이 테마에서 모션이 허용되면 본문 뒤로 루돌프 썰매가 이따금 지나간다(SleighLayer). 눈 내리기 설정과는 따로다. */
  readonly sleigh: boolean;
}

/**
 * 테마 등록표다. 자동 판정은 이 순서대로 행사부터 보고, 맞는 행사가 없으면 계절을 쓴다.
 * 새 행사를 더할 때는 계절보다 앞에 둔다.
 */
export const SEASON_THEMES = [
  {
    id: 'christmas',
    label: '크리스마스',
    description: '12월 한 달. 전구 줄·전나무·별·썰매',
    kind: 'event',
    range: [12, 1, 12, 31],
    snow: true,
    sleigh: true,
  },
  { id: 'spring', label: '봄', description: '3~5월. 벚꽃 가지와 흩날리는 꽃잎', kind: 'season', months: [3, 4, 5], snow: false, sleigh: false },
  { id: 'summer', label: '여름', description: '6~8월. 해·물결·빗줄기', kind: 'season', months: [6, 7, 8], snow: false, sleigh: false },
  { id: 'autumn', label: '가을', description: '9~11월. 단풍 장식과 날리는 낙엽', kind: 'season', months: [9, 10, 11], snow: false, sleigh: false },
  { id: 'winter', label: '겨울', description: '12~2월. 눈송이와 고드름', kind: 'season', months: [12, 1, 2], snow: true, sleigh: false },
] as const satisfies readonly SeasonThemeDefinition[];

export type SeasonThemeId = (typeof SEASON_THEMES)[number]['id'];

/** 테마 선택의 허용값이다. 자동은 날짜로 고르고, 끔은 장식을 모두 숨긴다. */
export const SEASON_THEME_PREFERENCES = ['auto', 'off', ...SEASON_THEMES.map((theme) => theme.id)] as const;
export type SeasonThemePreference = 'auto' | 'off' | SeasonThemeId;

export const DEFAULT_SEASON_THEME_PREFERENCE: SeasonThemePreference = 'auto';

/** 장식이 없을 때 `<html data-season>`에 심는 값이다. */
export const SEASON_NONE = 'none';

/** 테마 선택과 눈 내리기 선택이 담기는 localStorage 키다. */
export const SEASON_THEME_STORAGE_KEY = 'ssw-season-theme';
export const SEASON_SNOW_STORAGE_KEY = 'ssw-season-snow';

/** 눈 내리기 기본값이다(눈이 있는 테마에서만 실제로 내린다). */
export const DEFAULT_SEASON_SNOW = true;

export const SEASON_SNOW_BEHIND_CARDS_STORAGE_KEY = 'ssw-season-snow-behind-cards';
/** 카드 뒤에 숨기기 기본값이다. 저장된 선택이 없으면 효과를 카드 뒤에 그린다(사용자 결정). */
export const DEFAULT_SEASON_SNOW_BEHIND_CARDS = true;

/** 눈 양 선택이 담기는 localStorage 키다. */
export const SEASON_SNOW_AMOUNT_STORAGE_KEY = 'ssw-season-snow-amount';

/**
 * 눈 양 단계다. factor는 화면 넓이로 정한 최대 눈송이 수에 곱하는 비율이다.
 * "많이"가 처음 만든 양(최대)이고, 기본 "보통"은 그 절반이다(사용자 결정).
 */
export const SEASON_SNOW_AMOUNTS = [
  { value: 'light', label: '적게', factor: 0.25 },
  { value: 'normal', label: '보통', factor: 0.5 },
  { value: 'heavy', label: '많이', factor: 1 },
] as const;

export type SeasonSnowAmount = (typeof SEASON_SNOW_AMOUNTS)[number]['value'];

export const SEASON_SNOW_AMOUNT_VALUES: readonly SeasonSnowAmount[] = SEASON_SNOW_AMOUNTS.map((amount) => amount.value);

export const DEFAULT_SEASON_SNOW_AMOUNT: SeasonSnowAmount = 'normal';

/** 눈을 내리는 테마 목록이다. 눈 레이어와 부트 스크립트가 같이 쓴다. */
export const SNOW_THEME_IDS: readonly string[] = SEASON_THEMES.filter((theme) => theme.snow).map((theme) => theme.id);

/** 썰매가 지나가는 테마 목록이다. 썰매 레이어가 쓴다. */
export const SLEIGH_THEME_IDS: readonly string[] = SEASON_THEMES.filter((theme) => theme.sleigh).map((theme) => theme.id);

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 선택값이 허용 목록 안에 있으면 그대로, 아니면 기본값으로 접는다. */
export function normalizeSeasonThemePreference(value: unknown): SeasonThemePreference {
  return typeof value === 'string' && (SEASON_THEME_PREFERENCES as readonly string[]).includes(value)
    ? (value as SeasonThemePreference)
    : DEFAULT_SEASON_THEME_PREFERENCE;
}

/** 저장된 눈 내리기 값을 읽는다. 'true'/'false'만 믿는다. */
export function normalizeSeasonSnow(value: unknown): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return DEFAULT_SEASON_SNOW;
}

/** 저장된 카드 뒤 숨기기 값을 읽는다. 'true'/'false'만 믿고, 그 밖에는 기본값(켬)이다. */
export function normalizeSeasonSnowBehindCards(value: unknown): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return DEFAULT_SEASON_SNOW_BEHIND_CARDS;
}

/** 저장된 눈 양 값을 읽는다. 허용 목록 밖이면 기본값(보통)이다. */
export function normalizeSeasonSnowAmount(value: unknown): SeasonSnowAmount {
  return typeof value === 'string' && (SEASON_SNOW_AMOUNT_VALUES as readonly string[]).includes(value)
    ? (value as SeasonSnowAmount)
    : DEFAULT_SEASON_SNOW_AMOUNT;
}

/** 눈 양 단계를 '많이'의 기본 눈송이 수에 곱할 비율로 바꾼다. */
export function seasonSnowFactor(value: unknown): number {
  const amount = normalizeSeasonSnowAmount(value);
  return SEASON_SNOW_AMOUNTS.find((entry) => entry.value === amount)?.factor ?? 0.5;
}

/** 화면 약 20,000px²당 최대 한 개(기본 상한 90개), 카드 뒤에서는 같은 눈 양의 두 배다. */
export function seasonSnowflakeCount(width: number, height: number, amount: unknown, behindCards: boolean): number {
  const count = Math.round(Math.min(90, (width * height) / 20000) * seasonSnowFactor(amount));
  return behindCards ? count * 2 : count;
}

/** 시각을 KST 달(1~12)과 일로 바꾼다. */
function kstMonthDay(nowMs: number): { month: number; day: number } {
  const date = new Date(nowMs + KST_OFFSET_MS);
  return { month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** 달·일을 비교하기 쉬운 수(월*100+일)로 바꾼다. */
const monthDayKey = (month: number, day: number) => month * 100 + day;

/** 행사 기간 안인지 본다. 해가 바뀌는 범위(예: 12/24~1/2)도 처리한다. */
function inRange(range: readonly [number, number, number, number], month: number, day: number): boolean {
  const now = monthDayKey(month, day);
  const start = monthDayKey(range[0], range[1]);
  const end = monthDayKey(range[2], range[3]);
  return start <= end ? now >= start && now <= end : now >= start || now <= end;
}

/** 지금 날짜에 맞는 테마를 고른다(행사 먼저, 없으면 계절). */
export function automaticSeasonTheme(nowMs: number): SeasonThemeId | typeof SEASON_NONE {
  const { month, day } = kstMonthDay(nowMs);
  for (const theme of SEASON_THEMES) {
    if (theme.kind === 'event' && 'range' in theme && inRange(theme.range, month, day)) return theme.id;
  }
  for (const theme of SEASON_THEMES) {
    if (theme.kind === 'season' && 'months' in theme && (theme.months as readonly number[]).includes(month)) return theme.id;
  }
  return SEASON_NONE;
}

/** 선택과 시각으로 실제로 보일 테마를 정한다. */
export function resolveSeasonTheme(
  preference: SeasonThemePreference,
  nowMs: number,
): SeasonThemeId | typeof SEASON_NONE {
  if (preference === 'off') return SEASON_NONE;
  if (preference === 'auto') return automaticSeasonTheme(nowMs);
  return preference;
}

/** 다음 KST 자정이다. 자동 판정은 날짜가 바뀔 때만 달라지므로 그때 다시 본다. */
export function nextKstMidnight(nowMs: number): number {
  return Math.floor((nowMs + KST_OFFSET_MS) / DAY_MS) * DAY_MS + DAY_MS - KST_OFFSET_MS;
}

/**
 * 부트 스크립트에 넣는 판정 코드다. `d`(문서 루트 dataset)에 이미 심긴
 * `seasonTheme`(선택)을 읽어 `season`(실제 테마)을 심는다.
 *
 * `resolveSeasonTheme`과 같은 규칙을 표(`SEASON_THEMES`)에서 그대로 옮긴다.
 * 표 값은 이 모듈의 상수뿐이라 외부 입력이 코드에 섞이지 않는다.
 */
/**
 * 주소 쿼리로 시즌 설정을 잠시 덮을 때 쓰는 이름이다. 예: `?season=christmas&snow=on`.
 *
 * 덮어쓴 값은 sessionStorage(같은 저장 키)에 두므로 그 탭에서 사이트 안을 옮겨 다니는 동안만
 * 이어지고, 방문자가 localStorage에 저장한 설정은 건드리지 않는다. 설정 화면에서 직접 고르면
 * 덮어쓰기는 지운다(SeasonController).
 */
export const SEASON_QUERY_PARAMS = { theme: 'season', snow: 'snow' } as const;

/** 눈 쿼리 값을 저장 형식으로 옮기는 표다. */
const SNOW_QUERY_VALUES: Readonly<Record<string, 'true' | 'false'>> = {
  on: 'true',
  true: 'true',
  '1': 'true',
  off: 'false',
  false: 'false',
  '0': 'false',
};

/** 주소 쿼리에서 시즌 덮어쓰기 값을 읽는다. 허용 목록 밖의 값은 버린다(대소문자는 가리지 않는다). */
export function readSeasonQuery(search: string): { theme?: SeasonThemePreference; snow?: 'true' | 'false' } {
  const params = new URLSearchParams(search);
  const result: { theme?: SeasonThemePreference; snow?: 'true' | 'false' } = {};
  const theme = (params.get(SEASON_QUERY_PARAMS.theme) ?? '').toLowerCase();
  if ((SEASON_THEME_PREFERENCES as readonly string[]).includes(theme)) result.theme = theme as SeasonThemePreference;
  const snow = (params.get(SEASON_QUERY_PARAMS.snow) ?? '').toLowerCase();
  if (Object.prototype.hasOwnProperty.call(SNOW_QUERY_VALUES, snow)) result.snow = SNOW_QUERY_VALUES[snow];
  return result;
}

/**
 * 부트 스크립트 안에서 `readSeasonQuery`와 같은 판정으로 쿼리를 sessionStorage에 옮기고,
 * 시즌 키를 sessionStorage → localStorage 순서로 읽는 `sget(k)`를 정의한다.
 * 부트 스크립트의 `get(k)`(localStorage 읽기)가 먼저 정의돼 있어야 한다.
 */
export function seasonQueryBootSnippet(): string {
  const allowed = JSON.stringify(SEASON_THEME_PREFERENCES).replace(/</g, '\\u003c');
  const snow = JSON.stringify(SNOW_QUERY_VALUES);
  return [
    `var Q=new URLSearchParams(location.search),QP=${allowed},QS=${snow};`,
    'function ss(k,v){try{sessionStorage.setItem(k,v);}catch(e){}}',
    `var qt=(Q.get("${SEASON_QUERY_PARAMS.theme}")||"").toLowerCase();if(QP.indexOf(qt)!==-1)ss("${SEASON_THEME_STORAGE_KEY}",qt);`,
    `var qs=(Q.get("${SEASON_QUERY_PARAMS.snow}")||"").toLowerCase();if(Object.prototype.hasOwnProperty.call(QS,qs))ss("${SEASON_SNOW_STORAGE_KEY}",QS[qs]);`,
    'function sget(k){try{var o=sessionStorage.getItem(k);if(o!==null)return o;}catch(e){}return get(k);}',
  ].join('');
}

export function seasonBootSnippet(): string {
  const table = SEASON_THEMES.map((theme) => ({
    i: theme.id,
    r: 'range' in theme ? theme.range : null,
    m: 'months' in theme ? theme.months : null,
  }));
  const json = JSON.stringify(table).replace(/</g, '\\u003c');
  return [
    `var T=${json},p=d.seasonTheme,x=new Date(Date.now()+${KST_OFFSET_MS}),mo=x.getUTCMonth()+1,k=mo*100+x.getUTCDate(),sv="${SEASON_NONE}";`,
    'if(p==="auto"){for(var i=0;i<T.length&&sv==="none";i++){var r=T[i].r;if(r){var a=r[0]*100+r[1],b=r[2]*100+r[3];if(a<=b?(k>=a&&k<=b):(k>=a||k<=b))sv=T[i].i;}}',
    'for(var j=0;j<T.length&&sv==="none";j++){if(T[j].m&&T[j].m.indexOf(mo)!==-1)sv=T[j].i;}}',
    'else if(p!=="off"){sv=p;}',
    'd.season=sv;',
  ].join('');
}
