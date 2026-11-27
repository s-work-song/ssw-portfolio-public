import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SEASON_SNOW_BEHIND_CARDS,
  SEASON_THEMES,
  SLEIGH_THEME_IDS,
  SNOW_THEME_IDS,
  automaticSeasonTheme,
  nextKstMidnight,
  normalizeSeasonSnow,
  normalizeSeasonSnowAmount,
  normalizeSeasonSnowBehindCards,
  normalizeSeasonThemePreference,
  readSeasonQuery,
  resolveSeasonTheme,
  SEASON_SNOW_STORAGE_KEY,
  SEASON_THEME_STORAGE_KEY,
  seasonBootSnippet,
  seasonQueryBootSnippet,
  seasonSnowFactor,
  seasonSnowflakeCount,
} from '../../../src/features/seasonal/seasonPolicy.ts';

/** KST 벽시계 시각을 UTC 밀리초로 바꾼다. */
const kst = (year, month, day, hour = 0, minute = 0) => Date.UTC(year, month - 1, day, hour - 9, minute);

test('자동은 행사 기간이면 행사, 아니면 KST 달로 계절을 고른다', () => {
  assert.equal(automaticSeasonTheme(kst(2026, 11, 30, 23, 59)), 'autumn');
  assert.equal(automaticSeasonTheme(kst(2026, 12, 1)), 'christmas');
  assert.equal(automaticSeasonTheme(kst(2026, 12, 31, 23, 59)), 'christmas');
  assert.equal(automaticSeasonTheme(kst(2027, 1, 1)), 'winter');
  assert.equal(automaticSeasonTheme(kst(2027, 2, 28, 23, 59)), 'winter');
  assert.equal(automaticSeasonTheme(kst(2027, 3, 1)), 'spring');
  assert.equal(automaticSeasonTheme(kst(2027, 6, 1)), 'summer');
  assert.equal(automaticSeasonTheme(kst(2027, 9, 1)), 'autumn');
});

test('UTC로는 전날이어도 KST 날짜로 판정한다', () => {
  // KST 12/1 08:00 = UTC 11/30 23:00
  assert.equal(automaticSeasonTheme(Date.UTC(2026, 10, 30, 23, 0)), 'christmas');
});

test('직접 고른 테마는 날짜와 무관하고, 끔은 장식을 없앤다', () => {
  assert.equal(resolveSeasonTheme('spring', kst(2026, 12, 24)), 'spring');
  assert.equal(resolveSeasonTheme('off', kst(2026, 12, 24)), 'none');
  assert.equal(resolveSeasonTheme('auto', kst(2026, 12, 24)), 'christmas');
});

test('저장값이 허용 목록 밖이면 기본값으로 접는다', () => {
  for (const value of [null, undefined, '', 'halloween', '__proto__', 1]) {
    assert.equal(normalizeSeasonThemePreference(value), 'auto');
  }
  assert.equal(normalizeSeasonThemePreference('winter'), 'winter');
  assert.equal(normalizeSeasonSnow('false'), false);
  assert.equal(normalizeSeasonSnow('true'), true);
  assert.equal(normalizeSeasonSnow('yes'), true);
});

test('눈은 눈이 있는 테마(겨울·크리스마스)에서만 내린다', () => {
  assert.deepEqual([...SNOW_THEME_IDS].sort(), ['christmas', 'winter']);
});

test('카드 뒤에 숨기기는 저장값이 명시적으로 꺼진 경우에만 끄고, 저장값이 없으면 기본값을 따른다', () => {
  for (const value of [null, undefined, '', 'on']) {
    assert.equal(normalizeSeasonSnowBehindCards(value), DEFAULT_SEASON_SNOW_BEHIND_CARDS);
  }
  assert.equal(normalizeSeasonSnowBehindCards('true'), true);
  assert.equal(normalizeSeasonSnowBehindCards('false'), false);
});

test('썰매는 크리스마스 테마에서만 지나간다', () => {
  assert.deepEqual([...SLEIGH_THEME_IDS], ['christmas']);
});

test('다음 판정 시각은 다음 KST 자정이다', () => {
  assert.equal(nextKstMidnight(kst(2026, 11, 22, 15, 30)), kst(2026, 11, 23));
  assert.equal(nextKstMidnight(kst(2026, 11, 22)), kst(2026, 11, 23));
});

/** 부트 스크립트 조각을 가짜 dataset·시계로 실행해 심는 값을 본다. 조각은 모듈 상수로만 만든다. */
function runBoot(preference, nowMs) {
  const d = { seasonTheme: preference };
  const FakeDate = class extends Date {
    constructor(...args) { super(...(args.length ? args : [nowMs])); }
    static now() { return nowMs; }
  };
  new Function('d', 'Date', seasonBootSnippet())(d, FakeDate);
  return d.season;
}

test('부트 스크립트 조각은 resolveSeasonTheme과 같은 테마를 심는다', () => {
  const preferences = ['auto', 'off', ...SEASON_THEMES.map((theme) => theme.id)];
  const moments = [
    kst(2026, 11, 22), kst(2026, 12, 1), kst(2026, 12, 31, 23, 59), kst(2027, 1, 1),
    kst(2027, 3, 15), kst(2027, 7, 4), kst(2027, 10, 9), Date.UTC(2026, 10, 30, 23, 0),
  ];
  for (const preference of preferences) {
    for (const now of moments) {
      assert.equal(runBoot(preference, now), resolveSeasonTheme(preference, now), `${preference} @ ${new Date(now).toISOString()}`);
    }
  }
});

/** 부트 쿼리 조각을 가짜 location·sessionStorage·localStorage로 돌려 시즌 키를 읽는다. */
function runQueryBoot(search, saved = {}) {
  const session = new Map();
  const sessionStorage = {
    getItem: (key) => (session.has(key) ? session.get(key) : null),
    setItem: (key, value) => session.set(key, String(value)),
  };
  const get = (key) => (key in saved ? saved[key] : null);
  return new Function(
    'location', 'sessionStorage', 'get',
    `${seasonQueryBootSnippet()};return [sget(${JSON.stringify(SEASON_THEME_STORAGE_KEY)}),sget(${JSON.stringify(SEASON_SNOW_STORAGE_KEY)})];`,
  )({ search }, sessionStorage, get);
}

test('쿼리로 시즌 설정을 덮고, 허용 밖 값은 버린다', () => {
  assert.deepEqual(readSeasonQuery('?season=christmas&snow=on'), { theme: 'christmas', snow: 'true' });
  assert.deepEqual(readSeasonQuery('?season=Spring&snow=0'), { theme: 'spring', snow: 'false' });
  assert.deepEqual(readSeasonQuery('?season=halloween&snow=maybe'), {});
  assert.deepEqual(readSeasonQuery('?season=__proto__&snow=__proto__'), {});
  assert.deepEqual(readSeasonQuery(''), {});
});

test('부트 쿼리 조각은 readSeasonQuery와 같게 덮고, 없으면 저장된 설정을 쓴다', () => {
  const saved = { [SEASON_THEME_STORAGE_KEY]: 'autumn', [SEASON_SNOW_STORAGE_KEY]: 'false' };
  const searches = ['?season=christmas&snow=on', '?season=OFF', '?snow=true', '?season=halloween&snow=maybe', '?snow=__proto__', ''];
  for (const search of searches) {
    const query = readSeasonQuery(search);
    assert.deepEqual(
      runQueryBoot(search, saved),
      [query.theme ?? saved[SEASON_THEME_STORAGE_KEY], query.snow ?? saved[SEASON_SNOW_STORAGE_KEY]],
      search,
    );
  }
});

test('눈 양은 허용 단계만 받고, 기본(보통)은 많이의 절반이다', () => {
  assert.equal(normalizeSeasonSnowAmount('light'), 'light');
  assert.equal(normalizeSeasonSnowAmount('heavy'), 'heavy');
  assert.equal(normalizeSeasonSnowAmount('huge'), 'normal');
  assert.equal(normalizeSeasonSnowAmount(null), 'normal');
  assert.equal(seasonSnowFactor('heavy'), 1);
  assert.equal(seasonSnowFactor(undefined), seasonSnowFactor('heavy') / 2);
  assert.ok(seasonSnowFactor('light') < seasonSnowFactor('normal'));
});

test('카드 뒤 눈송이 수는 화면과 눈 양에 맞춘 기본 수의 정확히 두 배다', () => {
  for (const [width, height] of [[420, 800], [1250, 710], [3840, 2160]]) {
    for (const amount of ['light', 'normal', 'heavy']) {
      assert.equal(seasonSnowflakeCount(width, height, amount, true), 2 * seasonSnowflakeCount(width, height, amount, false));
    }
  }
  assert.equal(seasonSnowflakeCount(3840, 2160, 'heavy', true), 180);
  assert.equal(seasonSnowflakeCount(1250, 710, 'normal', false), 22);
});
