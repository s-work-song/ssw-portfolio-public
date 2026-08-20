'use client';

import Image from 'next/image';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import type {
  AboutArchiveProjectVideo,
  AboutProjectImage,
} from '@/data/about';
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
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const dragMoved = useRef(false);
  const dragViewportWidth = useRef(0);
  const suppressOverlayClose = useRef(false);
  const videoElements = useRef(new Map<string, HTMLVideoElement>());
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const mediaItems = useMemo<ArchiveMediaItem[]>(() => [
    ...images.map((image) => ({ kind: 'image' as const, ...image })),
    ...videos.map((video) => ({ kind: 'video' as const, ...video })),
  ], [images, videos]);
  const activeMedia = mediaItems[activeIndex] ?? null;
  const slots = Array.from(
    { length: Math.max(mediaItems.length, slotCount) },
    (_, index) => mediaItems[index] ?? null,
  );

  const closeViewer = () => {
    setIsOpen(false);
    setDragOffset(0);
    setIsDragging(false);
    dragStartX.current = null;
    dragViewportWidth.current = 0;
    suppressOverlayClose.current = false;
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
  };

  const openViewer = (
    index: number,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    lastTriggerRef.current = event.currentTarget;
    setActiveIndex(index);
    setHasOpened(true);
    setIsOpen(true);
  };

  const moveViewer = (direction: -1 | 1) => {
    const nextIndex = Math.min(
      mediaItems.length - 1,
      Math.max(0, activeIndex + direction),
    );
    if (nextIndex === activeIndex) return;

    setDragOffset(0);
    setActiveIndex(nextIndex);
  };

  const startDrag = (
    clientX: number,
    clientY: number,
    target: EventTarget,
    viewportWidth: number,
  ) => {
    const targetElement = target as HTMLElement;
    const targetVideo = typeof targetElement.closest === 'function'
      ? targetElement.closest('video')
      : null;
    const isVideoControlArea = targetVideo
      ? clientY >= targetVideo.getBoundingClientRect().bottom - videoControlExclusionHeight
      : false;

    if (
      !isOpen
      || (typeof targetElement.closest === 'function' && targetElement.closest('button'))
      || isVideoControlArea
    ) {
      return;
    }

    dragStartX.current = clientX;
    dragViewportWidth.current = viewportWidth;
    dragMoved.current = false;
  };

  const updateDrag = (clientX: number) => {
    if (dragStartX.current === null) return false;

    const nextOffset = clientX - dragStartX.current;
    if (!dragMoved.current && Math.abs(nextOffset) <= dragActivationDistance) {
      return false;
    }
    if (!dragMoved.current) {
      dragMoved.current = true;
      setIsDragging(true);
    }
    setDragOffset(nextOffset);
    return true;
  };

  const finishDrag = (
    clientX: number,
    shouldMove: boolean,
  ) => {
    if (dragStartX.current === null) return;

    const distance = clientX - dragStartX.current;
    const threshold = Math.min(72, dragViewportWidth.current * 0.15);
    const didDrag = dragMoved.current;
    if (dragMoved.current && shouldMove && distance <= -threshold) {
      moveViewer(1);
    } else if (dragMoved.current && shouldMove && distance >= threshold) {
      moveViewer(-1);
    }

    dragStartX.current = null;
    dragViewportWidth.current = 0;
    dragMoved.current = false;
    setDragOffset(0);
    setIsDragging(false);
    if (didDrag) {
      suppressOverlayClose.current = true;
      window.setTimeout(() => {
        suppressOverlayClose.current = false;
      }, 500);
    }
  };

  const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    startDrag(
      event.clientX,
      event.clientY,
      event.target,
      event.currentTarget.clientWidth,
    );
  };

  const handleMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (updateDrag(event.clientX)) event.preventDefault();
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    startDrag(
      touch.clientX,
      touch.clientY,
      event.target,
      event.currentTarget.clientWidth,
    );
  };

  const handleTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (touch && updateDrag(touch.clientX)) event.preventDefault();
  };

  const handleTouchEnd = (
    event: ReactTouchEvent<HTMLDivElement>,
    shouldMove: boolean,
  ) => {
    const touch = event.changedTouches[0];
    finishDrag(
      touch?.clientX ?? dragStartX.current ?? 0,
      shouldMove,
    );
  };

  const handleOverlayClick = () => {
    if (suppressOverlayClose.current) return;
    closeViewer();
  };

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
  }, [isOpen]);

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
          onMouseMove={handleMouseMove}
          onMouseUp={(event) => finishDrag(event.clientX, true)}
          onMouseLeave={(event) => finishDrag(event.clientX, true)}
          onTouchMove={handleTouchMove}
          onTouchEnd={(event) => handleTouchEnd(event, true)}
          onTouchCancel={(event) => handleTouchEnd(event, false)}
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
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              onDragStart={(event) => event.preventDefault()}
            >
              <div
                className={styles.mediaTrack}
                style={{
                  transform: `translate3d(calc(${-activeIndex * 100}% + ${dragOffset}px), 0, 0)`,
                  transition: isDragging ? 'none' : undefined,
                }}
              >
                {mediaItems.map((media, index) => (
                  <div
                    key={`viewer-${media.kind}-${media.src}`}
                    className={`${styles.mediaSlide} ${media.kind === 'video' ? styles.videoSlide : styles.imageSlide}`}
                    aria-hidden={index !== activeIndex}
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
                  </div>
                ))}
              </div>
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
