'use client';

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { agentExperiments, type AgentExperiment } from '@/data/agentExperiments';
import { AGENT_EXPERIMENT_CATEGORY_ANCHORS, AGENT_EXPERIMENT_INTRO_ANCHOR, agentExperimentForAnchor } from '@/data/agentExperimentNavigation';
import { CHAT_ACTION_TARGET_ARRIVED_EVENT } from '@/features/chat/navigation';
import ProjectMediaCarousel from './ProjectMediaCarousel';
import styles from './AgentExperimentGallery.module.css';

// 탭, 슬라이드, 직접 링크 모두 동일한 노출 목록을 사용한다.
const visibleExperiments = agentExperiments.filter((item) => !item.hidden);
const categories = [...new Set(visibleExperiments.map((item) => item.category))];
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

function ExperimentMediaBlock({ title, hideTitle = false, eyebrow, description, credits, children }: {
  title: string;
  hideTitle?: boolean;
  eyebrow?: string;
  description?: string;
  credits?: AgentExperiment['modelCredits'];
  children: ReactNode;
}) {
  return (
    <section className={styles.mediaBlock} aria-label={title}>
      <header className={styles.mediaHeader}>
        {eyebrow && <p className={styles.mediaEyebrow}>{eyebrow}</p>}
        {!hideTitle && <h4>{title}</h4>}
        {description && <p>{description}</p>}
        {credits?.length ? (
          <dl className={styles.mediaCredits} aria-label={`${title} 제작 모델`}>
            {credits.map((credit) => (
              <div key={credit.purpose ?? 'models'}>
                <dt>{credit.purpose ?? '제작 모델'}</dt>
                <dd>{credit.models.join(' · ')}{credit.via && <small>{credit.via}를 통해 제작</small>}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </header>
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
        projectTitle={title}
        imageSizes="(max-width: 900px) calc(100vw - 72px), 900px"
        onActiveIndexChange={setImageIndex}
      />
    </ExperimentMediaBlock>
  );
}

/** 자동 재생 없이 실험을 탐색하고, 모델 비교는 같은 화면에서 확인하는 갤러리다. */
export default function AgentExperimentGallery() {
  const [category, setCategory] = useState<(typeof categories)[number]>(visibleExperiments[0]?.category ?? 'SVG 제작');
  const [selectedId, setSelectedId] = useState(visibleExperiments[0]?.id ?? '');
  const [selectedModel, setSelectedModel] = useState(0);
  const [filterIndicator, setFilterIndicator] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const filterListRef = useRef<HTMLDivElement | null>(null);
  const filterButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const experiments = visibleExperiments.filter((item) => item.category === category);
  const index = Math.max(0, experiments.findIndex((item) => item.id === selectedId));
  const active = experiments[index];

  useLayoutEffect(() => {
    const list = filterListRef.current;
    const button = filterButtonRefs.current.get(category);
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
  }, [category]);

  useEffect(() => {
    const selectHashExperiment = () => {
      let hash = '';
      try {
        hash = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return;
      }
      const target = agentExperimentForAnchor(visibleExperiments, hash);
      if (!target) return;
      setCategory(target.category);
      setSelectedId(target.id);
      setSelectedModel(0);
    };
    selectHashExperiment();
    window.addEventListener('hashchange', selectHashExperiment);
    // 수동으로 다른 탭을 연 뒤 같은 '현재 장소'로 돌아와도 분류를 복원한다.
    window.addEventListener(CHAT_ACTION_TARGET_ARRIVED_EVENT, selectHashExperiment);
    return () => {
      window.removeEventListener('hashchange', selectHashExperiment);
      window.removeEventListener(CHAT_ACTION_TARGET_ARRIVED_EVENT, selectHashExperiment);
    };
  }, []);

  if (!active) return null;

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
    <section id="agent-experiments" className={styles.section} aria-labelledby="agent-experiments-heading">
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>AI EXPERIMENTS</p>
          <h3 id="agent-experiments-heading">AI 에이전트 성능·활용 실험</h3>
          <div id={AGENT_EXPERIMENT_INTRO_ANCHOR} tabIndex={-1} className={styles.introPanel}>
            <p className={styles.intro}>AI 활용과 모델 성능 벤치마킹을 취미로 삼아 다양한 실험을 하고 있습니다. 모델마다 무엇을 어느 수준까지 해낼 수 있는지 직접 확인하고, 새로운 작업에 활용해 보는 과정에서 나온 결과물들을 이곳에 모았습니다. SVG 애니메이션부터 게임, Blender 모델링, 이미지·영상 생성까지 여러 영역을 탐색하고 있습니다.</p>
            <p className={styles.intro}>개발을 중심으로 경험을 쌓아 온 만큼, 디자인과 시각적 표현은 상대적으로 익숙하지 않은 영역이었습니다. 하지만 AI와 함께 작업하면서 혼자서는 구현하기 어려웠던 아이디어를 구체화하고, 부족했던 부분을 보완할 수 있다는 가능성을 느꼈습니다. 그 가능성을 실제 작업으로 연결하려면 모델이 잘하는 일과 한계를 이해하는 것이 중요하다고 생각합니다. 다양한 과제를 직접 시도하며, 작업과 상황에 따라 어떤 맥락을 어떻게 제공해야 원하는 결과에 가까워지는지 알아가고 있습니다.</p>
          </div>
        </div>
      </header>

      <div className={styles.toolbar}>
        <div ref={filterListRef} className={styles.filters} role="group" aria-label="실험 분류">
          {filterIndicator && <span className={styles.filterIndicator} aria-hidden="true" style={{
            width: filterIndicator.width,
            height: filterIndicator.height,
            transform: `translate3d(${filterIndicator.x}px, ${filterIndicator.y}px, 0)`,
          }} />}
          {categories.map((value) => (
            <button key={value} id={AGENT_EXPERIMENT_CATEGORY_ANCHORS[value]} ref={(button) => {
              if (button) filterButtonRefs.current.set(value, button);
              else filterButtonRefs.current.delete(value);
            }} type="button" aria-pressed={category === value} onClick={() => {
              setCategory(value);
              setSelectedId(visibleExperiments.find((item) => item.category === value)!.id);
              setSelectedModel(0);
            }}>{value === 'Blender 3D 에셋 제작' ? 'Blender' : value}</button>
          ))}
        </div>
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
        <article key={active.id} className={styles.slide} aria-label={active.title}>
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
              <ExperimentMediaBlock title={active.title} hideTitle credits={active.modelCredits}>
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
              {active.imageGroups.map((group) => (
                <ExperimentMediaBlock key={group.title} title={group.title} description={group.description} credits={group.modelCredits}>
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
            <div className={styles.mediaPair}>
              <ExperimentMediaBlock title="생성 이미지" credits={active.modelCredits?.filter((credit) => credit.purpose === '이미지' || credit.purpose === '워크플로우와 프롬프트')}>
                <ProjectMediaCarousel
                  className={styles.experimentCarousel}
                  gallery={{ images: active.images, placeholder: `${active.title} 이미지 준비 중` }}
                  projectTitle={active.title}
                  imageSizes="(max-width: 900px) calc(100vw - 72px), 450px"
                />
              </ExperimentMediaBlock>
              <ExperimentMediaBlock title="5초 생성 영상" credits={active.modelCredits?.filter((credit) => credit.purpose === '영상' || credit.purpose === '워크플로우와 프롬프트')}>
                <ExperimentVideo title={active.title} video={active.video} />
              </ExperimentMediaBlock>
            </div>
          ) : (
            <div className={styles.mediaStack}>
              {active.video ? (
                <ExperimentMediaBlock title="영상" credits={active.modelCredits}>
                  <ExperimentVideo title={active.title} video={active.video} />
                </ExperimentMediaBlock>
              ) : active.images?.length ? (
                <ExperimentImageBlock
                  title={active.title}
                  mediaTitle={active.category === 'Blender 3D 에셋 제작' ? '3D 모델링 결과' : active.category === 'SVG 제작' ? 'SVG 제작 결과' : '게임 플레이 캡처'}
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
          <div className={styles.caption}>
            <div className={styles.description}>
              <p className={styles.eyebrow}>{active.category}</p>
              <h4>{active.title}</h4>
              <p>{active.description}</p>
              <ul className={styles.tags}>{active.focus.map((focus) => <li key={focus}>{focus}</li>)}</ul>
            </div>
            <div className={styles.details}>
              {active.modelCredits?.length ? (
                <dl aria-label="사용 모델">
                  {active.modelCredits.map((credit) => (
                    <div key={credit.purpose ?? 'models'}>
                      <dt>{credit.purpose ?? '사용 모델'}</dt>
                      <dd>
                        {credit.models.join(' · ')}
                        {credit.via && <small className={styles.modelVia}>{credit.via}를 통해 제작</small>}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
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
