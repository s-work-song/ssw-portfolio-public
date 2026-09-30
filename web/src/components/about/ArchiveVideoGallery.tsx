'use client';

import Image from 'next/image';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Swiper as SwiperInstance } from 'swiper';
import { A11y } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import type {
  AboutArchiveProjectVideo,
  AboutProjectImage,
} from '@/data/about';
import { useMediaSwiperSpeed } from './useMediaSwiperMotion';
import styles from './ArchiveVideoGallery.module.css';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const dragActivationDistance = 8;
const videoControlExclusionHeight = 64;

type ArchiveMediaItem =
  | ({ kind: 'video' } & AboutArchiveProjectVideo)
  | ({ kind: 'image' } & AboutProjectImage);

export default function ArchiveVideoGallery({
  videos,
  images = [],
  projectTitle,
  slotCount = videos.length + images.length,
}: {
  videos: AboutArchiveProjectVideo[];
  images?: AboutProjectImage[];
  projectTitle: string;
  slotCount?: number;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const swiperRef = useRef<SwiperInstance | null>(null);
  const activeIndexRef = useRef(0);
  const isOpenRef = useRef(false);
  const dragMoved = useRef(false);
  const activeTouchPointers = useRef(new Set<number>());
  const pinchActive = useRef(false);
  const suppressOverlayClose = useRef(false);
  const suppressOverlayCloseTimer = useRef<number | null>(null);
  const pinchReleaseFrame = useRef<number | null>(null);
  const videoElements = useRef(new Map<string, HTMLVideoElement>());
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const speed = useMediaSwiperSpeed();
  const mediaItems = useMemo<ArchiveMediaItem[]>(() => [
    ...images.map((image) => ({ kind: 'image' as const, ...image })),
    ...videos.map((video) => ({ kind: 'video' as const, ...video })),
  ], [images, videos]);
  const activeMedia = mediaItems[activeIndex] ?? null;
  const slots = Array.from(
    { length: Math.max(mediaItems.length, slotCount) },
    (_, index) => mediaItems[index] ?? null,
  );

  const blockAccidentalClicks = useCallback(() => {
    if (suppressOverlayCloseTimer.current !== null) {
      window.clearTimeout(suppressOverlayCloseTimer.current);
      suppressOverlayCloseTimer.current = null;
    }
    suppressOverlayClose.current = true;
  }, []);

  const suppressOverlayCloseBriefly = useCallback(() => {
    blockAccidentalClicks();
    suppressOverlayCloseTimer.current = window.setTimeout(() => {
      suppressOverlayClose.current = false;
      suppressOverlayCloseTimer.current = null;
    }, 500);
  }, [blockAccidentalClicks]);

  const closeViewer = useCallback(() => {
    isOpenRef.current = false;
    setIsOpen(false);
    dragMoved.current = false;
    setIsDragging(false);
    activeTouchPointers.current.clear();
    pinchActive.current = false;
    suppressOverlayClose.current = false;
    if (suppressOverlayCloseTimer.current !== null) {
      window.clearTimeout(suppressOverlayCloseTimer.current);
      suppressOverlayCloseTimer.current = null;
    }
    if (pinchReleaseFrame.current !== null) {
      window.cancelAnimationFrame(pinchReleaseFrame.current);
      pinchReleaseFrame.current = null;
    }
    const swiper = swiperRef.current;
    if (swiper && !swiper.destroyed) {
      swiper.allowTouchMove = false;
      swiper.allowSlideNext = true;
      swiper.allowSlidePrev = true;
    }
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
  }, []);

  const openViewer = (
    index: number,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    lastTriggerRef.current = event.currentTarget;
    activeIndexRef.current = index;
    isOpenRef.current = true;
    setActiveIndex(index);
    setHasOpened(true);
    setIsOpen(true);
  };

  const moveViewer = (direction: -1 | 1) => {
    const swiper = swiperRef.current;
    if (!swiper || swiper.destroyed || pinchActive.current) return;
    if (direction === -1) swiper.slidePrev();
    else swiper.slideNext();
  };

  const handlePointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    const video = target?.closest('video');
    if (video) {
      const isVideoControlArea = event.clientY
        >= video.getBoundingClientRect().bottom - videoControlExclusionHeight;
      // Swiper의 gesture/click 차단을 재생 컨트롤에 적용하지 않는다.
      // 영상 본문에서 시작한 다음 드래그는 이 표식을 제거해 정상 처리한다.
      video.toggleAttribute('data-swiper-native-controls', isVideoControlArea);
      if (isVideoControlArea && swiperRef.current) {
        swiperRef.current.allowTouchMove = false;
      }
    }
    if (event.pointerType !== 'touch') return;
    activeTouchPointers.current.add(event.pointerId);
    if (activeTouchPointers.current.size > 1) {
      pinchActive.current = true;
      dragMoved.current = false;
      setIsDragging(false);
      blockAccidentalClicks();
      const swiper = swiperRef.current;
      if (swiper && !swiper.destroyed) {
        // 이미 시작된 스와이프도 핀치 종료 시 다른 슬라이드로 넘어가지 않게 한다.
        swiper.allowTouchMove = false;
        swiper.allowSlideNext = false;
        swiper.allowSlidePrev = false;
      }
    }
  };

  const handlePointerEndCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') return;
    activeTouchPointers.current.delete(event.pointerId);
    if (activeTouchPointers.current.size === 0 && pinchActive.current) {
      suppressOverlayCloseBriefly();
      if (pinchReleaseFrame.current !== null) {
        window.cancelAnimationFrame(pinchReleaseFrame.current);
      }
      // Swiper가 현재 pointerup을 처리한 다음 이동 잠금을 해제한다.
      pinchReleaseFrame.current = window.requestAnimationFrame(() => {
        pinchReleaseFrame.current = null;
        pinchActive.current = false;
        const swiper = swiperRef.current;
        if (!swiper || swiper.destroyed) return;
        swiper.allowSlideNext = true;
        swiper.allowSlidePrev = true;
        swiper.slideTo(activeIndexRef.current, 0);
        swiper.allowTouchMove = isOpenRef.current && mediaItems.length > 1;
      });
    }
  };

  const handleSwiperTouchStart = (
    swiper: SwiperInstance,
    event: PointerEvent | MouseEvent | TouchEvent,
  ) => {
    const target = event.target instanceof Element ? event.target : null;
    const video = target?.closest('video');
    const clientY = 'clientY' in event ? event.clientY : event.touches[0]?.clientY;
    const isVideoControlArea = video && clientY !== undefined
      ? clientY >= video.getBoundingClientRect().bottom - videoControlExclusionHeight
      : false;
    dragMoved.current = false;
    swiper.allowTouchMove = isOpenRef.current
      && mediaItems.length > 1
      && !pinchActive.current
      && !target?.closest('button')
      && !isVideoControlArea;
  };

  const handleOverlayClick = () => {
    if (suppressOverlayClose.current) return;
    closeViewer();
  };

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => {
      const swiper = swiperRef.current;
      if (!swiper || swiper.destroyed) return;
      // 첫 오픈 뒤 숨겨서 보관한 Swiper도 재오픈한 실제 크기로 갱신한다.
      const requestedIndex = activeIndexRef.current;
      swiper.update();
      swiper.slideTo(requestedIndex, 0);
      swiper.allowTouchMove = mediaItems.length > 1;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, mediaItems.length]);

  useEffect(() => () => {
    if (suppressOverlayCloseTimer.current !== null) {
      window.clearTimeout(suppressOverlayCloseTimer.current);
    }
    if (pinchReleaseFrame.current !== null) {
      window.cancelAnimationFrame(pinchReleaseFrame.current);
    }
  }, []);

  useEffect(() => {
    mediaItems.forEach((media, index) => {
      if (media.kind !== 'video') return;

      const video = videoElements.current.get(media.src);
      if (!video) return;

      if (isOpen && activeIndex === index) {
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    });
  }, [activeIndex, isOpen, mediaItems]);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeViewer();
    };

    document.body.classList.add(styles.bodyLocked);
    window.addEventListener('keydown', closeOnEscape);
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      document.body.classList.remove(styles.bodyLocked);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [closeViewer, isOpen]);

  return (
    <>
      <div className={styles.grid} aria-label={`${projectTitle} 시연 미디어`}>
        {slots.map((media, index) => media ? (
            <figure key={`${media.kind}-${media.src}`} className={styles.figure}>
              <button
                type="button"
                className={styles.posterButton}
                onClick={(event) => openViewer(index, event)}
                aria-label={media.kind === 'video'
                  ? `${media.title} 크게 보기 및 재생`
                  : `${media.alt} 크게 보기`}
              >
                <Image
                  src={`${basePath}${media.kind === 'video' ? media.poster : media.src}`}
                  alt={media.kind === 'video' ? media.title : media.alt}
                  fill
                  sizes="(max-width: 960px) 42vw, 260px"
                  className={styles.poster}
                />
                {media.kind === 'video' && (
                  <span className={styles.playIcon} aria-hidden="true">▶</span>
                )}
              </button>
              <figcaption>{media.caption}</figcaption>
            </figure>
          ) : (
            <div
              key={`media-slot-${index}`}
              className={styles.pendingSlot}
              aria-label={`${index + 1}번째 미디어 준비 중`}
            >
              <span className={styles.pendingNumber}>{index + 1}</span>
              <strong>미디어 준비 중</strong>
            </div>
          ))}
      </div>

      {hasOpened && activeMedia && (
        <div
          className={styles.overlay}
          role="presentation"
          hidden={!isOpen}
          onClick={handleOverlayClick}
          onPointerUpCapture={handlePointerEndCapture}
          onPointerCancelCapture={handlePointerEndCapture}
        >
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.header}>
              <div>
                <span className={styles.eyebrow}>
                  {activeMedia.kind === 'video' ? 'VIDEO ARCHIVE' : 'IMAGE ARCHIVE'}
                </span>
                <h2 id={titleId}>
                  {activeMedia.kind === 'video' ? activeMedia.title : projectTitle}
                </h2>
                <p>{activeMedia.caption}</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className={styles.closeButton}
                onClick={closeViewer}
                aria-label="크게보기 닫기"
              />
            </header>
            <div
              className={`${styles.mediaViewport} ${isDragging ? styles.dragging : ''} ${activeMedia.kind === 'video' ? styles.videoViewport : ''}`}
              onPointerDownCapture={handlePointerDownCapture}
              onDragStart={(event) => event.preventDefault()}
            >
              <Swiper
                className={styles.mediaSwiper}
                modules={[A11y]}
                slidesPerView={1}
                loop={false}
                rewind={false}
                initialSlide={activeIndex}
                speed={speed}
                threshold={dragActivationDistance}
                longSwipesRatio={0.15}
                allowTouchMove={isOpen && mediaItems.length > 1}
                touchStartPreventDefault={false}
                focusableElements="input, select, option, textarea, button, label"
                noSwipingSelector="button, [data-swiper-native-controls]"
                a11y={{
                  wrapperLiveRegion: false,
                  scrollOnFocus: false,
                  slideLabelMessage: '{{index}} / {{slidesLength}}',
                }}
                role="region"
                aria-roledescription="carousel"
                aria-label={`${projectTitle} 미디어`}
                onSwiper={(swiper) => { swiperRef.current = swiper; }}
                onSlideChange={(swiper) => {
                  if (pinchActive.current) return;
                  activeIndexRef.current = swiper.realIndex;
                  setActiveIndex(swiper.realIndex);
                }}
                onTouchStart={handleSwiperTouchStart}
                onSliderFirstMove={(swiper) => {
                  if (!swiper.allowTouchMove || pinchActive.current) return;
                  dragMoved.current = true;
                  blockAccidentalClicks();
                  setIsDragging(true);
                }}
                onTouchEnd={(swiper) => {
                  if (pinchActive.current) swiper.slideTo(activeIndexRef.current, 0);
                  if (dragMoved.current) suppressOverlayCloseBriefly();
                  dragMoved.current = false;
                  setIsDragging(false);
                }}
                onBeforeDestroy={(swiper) => {
                  if (swiperRef.current === swiper) swiperRef.current = null;
                }}
              >
                {mediaItems.map((media, index) => (
                  <SwiperSlide
                    key={`viewer-${media.kind}-${media.src}`}
                    className={`${styles.mediaSlide} ${media.kind === 'video' ? styles.videoSlide : styles.imageSlide}`}
                    aria-hidden={index !== activeIndex}
                    inert={index !== activeIndex}
                  >
                    {media.kind === 'video' ? (
                      <video
                        ref={(node) => {
                          if (node) videoElements.current.set(media.src, node);
                          else videoElements.current.delete(media.src);
                        }}
                        className={styles.video}
                        controls
                        playsInline
                        preload="auto"
                        poster={`${basePath}${media.poster}`}
                        aria-label={media.title}
                        onClickCapture={(event) => {
                          if (!suppressOverlayClose.current) return;
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                      >
                        <source src={`${basePath}${media.src}`} type="video/mp4" />
                        브라우저에서 MP4 영상을 재생할 수 없습니다.
                      </video>
                    ) : (
                      <Image
                        src={`${basePath}${media.src}`}
                        alt={index === activeIndex ? media.alt : ''}
                        fill
                        draggable={false}
                        sizes="(max-width: 720px) calc(100vw - 16px), 440px"
                        className={styles.expandedImage}
                      />
                    )}
                  </SwiperSlide>
                ))}
              </Swiper>
              {mediaItems.length > 1 && (
                <>
                  <button
                    type="button"
                    className={`${styles.navButton} ${styles.previous}`}
                    onClick={() => moveViewer(-1)}
                    onPointerDown={(event) => event.stopPropagation()}
                    disabled={activeIndex === 0}
                    aria-label="이전 미디어"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className={`${styles.navButton} ${styles.next}`}
                    onClick={() => moveViewer(1)}
                    onPointerDown={(event) => event.stopPropagation()}
                    disabled={activeIndex === mediaItems.length - 1}
                    aria-label="다음 미디어"
                  >
                    ›
                  </button>
                  <span
                    className={`${styles.counter} ${activeMedia.kind === 'video' ? styles.videoCounter : ''}`}
                    aria-live="polite"
                  >
                    {activeIndex + 1} / {mediaItems.length}
                  </span>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
