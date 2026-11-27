'use client';

/**
 * 머리글의 배경음악(BGM) 단추다. 지금 시즌 테마에 곡이 있을 때만 보인다(지금은 크리스마스).
 *
 * 왼쪽 단추는 바로 재생·일시 정지, 오른쪽 작은 단추는 패널을 연다. 패널에는 지금 곡, 다음 곡,
 * 음량, 판 선택(악기·오르골), 곡 목록이 있다. 목록은 곡 단위이고 판은 따로 고른다(샘플 사이트 캐럴 재생기와 같은 방식). 재생 자체는 bgmPlayer(모듈 싱글턴)가 맡으므로
 * 이 부품이 사라져도(다른 화면으로 옮겨도) 소리는 이어진다.
 */
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import {
  BGM_SERVER_STATE,
  getBgmSnapshot,
  next,
  play,
  setVersion,
  setVolume,
  subscribeBgm,
  togglePlay,
} from '../bgmPlayer';
import {
  BGM_VERSION_LABELS,
  BGM_VERSION_SHORT_LABELS,
  bgmSongIdOf,
  bgmTracksFor,
  bgmVersionsFor,
  type BgmVersion,
} from '../bgmPlaylist';
import styles from './BgmControl.module.css';

/** 판마다 만든 방식 한 문장이다. 목록에 있는 판만 출처 문구에 붙인다. */
const VERSION_CREDITS: Record<BgmVersion, string> = {
  instrument: '악기판은 FluidSynth와 GeneralUser GS 음색으로 렌더링했습니다.',
  musicbox: '오르골판은 샘플 없이 Python으로 직접 합성했습니다.',
};

export default function BgmControl() {
  const bgm = useSyncExternalStore(subscribeBgm, getBgmSnapshot, () => BGM_SERVER_STATE);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const tracks = bgmTracksFor(bgm.season, bgm.version);
  if (tracks.length === 0) return null;

  const versions = bgmVersionsFor(bgm.season);
  const showVersions = versions.length > 1;
  const currentSongId = bgmSongIdOf(bgm.trackId);
  const current = tracks.find((track) => track.songId === currentSongId) ?? null;
  const playing = bgm.status === 'playing';
  const ducked = bgm.status === 'ducked';
  const stateText = playing ? '재생 중' : ducked ? '다른 소리 재생 중이라 잠시 멈춤' : bgm.status === 'paused' ? '일시 정지' : '꺼짐';

  return (
    <div ref={rootRef} className={styles.root}>
      <div className={styles.pill} data-playing={playing || ducked ? 'true' : undefined}>
        <button
          type="button"
          className={styles.playButton}
          onClick={togglePlay}
          aria-pressed={playing || ducked}
          aria-label={playing || ducked ? '배경음악 일시 정지' : '배경음악 재생'}
          title={playing || ducked ? '배경음악 일시 정지' : '배경음악 재생'}
        >
          {playing ? (
            <span className={styles.eq} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className={styles.moreButton}
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label="배경음악 목록과 음량"
          title="배경음악 목록과 음량"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {open && (
        <div id={panelId} className={styles.panel} role="dialog" aria-label="배경음악">
          <div className={styles.nowPlaying}>
            <p className={styles.eyebrow}>배경음악 · 크리스마스</p>
            <p className={styles.title}>
              {current ? current.title : '곡을 골라 주세요'}
              {current && <span className={styles.version}>{BGM_VERSION_LABELS[current.version]}</span>}
            </p>
            {current && (
              <p className={styles.original} lang="en">
                {current.originalTitle}
              </p>
            )}
            <p className={styles.state} aria-live="polite">{stateText}</p>
          </div>

          <div className={styles.controls}>
            <button type="button" className={styles.controlButton} onClick={togglePlay}>
              {playing || ducked ? '일시 정지' : '재생'}
            </button>
            <button type="button" className={styles.controlButton} onClick={next} disabled={tracks.length < 2}>
              다음 곡
            </button>
          </div>

          <label className={styles.volume}>
            <span>음량</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(bgm.volume * 100)}
              onChange={(event) => setVolume(Number(event.target.value) / 100)}
              aria-label="배경음악 음량"
            />
          </label>

          {/* 판 선택: 곡은 그대로 두고 악기·오르골만 바꾼다. 재생 중이면 같은 자리에서 이어진다. */}
          {showVersions && (
            <div role="radiogroup" aria-label="판 선택" className={styles.filters}>
              {versions.map((version) => (
                <button
                  key={version}
                  type="button"
                  role="radio"
                  aria-checked={bgm.version === version}
                  aria-label={BGM_VERSION_LABELS[version]}
                  title={BGM_VERSION_LABELS[version]}
                  className={styles.filter}
                  onClick={() => setVersion(version)}
                >
                  {BGM_VERSION_SHORT_LABELS[version]}
                </button>
              ))}
            </div>
          )}

          <ol className={styles.tracks}>
            {tracks.map((track) => (
              <li key={track.songId}>
                <button
                  type="button"
                  className={styles.track}
                  aria-current={track.songId === currentSongId ? 'true' : undefined}
                  onClick={() => play(track.id)}
                >
                  <span>{track.title}</span>
                  <span className={styles.trackOriginal} lang="en">
                    {track.originalTitle}
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <p className={styles.credit}>
            퍼블릭 도메인 캐럴을 직접 편곡했습니다. {versions.map((version) => VERSION_CREDITS[version]).join(' ')}{' '}
            다른 음원이나 영상을 재생하면 잠시 줄었다가 끝나면 다시 이어집니다.
          </p>
        </div>
      )}
    </div>
  );
}
