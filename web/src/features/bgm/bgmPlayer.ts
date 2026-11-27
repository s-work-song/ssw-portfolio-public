/**
 * 사이트 배경음악(BGM) 재생기다. 페이지를 옮겨 다녀도 끊기지 않도록 모듈 하나가 상태와 오디오를
 * 쥐고(싱글턴), 화면 부품은 `useBgm`으로 구독만 한다.
 *
 * - 소리 크기는 Web Audio의 GainNode로 조절한다. iOS Safari는 `audio.volume`을 무시하므로,
 *   페이드·크로스페이드가 휴대폰에서도 되려면 이 경로가 필요하다. Web Audio가 없으면 `audio.volume`으로 대신한다.
 * - 재생 칸(deck)을 둘 두고 번갈아 써서 곡 사이를 크로스페이드한다. 곡이 끝나기 CROSSFADE_S초 전에 다음 곡을 겹친다.
 * - 사이트의 다른 소리(실험 음원 프리뷰·영상 등 문서 안의 audio/video 중 음소거가 아닌 것)가 재생되면
 *   BGM을 줄였다가 멈추고(ducked), 그 소리가 모두 멈추면 다시 올린다. 이 재생기의 Audio 객체는 문서 밖이라
 *   자기 이벤트에는 반응하지 않는다. 다른 주소를 iframe으로 띄운 화면 안의 소리는 감지하지 못한다.
 * - 브라우저가 소리 자동 재생을 막으므로 첫 재생은 늘 방문자가 누를 때 시작한다(기본은 꺼짐).
 * - 지금 시즌 테마에 곡이 없으면(테마를 끄거나 바꾸면) 조용히 멈춘다.
 * - 목록은 곡 단위이고 판(악기·오르골)은 따로 고른다. 재생 중에 판을 바꾸면 같은 곡의 다른 판으로
 *   같은 비율 자리에서 짧게 크로스페이드한다(두 판은 같은 편곡이라 길이가 거의 같다). 멈춘 동안 바꾸면 다음 재생 때 그 자리에서 이어진다.
 * 음량과 판 선택만 localStorage에 남긴다. 재생 여부는 남기지 않는다(새로 고침 뒤 자동으로 울리지 않게).
 */
import { SEASON_CHANGE_EVENT } from '../seasonal/SeasonController';
import {
  DEFAULT_BGM_VERSION,
  bgmSongIdOf,
  bgmTracksFor,
  normalizeBgmVersion,
  normalizeBgmVolume,
  type BgmTrack,
  type BgmVersion,
} from './bgmPlaylist';

export type BgmStatus = 'idle' | 'playing' | 'paused' | 'ducked';

export interface BgmState {
  readonly status: BgmStatus;
  /** 지금(또는 마지막으로) 고른 곡의 판(`<곡 id>:<판>`)이다. 아직 틀지 않았으면 null이다. */
  readonly trackId: string | null;
  /** 전체 음량(0~1)이다. */
  readonly volume: number;
  /** 고른 판(악기·오르골)이다. */
  readonly version: BgmVersion;
  /** 지금 사이트의 시즌 테마(`<html data-season>`)다. */
  readonly season: string;
}

const VOLUME_STORAGE_KEY = 'ssw-bgm-volume';
const VERSION_STORAGE_KEY = 'ssw-bgm-version';
const FADE_IN_S = 1.2;
const FADE_OUT_S = 0.6;
const CROSSFADE_S = 3;
/** 같은 곡의 다른 판으로 바꿀 때의 크로스페이드다. 곡 사이보다 짧게 해 두 판이 오래 겹치지 않게 한다. */
const VERSION_SWITCH_S = 1.2;
const DUCK_OUT_S = 0.8;
const DUCK_IN_S = 1.5;

/** 서버 렌더와 하이드레이션 첫 그림에 쓰는 상태다(단추가 보이지 않는다). */
export const BGM_SERVER_STATE: BgmState = { status: 'idle', trackId: null, volume: 0.5, version: DEFAULT_BGM_VERSION, season: 'none' };

interface Deck {
  readonly audio: HTMLAudioElement;
  /** Web Audio가 있으면 이 칸의 페이드용 이득 노드다. */
  readonly gain: GainNode | null;
  trackId: string | null;
  /** Web Audio가 없을 때 쓰는 페이드 단계(0~1)와 그 타이머다. */
  level: number;
  rampTimer: number;
  stopTimer: number;
}

let state: BgmState = BGM_SERVER_STATE;
let initialized = false;
const listeners = new Set<() => void>();
let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let decks: [Deck, Deck] | null = null;
let activeDeck = 0;
let advancing = false;
/** 멈춘 동안 판을 바꿨을 때 다음 재생을 시작할 자리(곡 길이에 대한 비율)다. */
let resumeRatio = 0;

function emit(patch: Partial<BgmState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 저장소가 막혀 있어도 지금 재생은 그대로 둔다.
  }
}

function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // 저장소가 막혀 있어도 지금 재생은 그대로 둔다.
  }
}

/** 사이트 경로면 basePath를 붙이고, 다른 출처의 전체 주소(샘플 사이트 음원)는 그대로 쓴다. */
function withBasePath(src: string): string {
  if (/^https?:\/\//.test(src)) return src;
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${src}`;
}

function currentTracks(): readonly BgmTrack[] {
  return bgmTracksFor(state.season, state.version);
}

/** 처음 구독될 때 한 번만 저장값을 읽고 시즌 변화·다른 소리 감지를 붙인다. */
function ensureInit(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  state = {
    ...state,
    volume: normalizeBgmVolume(readStorage(VOLUME_STORAGE_KEY)),
    version: normalizeBgmVersion(readStorage(VERSION_STORAGE_KEY)),
    season: document.documentElement.dataset.season ?? 'none',
  };
  window.addEventListener(SEASON_CHANGE_EVENT, onSeasonChange);
  // 미디어 이벤트는 거품이 일지 않으므로 잡기 단계(capture)로 문서 전체를 듣는다.
  document.addEventListener('play', onOtherMediaChange, true);
  document.addEventListener('volumechange', onOtherMediaChange, true);
  document.addEventListener('pause', onOtherMediaStop, true);
  document.addEventListener('ended', onOtherMediaStop, true);
}

export function subscribeBgm(listener: () => void): () => void {
  ensureInit();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getBgmSnapshot(): BgmState {
  ensureInit();
  return state;
}

/** 재생 칸 둘을 만든다. 첫 재생(방문자의 누름) 때 만들어야 AudioContext가 바로 소리를 낸다. */
function ensureDecks(): [Deck, Deck] {
  if (decks) return decks;
  const AudioContextCtor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (AudioContextCtor) {
    audioContext = new AudioContextCtor();
    masterGain = audioContext.createGain();
    masterGain.gain.value = state.volume;
    masterGain.connect(audioContext.destination);
  }
  const makeDeck = (index: number): Deck => {
    const audio = new Audio();
    // 음원은 샘플 사이트(다른 출처)에서 받는다. CORS로 받아야 Web Audio 음량 조절에 소리가 실린다
    // (없으면 MediaElementSource가 무음을 낸다). 샘플 사이트가 Access-Control-Allow-Origin: *를 준다.
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    let gain: GainNode | null = null;
    if (audioContext && masterGain) {
      gain = audioContext.createGain();
      gain.gain.value = 0;
      audioContext.createMediaElementSource(audio).connect(gain).connect(masterGain);
    } else {
      audio.volume = 0;
    }
    const deck: Deck = { audio, gain, trackId: null, level: 0, rampTimer: 0, stopTimer: 0 };
    audio.addEventListener('timeupdate', () => maybeAdvance(index));
    audio.addEventListener('ended', () => {
      if (index === activeDeck && state.status === 'playing') next();
    });
    audio.addEventListener('error', () => {
      if (index === activeDeck && state.status === 'playing') emit({ status: 'paused' });
    });
    return deck;
  };
  decks = [makeDeck(0), makeDeck(1)];
  return decks;
}

/** 칸의 소리 크기를 seconds초 동안 to(0~1)로 옮긴다. */
function fade(deck: Deck, to: number, seconds: number): void {
  if (deck.gain && audioContext) {
    const param = deck.gain.gain;
    const now = audioContext.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(to, now + seconds);
    return;
  }
  // Web Audio가 없을 때: 50ms마다 audio.volume을 옮긴다(백그라운드 탭에서도 느리게나마 진행된다).
  window.clearInterval(deck.rampTimer);
  const from = deck.level;
  const started = performance.now();
  deck.rampTimer = window.setInterval(() => {
    const t = Math.min(1, (performance.now() - started) / (seconds * 1000));
    deck.level = from + (to - from) * t;
    deck.audio.volume = deck.level * state.volume;
    if (t >= 1) window.clearInterval(deck.rampTimer);
  }, 50);
}

/** 페이드가 끝난 뒤 칸을 멈춘다. 그 사이 칸이 다시 쓰이면 cancelStop으로 취소한다. */
function stopAfter(deck: Deck, seconds: number): void {
  window.clearTimeout(deck.stopTimer);
  deck.stopTimer = window.setTimeout(() => deck.audio.pause(), seconds * 1000 + 80);
}

function cancelStop(deck: Deck): void {
  window.clearTimeout(deck.stopTimer);
}

function load(deck: Deck, track: BgmTrack): void {
  if (deck.trackId === track.id) return;
  deck.audio.src = withBasePath(track.src);
  deck.trackId = track.id;
}

function startDeck(deck: Deck, fadeSeconds: number): void {
  cancelStop(deck);
  void audioContext?.resume();
  deck.audio.play().catch(() => emit({ status: 'paused' }));
  fade(deck, 1, fadeSeconds);
}

/** 칸을 곡 길이의 ratio(0~1) 자리로 옮긴다. 길이를 아직 모르면 길이를 알게 된 뒤에 옮긴다. */
function seekRatio(deck: Deck, ratio: number): void {
  const audio = deck.audio;
  if (ratio <= 0) {
    audio.currentTime = 0;
    return;
  }
  const apply = () => {
    if (Number.isFinite(audio.duration)) audio.currentTime = Math.min(ratio, 0.99) * audio.duration;
  };
  if (Number.isFinite(audio.duration)) apply();
  else audio.addEventListener('loadedmetadata', apply, { once: true });
}

/** 칸에서 지금 재생 위치의 비율(0~1)이다. 길이를 모르면 0이다. */
function positionRatio(deck: Deck): number {
  const { duration, currentTime } = deck.audio;
  return Number.isFinite(duration) && duration > 0 ? currentTime / duration : 0;
}

/** 재생 중인 칸에서 다른 칸으로 곡을 겹쳐 넘긴다. startRatio를 주면 그 비율 자리에서 시작한다. */
function crossfadeTo(track: BgmTrack, seconds = CROSSFADE_S, startRatio = 0): void {
  const [from, to] = activeDeck === 0 ? ensureDecks() : [ensureDecks()[1], ensureDecks()[0]];
  load(to, track);
  seekRatio(to, startRatio);
  startDeck(to, seconds);
  fade(from, 0, seconds);
  stopAfter(from, seconds);
  activeDeck = 1 - activeDeck;
  advancing = false;
  emit({ status: 'playing', trackId: track.id });
}

function maybeAdvance(index: number): void {
  if (index !== activeDeck || state.status !== 'playing' || advancing) return;
  const { duration, currentTime } = ensureDecks()[index].audio;
  if (Number.isFinite(duration) && duration > CROSSFADE_S * 2 && duration - currentTime <= CROSSFADE_S) {
    advancing = true;
    next();
  }
}

/** 곡을 튼다. trackId를 주면 그 곡으로, 없으면 고른 곡(없으면 첫 곡)으로. 판은 지금 고른 판이다. */
export function play(trackId?: string): void {
  ensureInit();
  const tracks = currentTracks();
  if (tracks.length === 0) return;
  const songId = bgmSongIdOf(trackId ?? state.trackId);
  const target = tracks.find((track) => track.songId === songId) ?? tracks[0];
  const deck = ensureDecks()[activeDeck];
  if (state.status === 'playing') {
    if (target.id !== state.trackId) crossfadeTo(target);
    return;
  }
  if (deck.trackId !== target.id) {
    load(deck, target);
    // 멈춘 동안 같은 곡의 판만 바꿨으면 멈춘 자리에서 이어 간다.
    seekRatio(deck, target.id === state.trackId ? resumeRatio : 0);
  }
  resumeRatio = 0;
  startDeck(deck, FADE_IN_S);
  emit({ status: 'playing', trackId: target.id });
}

export function pause(): void {
  if (!decks || (state.status !== 'playing' && state.status !== 'ducked')) return;
  const deck = decks[activeDeck];
  fade(deck, 0, FADE_OUT_S);
  stopAfter(deck, FADE_OUT_S);
  emit({ status: 'paused' });
}

export function togglePlay(): void {
  if (state.status === 'playing' || state.status === 'ducked') pause();
  else play();
}

/** 다음 곡으로 넘긴다. 재생 중이면 크로스페이드, 아니면 고른 곡만 바꾼다. */
export function next(): void {
  const tracks = currentTracks();
  if (tracks.length === 0) return;
  const songId = bgmSongIdOf(state.trackId);
  const index = tracks.findIndex((track) => track.songId === songId);
  const target = tracks[(index + 1) % tracks.length];
  if (state.status === 'playing') crossfadeTo(target);
  else emit({ trackId: target.id });
}

export function setVolume(volume: number): void {
  const value = normalizeBgmVolume(volume);
  if (masterGain && audioContext) {
    masterGain.gain.setTargetAtTime(value, audioContext.currentTime, 0.05);
  } else if (decks) {
    for (const deck of decks) deck.audio.volume = deck.level * value;
  }
  writeStorage(VOLUME_STORAGE_KEY, String(value));
  emit({ volume: value });
}

/**
 * 판(악기·오르골)을 고른다. 고른 곡은 그대로 두고 그 곡의 다른 판으로 바꾼다.
 * 재생 중이면 같은 비율 자리에서 짧게 크로스페이드하고, 멈춘 동안이면 다음 재생 때 그 자리에서 이어 간다.
 */
export function setVersion(version: BgmVersion): void {
  if (version === state.version) return;
  writeStorage(VERSION_STORAGE_KEY, version);
  const ratio = decks ? positionRatio(decks[activeDeck]) : 0;
  const songId = bgmSongIdOf(state.trackId);
  emit({ version });
  const target = currentTracks().find((track) => track.songId === songId);
  if (!target) return;
  if (state.status === 'playing') {
    crossfadeTo(target, VERSION_SWITCH_S, ratio);
    return;
  }
  resumeRatio = state.status === 'paused' || state.status === 'ducked' ? ratio : 0;
  emit({ trackId: target.id });
}

/**
 * 설정 초기화에서 쓴다. 저장한 음량과 판을 지우고 기본값으로 되돌린다.
 * 재생 여부는 저장하지 않는 값이라 그대로 둔다(재생 중이면 기본 음량·판으로 이어진다).
 */
export function resetBgmPreferences(): void {
  ensureInit();
  setVersion(DEFAULT_BGM_VERSION);
  setVolume(normalizeBgmVolume(null));
  removeStorage(VERSION_STORAGE_KEY);
  removeStorage(VOLUME_STORAGE_KEY);
}

function onSeasonChange(): void {
  const season = document.documentElement.dataset.season ?? 'none';
  if (season === state.season) return;
  emit({ season });
  if (currentTracks().length === 0) {
    pause();
    emit({ status: 'idle', trackId: null });
  }
}

/** 문서 안에서 소리가 나는(음소거가 아닌) 다른 미디어가 재생 중인지 본다. */
function otherMediaAudible(): boolean {
  return Array.from(document.querySelectorAll<HTMLMediaElement>('audio, video')).some(
    (media) => !media.paused && !media.ended && !media.muted && media.volume > 0,
  );
}

function onOtherMediaChange(event: Event): void {
  const media = event.target;
  if (!(media instanceof HTMLMediaElement) || state.status !== 'playing' || !decks) return;
  if (media.paused || media.muted || media.volume === 0) return;
  const deck = decks[activeDeck];
  fade(deck, 0, DUCK_OUT_S);
  stopAfter(deck, DUCK_OUT_S);
  emit({ status: 'ducked' });
}

function onOtherMediaStop(event: Event): void {
  if (!(event.target instanceof HTMLMediaElement) || state.status !== 'ducked' || !decks) return;
  // 다른 미디어가 이어서 재생되는 순간(곡 바꾸기 등)을 기다렸다가 판단한다.
  window.setTimeout(() => {
    if (state.status !== 'ducked' || otherMediaAudible() || !decks) return;
    const deck = decks[activeDeck];
    // 줄어 있는 동안 판을 바꿨으면 새 판을 같은 자리에서 튼다.
    const target = currentTracks().find((track) => track.id === state.trackId);
    if (target && deck.trackId !== target.id) {
      load(deck, target);
      seekRatio(deck, resumeRatio);
      resumeRatio = 0;
    }
    startDeck(deck, DUCK_IN_S);
    emit({ status: 'playing' });
  }, 250);
}
