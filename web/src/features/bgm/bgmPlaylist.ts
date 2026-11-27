/**
 * 사이트 배경음악(BGM) 곡 목록이다. 시즌 테마(features/seasonal)마다 목록을 두고,
 * 지금 테마에 곡이 있을 때만 머리글에 BGM 단추가 보인다.
 *
 * 크리스마스 곡은 퍼블릭 도메인 캐럴을 직접 편곡한 것으로, 곡마다 두 판이 있다.
 * - 악기판(instrument): MIDI 편곡을 GeneralUser GS 사운드폰트(제한 없는 음악 제작 허용)로 FluidSynth에서 렌더링
 * - 오르골판(musicbox): 같은 MIDI 편곡을 샘플 없이 Python(numpy)으로 직접 합성한 오르골 소리
 * 화면 이름은 판 이름 뒤에 만든 도구를 괄호로 붙인다(사용자 결정, 예: 악기 (FluidSynth)).
 *
 * 목록은 곡 단위다. 방문자는 곡을 고르고, 판(악기·오르골)은 따로 고른다(샘플 사이트의 캐럴 재생기와 같은 방식).
 * 음원은 이 저장소에 두지 않고 샘플 사이트(pf-samples)의 캐럴 재생기(/music/carols/)에서 받는다.
 * 파일 이름에 내용 해시가 붙어 1년 캐시가 걸리고, 그쪽이 CORS를 허용한다. 주소는 그쪽 tracks.json의 url을 옮겨 적는다
 * (캐럴을 다시 렌더링해 해시가 바뀌면 여기 주소도 바꿔야 한다). 사이트에는 16곡 가운데 다섯 곡만 싣는다(사용자 결정).
 */

/** 같은 곡의 두 판이다. 화면의 판 선택(악기·오르골)과 짝을 이룬다. */
export type BgmVersion = 'instrument' | 'musicbox';

export const BGM_VERSIONS: readonly BgmVersion[] = ['instrument', 'musicbox'];

/** 지금 곡에 붙는 판 이름이다(만든 도구까지). */
export const BGM_VERSION_LABELS: Record<BgmVersion, string> = {
  instrument: '악기 (FluidSynth)',
  musicbox: '오르골 (Python 합성)',
};

/** 판 선택 칩처럼 좁은 곳에 쓰는 짧은 판 이름이다. */
export const BGM_VERSION_SHORT_LABELS: Record<BgmVersion, string> = {
  instrument: '악기',
  musicbox: '오르골',
};

export const DEFAULT_BGM_VERSION: BgmVersion = 'instrument';

export interface BgmSong {
  /** 목록 안에서 겹치지 않는 이름이다. */
  readonly id: string;
  /** 화면에 크게 보이는 곡 이름(한국어 제목)이다. */
  readonly title: string;
  /** 원제(영어 제목)다. 곡 이름 아래 작은 둘째 줄로 보인다. */
  readonly originalTitle: string;
  /** 판마다 음원 주소다. 다른 출처의 전체 주소 또는 basePath를 뺀 사이트 경로다. */
  readonly sources: Partial<Record<BgmVersion, string>>;
}

/** 재생기가 실제로 트는 한 판의 곡이다. id는 `<곡 id>:<판>`이다. */
export interface BgmTrack {
  readonly id: string;
  readonly songId: string;
  readonly title: string;
  readonly originalTitle: string;
  readonly version: BgmVersion;
  readonly src: string;
}

const CAROLS = 'https://pf-samples.sworksong.workers.dev/music/carols/audio';

/** 시즌 테마 id → 곡 목록. 순서대로 틀고 끝나면 처음으로 돌아간다. */
export const BGM_SONGS: Readonly<Record<string, readonly BgmSong[]>> = {
  christmas: [
    {
      id: 'we-wish-you-a-merry-christmas',
      title: '즐거운 성탄 보내세요',
      originalTitle: 'We Wish You a Merry Christmas',
      sources: {
        instrument: `${CAROLS}/we-wish-you-a-merry-christmas-instrument.1814f47f7eb3.mp3`,
        musicbox: `${CAROLS}/we-wish-you-a-merry-christmas-musicbox.3b9a2ebab17e.mp3`,
      },
    },
    {
      id: 'jingle-bells',
      title: '징글벨',
      originalTitle: 'Jingle Bells',
      sources: {
        instrument: `${CAROLS}/jingle-bells-instrument.09ba67774b54.mp3`,
        musicbox: `${CAROLS}/jingle-bells-musicbox.78b85fdeafbf.mp3`,
      },
    },
    {
      id: 'silent-night',
      title: '고요한 밤',
      originalTitle: 'Silent Night',
      sources: {
        instrument: `${CAROLS}/silent-night-instrument.7e6f038ba3f9.mp3`,
        musicbox: `${CAROLS}/silent-night-musicbox.e7c049a34d7c.mp3`,
      },
    },
    {
      id: 'o-holy-night',
      title: '오 거룩한 밤',
      originalTitle: 'O Holy Night',
      sources: {
        instrument: `${CAROLS}/o-holy-night-instrument.697d4dcf5cb0.mp3`,
        musicbox: `${CAROLS}/o-holy-night-musicbox.3c2fc163e582.mp3`,
      },
    },
    {
      id: 'twelve-days-of-christmas',
      title: '12일간의 크리스마스',
      originalTitle: 'The Twelve Days of Christmas',
      sources: {
        instrument: `${CAROLS}/twelve-days-of-christmas-instrument.56b49897e379.mp3`,
        musicbox: `${CAROLS}/twelve-days-of-christmas-musicbox.dfebe3cc2d09.mp3`,
      },
    },
  ],
};

/** 시즌 테마의 곡 목록이다. 곡이 없는 테마는 빈 목록이다. */
export function bgmSongsFor(season: string): readonly BgmSong[] {
  return BGM_SONGS[season] ?? [];
}

/** 곡 하나를 고른 판으로 바꾼다. 그 판이 없으면 있는 판으로 튼다. */
export function bgmTrackOf(song: BgmSong, version: BgmVersion): BgmTrack {
  const chosen = song.sources[version] ? version : (BGM_VERSIONS.find((v) => song.sources[v]) ?? version);
  return {
    id: `${song.id}:${chosen}`,
    songId: song.id,
    title: song.title,
    originalTitle: song.originalTitle,
    version: chosen,
    src: song.sources[chosen] ?? '',
  };
}

/** 시즌 테마의 곡들을 고른 판으로 바꾼 재생 목록이다. */
export function bgmTracksFor(season: string, version: BgmVersion): readonly BgmTrack[] {
  return bgmSongsFor(season).map((song) => bgmTrackOf(song, version));
}

/** 시즌 테마 목록에 들어 있는 판 종류다(정해 둔 순서대로). 둘 이상일 때만 판 선택을 보인다. */
export function bgmVersionsFor(season: string): readonly BgmVersion[] {
  const songs = bgmSongsFor(season);
  return BGM_VERSIONS.filter((version) => songs.some((song) => song.sources[version]));
}

/** 트랙 id(`<곡 id>:<판>`)에서 곡 id를 꺼낸다. */
export function bgmSongIdOf(trackId: string | null): string | null {
  return trackId ? trackId.split(':')[0] : null;
}

/** 저장된 판 선택을 읽는다. 허용 밖 값(예전의 'all' 포함)은 기본(악기)으로 접는다. */
export function normalizeBgmVersion(value: unknown): BgmVersion {
  return typeof value === 'string' && (BGM_VERSIONS as readonly string[]).includes(value)
    ? (value as BgmVersion)
    : DEFAULT_BGM_VERSION;
}

/** 저장된 음량(0~1)을 읽는다. 없거나 깨졌으면 기본값이다. */
export function normalizeBgmVolume(value: unknown, fallback = 0.5): number {
  const number = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
}
