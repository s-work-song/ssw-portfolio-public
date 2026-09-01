'use client';

import Image from 'next/image';
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { AboutProjectGallery } from '@/data/about';
import styles from './ProjectMediaCarousel.module.css';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const dragActivationDistance = 10;

interface ProjectMediaCarouselProps {
  gallery: AboutProjectGallery;
  projectTitle: string;
}

export default function ProjectMediaCarousel({
  gallery,
  projectTitle,
}: ProjectMediaCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [trackPosition, setTrackPosition] = useState(1);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const dragPointerId = useRef<number | null>(null);
  const dragMoved = useRef(false);
  const activeTouchPointers = useRef(new Set<number>());
  const lastDragFinishedAt = useRef<number | null>(null);
  const transitionFrame = useRef<number | null>(null);
  const transitionTimer = useRef<number | null>(null);
  const slideButtonRefs = useRef(new Map<number, HTMLButtonElement>());
  const lightboxCloseRef = useRef<HTMLButtonElement | null>(null);
  const activeIndexRef = useRef(activeIndex);
  const { images } = gallery;

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => {
      lightboxCloseRef.current?.focus({ preventScroll: true });
    });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExpanded(false);
        window.requestAnimationFrame(() => {
          slideButtonRefs.current
            .get(activeIndexRef.current)
            ?.focus({ preventScroll: true });
        });
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isExpanded]);

  useEffect(() => () => {
    if (transitionFrame.current !== null) {
      window.cancelAnimationFrame(transitionFrame.current);
    }
    if (transitionTimer.current !== null) {
      window.clearTimeout(transitionTimer.current);
    }
  }, []);

  if (images.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.frame}>
          <div className={styles.placeholder}>
            <span className={styles.placeholderKicker}>Project preview</span>
            <span className={styles.placeholderText}>{gallery.placeholder}</span>
          </div>
        </div>
      </div>
    );
  }

  const currentImage = images[activeIndex];
  const hasMultipleImages = images.length > 1;
  const renderedTrackPosition = hasMultipleImages ? trackPosition : 0;
  const loopedImages = hasMultipleImages
    ? [images[images.length - 1], ...images, images[0]]
    : images;

  const restoreLoopPosition = (position: number) => {
    setTransitionEnabled(false);
    setTrackPosition(position);

    transitionFrame.current = window.requestAnimationFrame(() => {
      transitionFrame.current = window.requestAnimationFrame(() => {
        setTransitionEnabled(true);
        setIsTransitioning(false);
        transitionFrame.current = null;
      });
    });
  };
  const scheduleTransitionCompletion = (position: number) => {
    if (transitionTimer.current !== null) {
      window.clearTimeout(transitionTimer.current);
    }

    transitionTimer.current = window.setTimeout(() => {
      transitionTimer.current = null;
      if (position === 0) {
        restoreLoopPosition(images.length);
      } else if (position === images.length + 1) {
        restoreLoopPosition(1);
      } else {
        setIsTransitioning(false);
      }
    }, 420);
  };
  const transferSlideFocus = (nextIndex: number) => {
    const currentSlide = slideButtonRefs.current.get(activeIndex);
    if (document.activeElement !== currentSlide) {
      return;
    }

    currentSlide.blur();
    window.requestAnimationFrame(() => {
      slideButtonRefs.current.get(nextIndex)?.focus({ preventScroll: true });
    });
  };
  const move = (direction: -1 | 1) => {
    if (!hasMultipleImages || isTransitioning) {
      return;
    }

    const nextPosition = trackPosition + direction;
    const nextIndex = (activeIndex + direction + images.length) % images.length;
    transferSlideFocus(nextIndex);
    setIsTransitioning(true);
    setTrackPosition(nextPosition);
    setActiveIndex(nextIndex);
    scheduleTransitionCompletion(nextPosition);
  };
  const selectSlide = (index: number) => {
    if (index === activeIndex || isTransitioning) {
      return;
    }

    transferSlideFocus(index);
    setIsTransitioning(true);
    setActiveIndex(index);
    setTrackPosition(index + 1);
    scheduleTransitionCompletion(index + 1);
  };
  const resetDrag = (target?: HTMLDivElement) => {
    const pointerId = dragPointerId.current;
    if (
      target
      && pointerId !== null
      && target.hasPointerCapture(pointerId)
    ) {
      target.releasePointerCapture(pointerId);
    }

    dragStartX.current = null;
    dragPointerId.current = null;
    dragMoved.current = false;
    setDragOffset(0);
    setIsDragging(false);
  };
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      activeTouchPointers.current.add(event.pointerId);
      if (activeTouchPointers.current.size > 1) {
        resetDrag(event.currentTarget);
        return;
      }
    }

    if (
      !hasMultipleImages
      || isTransitioning
      || (event.pointerType === 'mouse' && event.button !== 0)
    ) {
      return;
    }

    dragStartX.current = event.clientX;
    dragPointerId.current = event.pointerId;
    dragMoved.current = false;
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      dragStartX.current === null
      || dragPointerId.current !== event.pointerId
      || (
        event.pointerType === 'touch'
        && activeTouchPointers.current.size > 1
      )
    ) {
      return;
    }

    const nextOffset = event.clientX - dragStartX.current;
    if (!dragMoved.current && Math.abs(nextOffset) <= dragActivationDistance) {
      return;
    }
    if (!dragMoved.current) {
      dragMoved.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
    }
    setDragOffset(nextOffset);
  };
  const finishDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    shouldMove: boolean,
  ) => {
    const isActiveDragPointer = dragPointerId.current === event.pointerId;
    if (event.pointerType === 'touch') {
      activeTouchPointers.current.delete(event.pointerId);
    }

    if (!isActiveDragPointer || dragStartX.current === null) {
      return;
    }

    const distance = event.clientX - dragStartX.current;
    const threshold = Math.min(72, event.currentTarget.clientWidth * 0.15);

    if (dragMoved.current && shouldMove && distance <= -threshold) {
      move(1);
    } else if (dragMoved.current && shouldMove && distance >= threshold) {
      move(-1);
    }

    if (dragMoved.current) {
      lastDragFinishedAt.current = window.performance.now();
    }

    resetDrag(event.currentTarget);
  };
  const openExpandedView = () => {
    if (
      lastDragFinishedAt.current !== null
      && window.performance.now() - lastDragFinishedAt.current < 250
    ) {
      return;
    }
    setIsExpanded(true);
  };
  const closeExpandedView = () => {
    activeTouchPointers.current.clear();
    resetDrag();
    setIsExpanded(false);
    window.requestAnimationFrame(() => {
      slideButtonRefs.current
        .get(activeIndexRef.current)
        ?.focus({ preventScroll: true });
    });
  };

  return (
    <>
      <div
        className={styles.root}
        role="region"
        aria-roledescription="carousel"
        aria-label={`${projectTitle} 이미지`}
      >
        <div
          className={`${styles.frame} ${hasMultipleImages ? styles.interactiveFrame : ''} ${isDragging ? styles.dragging : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => finishDrag(event, true)}
          onPointerCancel={(event) => finishDrag(event, false)}
        >
          <div
            className={styles.track}
            style={{
              transform: `translate3d(calc(${-renderedTrackPosition * 100}% + ${dragOffset}px), 0, 0)`,
              transition: isDragging || !transitionEnabled ? 'none' : undefined,
            }}
          >
            {loopedImages.map((image, index) => {
              const isLeadingClone = hasMultipleImages && index === 0;
              const isTrailingClone = hasMultipleImages && index === loopedImages.length - 1;
              const sourceIndex = hasMultipleImages ? index - 1 : index;
              const isActive = !isLeadingClone
                && !isTrailingClone
                && sourceIndex === activeIndex;

              return (
                <button
                  key={`${image.src}-${index}`}
                  ref={(node) => {
                    if (isLeadingClone || isTrailingClone) {
                      return;
                    }
                    if (node) {
                      slideButtonRefs.current.set(sourceIndex, node);
                    } else {
                      slideButtonRefs.current.delete(sourceIndex);
                    }
                  }}
                  type="button"
                  className={styles.slide}
                  onClick={openExpandedView}
                  aria-label={isActive ? `${image.alt} 크게 보기` : undefined}
                  inert={!isActive}
                  tabIndex={isActive ? 0 : -1}
                >
                  <Image
                    src={`${basePath}${image.src}`}
                    alt={isActive ? image.alt : ''}
                    fill
                    sizes="(max-width: 720px) 100vw, 520px"
                    className={styles.image}
                    draggable={false}
                  />
                </button>
              );
            })}
          </div>
          {hasMultipleImages && (
            <>
              <button
                type="button"
                className={`${styles.navButton} ${styles.previous}`}
                onClick={() => move(-1)}
                onPointerDown={(event) => event.stopPropagation()}
                aria-label="이전 이미지"
              >
                ‹
              </button>
              <button
                type="button"
                className={`${styles.navButton} ${styles.next}`}
                onClick={() => move(1)}
                onPointerDown={(event) => event.stopPropagation()}
                aria-label="다음 이미지"
              >
                ›
              </button>
              <span className={styles.counter} aria-live="polite">
                {activeIndex + 1} / {images.length}
              </span>
            </>
          )}
        </div>
        {(currentImage.caption || hasMultipleImages) && (
          <div className={styles.footer}>
            {currentImage.caption ? (
              <p className={styles.caption}>{currentImage.caption}</p>
            ) : (
              <span />
            )}
            {hasMultipleImages && (
              <div className={styles.dots} aria-label="이미지 선택">
                {images.map((image, index) => (
                  <button
                    key={image.src}
                    type="button"
                    className={`${styles.dot} ${index === activeIndex ? styles.dotActive : ''}`}
                    onClick={() => selectSlide(index)}
                    aria-label={`${index + 1}번 이미지 보기`}
                    aria-current={index === activeIndex ? 'true' : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {isExpanded && (
        <div
          className={styles.lightboxOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={`${projectTitle} 크게 보기`}
          onClick={closeExpandedView}
        >
          <div className={styles.lightboxDialog} onClick={(event) => event.stopPropagation()}>
            <button
              ref={lightboxCloseRef}
              type="button"
              className={styles.lightboxClose}
              onClick={closeExpandedView}
              aria-label="크게 보기 닫기"
            />
            <div
              className={`${styles.lightboxFrame} ${hasMultipleImages ? styles.lightboxInteractive : ''} ${isDragging ? styles.dragging : ''}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={(event) => finishDrag(event, true)}
              onPointerCancel={(event) => finishDrag(event, false)}
            >
              <div
                className={styles.lightboxTrack}
                style={{
                  transform: `translate3d(calc(${-renderedTrackPosition * 100}% + ${dragOffset}px), 0, 0)`,
                  transition: isDragging || !transitionEnabled ? 'none' : undefined,
                }}
              >
                {loopedImages.map((image, index) => {
                  const isLeadingClone = hasMultipleImages && index === 0;
                  const isTrailingClone = hasMultipleImages && index === loopedImages.length - 1;
                  const sourceIndex = hasMultipleImages ? index - 1 : index;
                  const isActive = !isLeadingClone
                    && !isTrailingClone
                    && sourceIndex === activeIndex;

                  return (
                    <div
                      key={`lightbox-${image.src}-${index}`}
                      className={styles.lightboxSlide}
                      aria-hidden={!isActive}
                    >
                      <Image
                        src={`${basePath}${image.src}`}
                        alt={isActive ? image.alt : ''}
                        fill
                        sizes="96vw"
                        className={styles.lightboxImage}
                        draggable={false}
                      />
                    </div>
                  );
                })}
              </div>
              {hasMultipleImages && (
                <>
                  <button
                    type="button"
                    className={`${styles.lightboxNav} ${styles.lightboxPrevious}`}
                    onClick={() => move(-1)}
                    onPointerDown={(event) => event.stopPropagation()}
                    aria-label="이전 이미지"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className={`${styles.lightboxNav} ${styles.lightboxNext}`}
                    onClick={() => move(1)}
                    onPointerDown={(event) => event.stopPropagation()}
                    aria-label="다음 이미지"
                  >
                    ›
                  </button>
                </>
              )}
            </div>
            <div className={styles.lightboxFooter}>
              <p>{currentImage.caption ?? currentImage.alt}</p>
              <span>{activeIndex + 1} / {images.length}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
