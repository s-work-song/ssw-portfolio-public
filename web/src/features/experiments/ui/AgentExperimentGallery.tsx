'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { agentExperimentDrafts, agentExperiments, type AgentExperiment } from '@/features/experiments/data/agentExperiments';
import {
  AGENT_EXPERIMENT_CATEGORY_ANCHORS, AGENT_EXPERIMENT_CATEGORY_TAB_LABELS, AGENT_EXPERIMENT_GROUPS, AGENT_EXPERIMENT_INTRO_ANCHOR,
  AGENT_EXPERIMENT_SHOWCASE, agentExperimentForAnchor,
} from '@/features/experiments/data/agentExperimentNavigation';
import { CHAT_ACTION_TARGET_PREPARE_EVENT, type ChatActionTargetPrepareDetail } from '@/features/chat/navigation';
import LogReadingLink from '@/features/logs/navigation/LogReadingLink';
import ProjectMediaCarousel from '../../projects/ui/ProjectMediaCarousel';
import { creditsWithoutTitleRepeat, imageWithoutRepeatedCaption, mergeModelCredits, type DisplayModelCredit } from './experimentPresentation';
import { audioPreviewSource, formatAudioPreviewDuration, groupAudioPreviews, pauseAndResetAudioPreview } from '../audio/experimentAudioPreview';
import styles from './AgentExperimentGallery.module.css';

// 탭, 슬라이드, 직접 링크 모두 동일한 노출 목록을 사용한다. 초안은 로컬 개발 서버에서만 섞는다.
const visibleExperiments = [
  ...agentExperiments,
  ...(process.env.NODE_ENV === 'development' ? agentExperimentDrafts : []),
].filter((item) => !item.hidden);
const visibleCategories = new Set(visibleExperiments.map((item) => item.category));
// 공개 작품이 없는 분류·대분류는 탭을 만들지 않는다.
const groups = AGENT_EXPERIMENT_GROUPS
  .map((group) => ({ ...group, categories: group.categories.filter((value) => visibleCategories.has(value)) }))
  .filter((group) => group.categories.length > 0);
type Category = AgentExperiment['category'];
// 처음 화면은 첫 대분류의 첫 작품을 보여 준다.
const initialExperiment = visibleExperiments.find((item) => item.category === groups[0]?.categories[0]) ?? visibleExperiments[0];
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function CapturePlaceholder({ label, kind = 'capture' }: { label: string; kind?: 'capture' | 'image' | 'video' | 'svg-animation' }) {
  const message = kind === 'video' ? '영상 준비 중' : kind === 'svg-animation' ? 'SVG 애니메이션 준비 중' : kind === 'image' ? '사진 준비 중' : '결과 캡처 준비 중';
  return (
    <div className={styles.capture} aria-label={`${label} ${message}`}>
      {kind === 'video' ? (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="m10 8 6 4-6 4z" />
        </svg>
      ) : (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8" cy="9" r="1.5" />
          <path d="m3 17 5-5 4 4 4-6 5 7" />
        </svg>
      )}
      <span>{message}</span>
      <small>{label}</small>
    </div>
  );
}

function ExperimentDownload({ title }: { title: string }) {
  return (
    <div className={styles.videoActions}>
      <button type="button" className={styles.videoDownload} disabled title="영상 다운로드는 현재 비활성화되어 있습니다." aria-label={`${title} MP4 다운로드`}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="5" y="10" width="14" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          <path d="M12 14v3" />
        </svg>
        MP4 다운로드 <span className={styles.downloadLocked}>잠김</span>
      </button>
    </div>
  );
}

function ExperimentVideo({ title, video }: { title: string; video: NonNullable<AgentExperiment['video']> }) {
  return (
    <div className={styles.videoFrame}>
      <video
        className={styles.videoPlayer}
        controls
        playsInline
        preload="none"
        poster={video.poster ? `${basePath}${video.poster}` : undefined}
        aria-label={`${title} 영상`}
        onPlay={(event) => {
          const currentVideo = event.currentTarget;
          currentVideo.closest('article')?.querySelectorAll('video').forEach((otherVideo) => {
            if (otherVideo !== currentVideo) otherVideo.pause();
          });
        }}
      >
        <source src={`${basePath}${video.src}`} type="video/mp4" />
        브라우저에서 MP4 영상을 재생할 수 없습니다.
      </video>
      {video.caption && <p className={styles.videoCaption}>{video.caption}</p>}
      {video.downloadName && (
        <ExperimentDownload title={title} />
      )}
    </div>
  );
}

function ExperimentHtmlPreview({ title, preview }: { title: string; preview: NonNullable<AgentExperiment['htmlPreview']> }) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(800);

  useEffect(() => {
    // iframe 바깥의 사이트 클릭도 작품 내부의 열린 패널에 전달한다.
    const dismissPanels = () => frameRef.current?.contentWindow?.postMessage({ type: 'ssw:html-preview:dismiss-panels' }, '*');
    document.addEventListener('pointerdown', dismissPanels);
    return () => document.removeEventListener('pointerdown', dismissPanels);
  }, []);

  useEffect(() => {
    if (preview.layout === 'viewport') return;
    const resize = (event: MessageEvent) => {
      // sandbox의 불투명 출처와 현재 프레임에서 보낸 크기 정보만 수신한다.
      if (event.source !== frameRef.current?.contentWindow || event.origin !== 'null') return;
      const data = event.data;
      if (!data || data.type !== 'ssw:html-preview:size' || typeof data.height !== 'number' || !Number.isFinite(data.height)) return;
      // iframe의 위아래 1px 테두리까지 포함해 내부 스크롤바를 방지한다.
      setHeight(Math.min(2200, Math.max(240, Math.ceil(data.height) + 2)));
    };
    window.addEventListener('message', resize);
    return () => window.removeEventListener('message', resize);
  }, [preview.layout]);

  return (
    <div className={styles.htmlPreview}>
      <iframe
        ref={frameRef}
        className={`${styles.htmlPlayer} ${preview.layout === 'viewport' ? styles.htmlViewportPlayer : ''}`}
        src={`${basePath}${preview.src}`}
        title={`${title} HTML 재생`}
        style={preview.layout === 'viewport' ? undefined : { height }}
        sandbox="allow-scripts"
        allow="fullscreen"
        allowFullScreen
        referrerPolicy="no-referrer"
        loading="lazy"
        onLoad={() => {
          if (preview.layout !== 'viewport') frameRef.current?.contentWindow?.postMessage({ type: 'ssw:html-preview:measure' }, '*');
        }}
      />
      {preview.download && (
        <ExperimentDownload title={title} />
      )}
    </div>
  );
}

function ExperimentModelCredits({ title, credits }: { title: string; credits?: DisplayModelCredit[] }) {
  if (!credits?.length) return null;
  return (
    <dl className={styles.mediaCredits} aria-label={`${title} 제작 모델`}>
      {credits.map((credit) => (
        <div key={`${credit.purpose ?? 'models'}-${credit.models.join('|')}-${credit.via ?? ''}`}>
          <dt>{credit.purpose ?? '제작 모델'}</dt>
          <dd>{credit.models.join(' · ')}{credit.via && <small>{credit.via}를 통해 제작</small>}</dd>
        </div>
      ))}
    </dl>
  );
}

function ExperimentMediaBlock({ title, hideTitle = false, eyebrow, description, credits, children }: {
  title: string;
  hideTitle?: boolean;
  eyebrow?: string;
  description?: string;
  credits?: DisplayModelCredit[];
  children: ReactNode;
}) {
  return (
    <section className={styles.mediaBlock} aria-label={title}>
      {(!hideTitle || eyebrow || description || credits?.length) ? <header className={styles.mediaHeader}>
        {eyebrow && <p className={styles.mediaEyebrow}>{eyebrow}</p>}
        {!hideTitle && <h4>{title}</h4>}
        {description && <p>{description}</p>}
        <ExperimentModelCredits title={title} credits={credits} />
      </header> : null}
      {children}
    </section>
  );
}

function ExperimentAudio({ title, audio }: { title: string; audio: NonNullable<AgentExperiment['audio']> }) {
  const playerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const player = playerRef.current;
    return () => { player?.pause(); };
  }, []);

  return (
    <section className={styles.audioPanel} aria-label={`${title} BGM`}>
      <div className={styles.audioInfo}>
        <p className={styles.eyebrow}>GAME BGM</p>
        <h4>{audio.title}</h4>
        <p>{audio.caption}</p>
        <p className={styles.audioCredit}>{audio.model}{audio.via ? ` · ${audio.via}를 통해 제작` : ''}</p>
      </div>
      <audio ref={playerRef} className={styles.audioPlayer} controls preload="none" aria-label={`${audio.title} BGM 재생`}>
        <source src={`${basePath}${audio.src}`} type="audio/mpeg" />
        브라우저에서 MP3 음원을 재생할 수 없습니다.
      </audio>
    </section>
  );
}

function ExperimentAudioPreviews({ title, previews }: { title: string; previews: NonNullable<AgentExperiment['audioPreviews']> }) {
  const [selectedSrc, setSelectedSrc] = useState(previews[0]?.src ?? '');
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const selected = previews.find((preview) => preview.src === selectedSrc) ?? previews[0];

  useEffect(() => {
    const player = playerRef.current;
    return () => { player?.pause(); };
  }, [selected?.src]);

  if (!selected) return null;

  return (
    <section className={styles.audioPreviews} aria-label={`${title} 음원 프리뷰`}>
      <header className={styles.audioPreviewHeader}>
        <p className={styles.eyebrow}>GAME MUSIC PREVIEWS</p>
        <h4>음원 프리뷰</h4>
        <p>곡을 선택한 뒤 재생 버튼을 눌러 들어 보세요. 다른 곡을 선택하면 재생을 멈추고 처음부터 준비합니다.</p>
      </header>
      <div className={styles.audioAlbums}>
        {groupAudioPreviews(previews).map(({ album, tracks }) => (
          <fieldset key={album} className={tracks.length > 3 ? `${styles.audioAlbum} ${styles.audioAlbumWide}` : styles.audioAlbum}>
            <legend>{album}</legend>
            <div className={styles.audioTracks}>
              {tracks.map((track) => (
                <button key={track.src} type="button" aria-pressed={selected.src === track.src}
                  aria-label={`${album} 앨범 · ${track.title} · ${formatAudioPreviewDuration(track.durationSeconds)} 프리뷰 선택`}
                  onClick={() => {
                    pauseAndResetAudioPreview(playerRef.current);
                    setSelectedSrc(track.src);
                  }}>
                  <span>{track.title}</span>
                  <span className={styles.audioTrackDuration}>{formatAudioPreviewDuration(track.durationSeconds)}</span>
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <div className={styles.audioPreviewPlayback}>
        <p className={styles.audioPreviewSelection} aria-live="polite" aria-atomic="true">
          <strong>{selected.title}</strong>
          <span>{selected.album} · 프리뷰 {formatAudioPreviewDuration(selected.durationSeconds)}</span>
        </p>
        <audio key={selected.src} ref={playerRef} className={styles.audioPlayer} controls preload="none" controlsList="nodownload"
          aria-label={`${title} · ${selected.title} · ${selected.album} 음원 프리뷰 재생`}>
          <source src={audioPreviewSource(selected.src, basePath)} type="audio/mpeg" />
          브라우저에서 MP3 음원을 재생할 수 없습니다.
        </audio>
      </div>
    </section>
  );
}

function ExperimentImageBlock({ title, mediaTitle, images, credits }: {
  title: string;
  mediaTitle: string;
  images: NonNullable<AgentExperiment['images']>;
  credits?: AgentExperiment['modelCredits'];
}) {
  const [imageIndex, setImageIndex] = useState(0);
  const currentImage = images[imageIndex] ?? images[0];
  const imageCredit = currentImage?.modelCreditPurpose
    ? credits?.find((credit) => credit.purpose === currentImage.modelCreditPurpose)
    : undefined;

  return (
    <ExperimentMediaBlock
      title={currentImage?.title ?? mediaTitle}
      credits={imageCredit ? [{ models: imageCredit.models, via: imageCredit.via }] : credits}
    >
      <ProjectMediaCarousel
        className={styles.experimentCarousel}
        gallery={{ images, placeholder: `${title} 화면을 추가할 자리입니다.` }}
        hideInlineCaption={Boolean(currentImage && imageWithoutRepeatedCaption(currentImage, credits).caption === undefined)}
        projectTitle={title}
        imageSizes="(max-width: 900px) calc(100vw - 72px), 900px"
        onActiveIndexChange={setImageIndex}
      />
    </ExperimentMediaBlock>
  );
}

/** 대분류 설명의 `**구절**`만 굵게 바꾼다. 그 밖의 표기는 글자 그대로 둔다. */
function withEmphasis(text: string) {
  return text.split(/\*\*(.+?)\*\*/u).map((part, index) => (index % 2 ? <strong key={index}>{part}</strong> : part));
}

/** 자동 재생 없이 실험을 탐색하고, 모델 비교는 같은 화면에서 확인하는 갤러리다. */
export default function AgentExperimentGallery() {
  const [category, setCategory] = useState<Category>(initialExperiment?.category ?? 'SVG 제작');
  const [selectedId, setSelectedId] = useState(initialExperiment?.id ?? '');
  const [selectedModel, setSelectedModel] = useState(0);
  const [filterIndicator, setFilterIndicator] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const filterListRef = useRef<HTMLDivElement | null>(null);
  const filterButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const experiments = visibleExperiments.filter((item) => item.category === category);
  const index = Math.max(0, experiments.findIndex((item) => item.id === selectedId));
  const active = experiments[index];
  const activeGroup = groups.find((group) => group.categories.includes(category)) ?? groups[0];

  useLayoutEffect(() => {
    const list = filterListRef.current;
    const button = filterButtonRefs.current.get(activeGroup.label);
    if (!list || !button) return;
    const measure = () => {
      const next = { x: button.offsetLeft, y: button.offsetTop, width: button.offsetWidth, height: button.offsetHeight };
      setFilterIndicator((previous) => previous
        && previous.x === next.x && previous.y === next.y
        && previous.width === next.width && previous.height === next.height ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    observer.observe(button);
    return () => observer.disconnect();
  }, [activeGroup.label]);

  useEffect(() => {
    const selectAnchor = (anchor: string) => {
      const target = agentExperimentForAnchor(visibleExperiments, anchor);
      if (!target) return;
      setCategory(target.category);
      setSelectedId(target.id);
      setSelectedModel(0);
    };
    const selectHashExperiment = () => {
      let hash = '';
      try {
        hash = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return;
      }
      selectAnchor(hash);
    };
    const prepareExperiment = (event: Event) => {
      const request = (event as CustomEvent<ChatActionTargetPrepareDetail>).detail;
      if (typeof request?.anchor !== 'string' || request.signal?.aborted) return;
      selectAnchor(request.anchor);
    };
    selectHashExperiment();
    window.addEventListener('hashchange', selectHashExperiment);
    window.addEventListener('popstate', selectHashExperiment);
    // 도착 후 복원하면 비선택 버튼을 성공으로 오인한다. 같은 해시도 먼저 선택한다.
    window.addEventListener(CHAT_ACTION_TARGET_PREPARE_EVENT, prepareExperiment);
    return () => {
      window.removeEventListener('hashchange', selectHashExperiment);
      window.removeEventListener('popstate', selectHashExperiment);
      window.removeEventListener(CHAT_ACTION_TARGET_PREPARE_EVENT, prepareExperiment);
    };
  }, []);

  if (!active) return null;

  function chooseCategory(value: Category) {
    setCategory(value);
    setSelectedId(visibleExperiments.find((item) => item.category === value)!.id);
    setSelectedModel(0);
  }

  function select(nextIndex: number, focus = false) {
    const next = (nextIndex + experiments.length) % experiments.length;
    setSelectedId(experiments[next].id);
    setSelectedModel(0);
    // 줄바꿈 목록에서는 키보드 포커스만 옮기고 페이지 스크롤은 유지한다.
    if (focus) itemRefs.current[next]?.focus({ preventScroll: true });
  }

  function handleKey(event: KeyboardEvent<HTMLButtonElement>, itemIndex: number) {
    const next = event.key === 'ArrowRight' ? itemIndex + 1
      : event.key === 'ArrowLeft' ? itemIndex - 1
        : event.key === 'Home' ? 0
          : event.key === 'End' ? experiments.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    select(next, true);
  }

  return (
    <section id="agent-experiments" className={styles.section} aria-labelledby="agent-experiments-heading"
      data-active-experiment-id={active.id} data-active-experiment-category={active.category}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>SI EXPERIMENTS</p>
          <h3 id="agent-experiments-heading">SI 활용 실험</h3>
          <div id={AGENT_EXPERIMENT_INTRO_ANCHOR} tabIndex={-1} className={styles.introPanel}>
            <p className={styles.intro}>오픈웨이트 모델부터 프론티어 SI까지, 다양한 모델이 어떤 작업을 어느 수준까지 수행할 수 있는지 직접 실험하고 있습니다.</p>
            <p className={styles.intro}>개발을 중심으로 경험을 쌓아 온 만큼, 디자인과 시각적 표현은 상대적으로 익숙하지 않은 영역이었습니다. 하지만 SI 에이전트와 함께 작업하면서 혼자서는 구현하기 어려웠던 아이디어를 구체화하고, 부족했던 부분을 보완할 수 있다는 가능성을 느꼈습니다.</p>
            <p className={styles.intro}>그 가능성을 실제 작업으로 연결하려면 모델이 잘하는 일과 한계를 이해하는 것이 중요하다고 생각합니다. 다양한 과제를 직접 시도하며, 작업과 상황에 따라 어떤 맥락을 어떻게 제공해야 원하는 결과에 가까워지는지 알아가고 있습니다.</p>
            <div className={styles.introNote}>
              <p>여기에는 AI 슬롭이라 불릴 만한 결과물도 있습니다. 그래도 직접 만들어 봐야 알게 되는 것들이 있었습니다.</p>
              <LogReadingLink slug="thoughts-on-ai-slop" className={`${styles.introNoteLink} hover-btn-secondary`}>
                <span>AI 슬롭에 대한 생각</span>
                <span aria-hidden="true">→</span>
              </LogReadingLink>
            </div>
          </div>
        </div>
      </header>

      <article id={AGENT_EXPERIMENT_SHOWCASE.anchor} tabIndex={-1} className={styles.showcase} aria-labelledby="agent-experiments-showcase-title">
        {/* 제목 줄은 카드 전체 폭으로 둔다(사진만 위를 꽉 채워 한쪽으로 쏠려 보이지 않게). */}
        <div className={styles.showcaseHeader}>
          <p className={styles.showcaseEyebrow}>{AGENT_EXPERIMENT_SHOWCASE.eyebrow}</p>
          <h4 id="agent-experiments-showcase-title">{AGENT_EXPERIMENT_SHOWCASE.title}</h4>
        </div>
        <ProjectMediaCarousel
          className={styles.showcaseMedia}
          gallery={{ images: [...AGENT_EXPERIMENT_SHOWCASE.images], placeholder: `${AGENT_EXPERIMENT_SHOWCASE.title} 화면을 추가할 자리입니다.` }}
          projectTitle={AGENT_EXPERIMENT_SHOWCASE.title}
          imageSizes="(max-width: 900px) calc(100vw - 72px), 560px"
        />
        <div className={styles.showcaseBody}>
          {AGENT_EXPERIMENT_SHOWCASE.description.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <a className={styles.showcaseLink} href={AGENT_EXPERIMENT_SHOWCASE.url} target="_blank" rel="noopener noreferrer"
            aria-label={`${AGENT_EXPERIMENT_SHOWCASE.title} ${AGENT_EXPERIMENT_SHOWCASE.linkLabel}, 새 탭`}>
            {AGENT_EXPERIMENT_SHOWCASE.linkLabel} <span aria-hidden="true">↗</span>
          </a>
          <small>{AGENT_EXPERIMENT_SHOWCASE.note}</small>
        </div>
      </article>

      <div className={styles.toolbar}>
        <div ref={filterListRef} className={styles.filters} role="group" aria-label="실험 분류"
          style={{ '--filter-count': groups.length } as CSSProperties}>
          {filterIndicator && <span className={styles.filterIndicator} aria-hidden="true" style={{
            width: filterIndicator.width,
            height: filterIndicator.height,
            transform: `translate3d(${filterIndicator.x}px, ${filterIndicator.y}px, 0)`,
          }} />}
          {groups.map((group) => (
            // 분류가 하나뿐인 대분류는 그 분류 앵커를 그대로 써서 기존 링크·이동 계약을 유지한다.
            <button key={group.label} id={group.categories.length === 1 ? AGENT_EXPERIMENT_CATEGORY_ANCHORS[group.categories[0]] : group.anchor} ref={(button) => {
              if (button) filterButtonRefs.current.set(group.label, button);
              else filterButtonRefs.current.delete(group.label);
            }} type="button" aria-pressed={activeGroup.label === group.label} onClick={() => {
              if (activeGroup.label !== group.label) chooseCategory(group.categories[0]);
            }}>{group.label}</button>
          ))}
        </div>
        {activeGroup.categories.length > 1 && (
          <div className={styles.subFilters} role="group" aria-label={`${activeGroup.label} 하위 분류`}>
            {activeGroup.categories.map((value) => (
              <button key={value} id={AGENT_EXPERIMENT_CATEGORY_ANCHORS[value]} type="button" aria-pressed={category === value}
                onClick={() => chooseCategory(value)}>{AGENT_EXPERIMENT_CATEGORY_TAB_LABELS[value]}</button>
            ))}
          </div>
        )}
        {activeGroup.description?.length ? (
          <div className={`${styles.groupNote} ${activeGroup.notice ? styles.groupNoteStacked : ''}`}>
            <div className={styles.groupNoteText}>
              {activeGroup.description.map((paragraph) => <p key={paragraph}>{withEmphasis(paragraph)}</p>)}
              {activeGroup.notice && (
                <aside className={styles.groupNotice} aria-label={activeGroup.notice.title}>
                  <strong>{activeGroup.notice.title}</strong>
                  {activeGroup.notice.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </aside>
              )}
              {activeGroup.footnote && <small className={styles.groupNoteFootnote}>{activeGroup.footnote}</small>}
            </div>
            {activeGroup.relatedLog && (
              <LogReadingLink slug={activeGroup.relatedLog.slug} className={`${styles.introNoteLink} hover-btn-secondary`}>
                <span>{activeGroup.relatedLog.label}</span>
                <span aria-hidden="true">→</span>
              </LogReadingLink>
            )}
          </div>
        ) : null}
      </div>

      <div className={styles.experimentNavigation}>
        <div className={styles.filmstrip} role="group" aria-label="실험 바로 선택">
          {experiments.map((item, itemIndex) => (
            <button key={item.id} id={item.id} ref={(element) => { itemRefs.current[itemIndex] = element; }} type="button"
              aria-pressed={active.id === item.id} aria-controls="agent-experiment-stage"
              onClick={() => select(itemIndex)} onKeyDown={(event) => handleKey(event, itemIndex)}>
              <span className={styles.itemNumber}>{String(itemIndex + 1).padStart(2, '0')}</span>
              <span><small>{item.category}{item.models ? ' · 예정' : ''}</small><strong>{item.title}</strong></span>
              <span className={styles.itemArrow} aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
        <div className={styles.controls} role="group" aria-label="선택한 분류의 실험 탐색">
          <span aria-live="polite" aria-atomic="true">{String(index + 1).padStart(2, '0')} / {String(experiments.length).padStart(2, '0')}<span className={styles.srOnly}> · {active.title}</span></span>
          <button type="button" aria-label="이전 실험" aria-controls="agent-experiment-stage" disabled={experiments.length < 2} onClick={() => select(index - 1)}>←</button>
          <button type="button" aria-label="다음 실험" aria-controls="agent-experiment-stage" disabled={experiments.length < 2} onClick={() => select(index + 1)}>→</button>
        </div>
      </div>

      <div id="agent-experiment-stage" className={styles.stage}>
        <article key={active.id} className={styles.slide} aria-label={active.title}
          data-agent-experiment-id={active.id} data-agent-experiment-category={active.category}>
          <header className={styles.experimentHeading} data-agent-experiment-heading="true" tabIndex={-1}>
            <p className={styles.eyebrow}>{active.category}</p>
            <h4>{active.title}</h4>
          </header>
          {active.animationGroups?.length ? (
            <div className={styles.animationGroups} aria-label={`${active.title} 모델별 애니메이션 비교`}>
              {active.animationGroups.map((group) => (
                <div key={group.label} className={styles.animationGroup} role="group" aria-label={`${group.label} 모델 결과`}>
                  <p className={styles.animationGroupTitle}>{group.label}</p>
                  <div className={styles.animationCards}>
                    {group.items.map((entry, slotIndex) => (
                      <div key={entry.model ?? `${group.label}-${slotIndex}`} className={`${styles.animationCard} ${entry.model === null ? styles.animationCardEmpty : ''}`} aria-hidden={entry.model === null || undefined}>
                        {entry.model === null ? null : (
                          <>
                            <p className={styles.animationCardTitle}>{entry.model}</p>
                            {entry.image ? (
                              <ProjectMediaCarousel
                                gallery={{ images: [entry.image], placeholder: `${entry.model} SVG 애니메이션 준비 중` }}
                                projectTitle={`${active.title} · ${entry.model}`}
                                imageSizes="(max-width: 480px) 30vw, 280px"
                              />
                            ) : (
                              <CapturePlaceholder label={entry.model} kind="svg-animation" />
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : active.htmlPreview ? (
            <div className={styles.mediaStack}>
              <ExperimentMediaBlock title={active.title} hideTitle credits={creditsWithoutTitleRepeat(active.title, active.modelCredits)}>
                <ExperimentHtmlPreview title={active.title} preview={active.htmlPreview} />
              </ExperimentMediaBlock>
            </div>
          ) : active.videos?.length ? (
            <div className={styles.videoStack} aria-label={`${active.title} 모델별 영상`}>
              {active.videos.map((entry) => (
                <ExperimentMediaBlock key={entry.video.src} title={entry.model} eyebrow="제작 모델">
                  <ExperimentVideo title={`${active.title} · ${entry.model}`} video={entry.video} />
                </ExperimentMediaBlock>
              ))}
            </div>
          ) : active.imageGroups?.length ? (
            <div className={styles.mediaStack}>
              <div className={styles.sharedCredits}>
                <ExperimentModelCredits title={active.title} credits={mergeModelCredits(active.imageGroups.flatMap((group) => group.modelCredits))} />
              </div>
              {active.imageGroups.map((group) => (
                <ExperimentMediaBlock key={group.title} title={group.title} description={group.description}>
                  <ProjectMediaCarousel
                    className={styles.experimentCarousel}
                    gallery={{ images: group.images, placeholder: `${group.title} 이미지 준비 중` }}
                    projectTitle={`${active.title} · ${group.title}`}
                    imageSizes="(max-width: 900px) calc(100vw - 72px), 900px"
                  />
                </ExperimentMediaBlock>
              ))}
            </div>
          ) : active.models ? (
            <div className={styles.comparison}>
              <div className={styles.comparisonHeading}>
                <span>같은 과제, 서로 다른 결과</span>
                <span className={styles.muted}>비교 실험 예정</span>
              </div>
              <div className={styles.modelSwitcher} role="group" aria-label="비교할 모델">
                {active.models.map((model, modelIndex) => (
                  <button key={model} type="button" aria-pressed={selectedModel === modelIndex} onClick={() => setSelectedModel(modelIndex)}>{model}</button>
                ))}
              </div>
              <div className={styles.modelGrid}>
                {active.models.map((model, modelIndex) => (
                  <div key={model} className={`${styles.modelColumn} ${selectedModel === modelIndex ? styles.selectedModel : ''}`}>
                    <h4><span className={styles.modelNumber}>0{modelIndex + 1}</span>{model}</h4>
                    <CapturePlaceholder label={model} />
                    <p>구현 내용과 관찰 결과를 정리할 자리입니다.</p>
                  </div>
                ))}
              </div>
              <p className={styles.conditions}>비교 조건 · 공통 요구사항, 작업 시간·예산, 수정 지시와 리소스 사용 범위는 실험 후 정리할 예정입니다.</p>
            </div>
          ) : active.video && active.images?.length ? (
            <>
              <div className={styles.sharedCredits}>
                <ExperimentModelCredits title={active.title} credits={mergeModelCredits(active.modelCredits)} />
              </div>
              <div className={styles.mediaPair}>
                <ExperimentMediaBlock title="생성 이미지">
                  <ProjectMediaCarousel
                    className={styles.experimentCarousel}
                    gallery={{ images: active.images, placeholder: `${active.title} 이미지 준비 중` }}
                    projectTitle={active.title}
                    imageSizes="(max-width: 900px) calc(100vw - 72px), 450px"
                  />
                </ExperimentMediaBlock>
                <ExperimentMediaBlock title="5초 생성 영상">
                  <ExperimentVideo title={active.title} video={active.video} />
                </ExperimentMediaBlock>
              </div>
            </>
          ) : (
            <div className={styles.mediaStack}>
              {active.video ? (
                <ExperimentMediaBlock title="영상" credits={active.modelCredits}>
                  <ExperimentVideo title={active.title} video={active.video} />
                </ExperimentMediaBlock>
              ) : active.images?.length ? (
                <ExperimentImageBlock
                  title={active.title}
                  mediaTitle={active.category === 'Blender 3D 에셋 제작' ? '3D 모델링 결과' : active.category === 'SVG 제작' ? 'SVG 제작 결과' : active.category === 'WebGL' ? 'WebGL 실행 화면' : active.category === '앱·도구 실험' || active.category === '리깅' || active.category === '포템킨 빌리지' ? '실행 화면' : '게임 플레이 캡처'}
                  images={active.images}
                  credits={active.modelCredits?.filter((credit) => !active.audio || credit.purpose !== '배경음악')}
                />
              ) : (
                <ExperimentMediaBlock title={active.category} credits={active.modelCredits}>
                  <CapturePlaceholder label={active.title} kind={active.category === '영상물' ? 'video' : 'image'} />
                </ExperimentMediaBlock>
              )}
            </div>
          )}
          {active.audio && <ExperimentAudio title={active.title} audio={active.audio} />}
          {active.audioPreviews?.length ? <ExperimentAudioPreviews title={active.title} previews={active.audioPreviews} /> : null}
          <div className={styles.caption}>
            <div className={styles.description}>
              <p className={styles.eyebrow}>{active.category}</p>
              <p>{active.description}</p>
              {active.prompt && (
                <blockquote className={styles.prompt} aria-label="공통 프롬프트">
                  <span className={styles.promptLabel}>공통 프롬프트</span>
                  <p>{active.prompt}</p>
                </blockquote>
              )}
              {active.parody && (
                <dl className={styles.parody} aria-label="겉과 속">
                  <div><dt>겉으로 보이는 것</dt><dd>{active.parody.surface}</dd></div>
                  <div><dt>실제로 되는 것</dt><dd>{active.parody.reality}</dd></div>
                </dl>
              )}
              <ul className={styles.tags}>{active.focus.map((focus) => <li key={focus}>{focus}</li>)}</ul>
            </div>
            <div className={styles.details}>
              {active.downloads?.length ? (
                <div className={styles.downloads} aria-label="Blender 파일 다운로드">
                  <p>Blender 파일 다운로드</p>
                  <div className={styles.downloadLinks}>
                    {active.downloads.map((file) => (
                      <a key={file.src} href={`${basePath}${file.src}`} download aria-label={`${file.label} Blender 파일 다운로드`}>
                        {file.label} <span aria-hidden="true">↓</span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
              {active.demoUrl && <a href={active.demoUrl} target="_blank" rel="noopener noreferrer" aria-label={`${active.title} ${active.demoLabel ?? '직접 실행'}, 새 탭`}>{active.demoLabel ?? '직접 실행'} <span aria-hidden="true">↗</span></a>}
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
