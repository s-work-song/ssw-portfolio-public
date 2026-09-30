'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { A11y } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperInstance } from 'swiper';
import type { AboutProjectGallery } from '@/data/about';
import { mediaSlideIndex } from './mediaSwiperPolicy';
import { useMediaSwiperSpeed } from './useMediaSwiperMotion';
import styles from './ProjectMediaCarousel.module.css';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const swiperModules = [A11y];
const swiperA11y = {
  slideLabelMessage: '{{index}} / {{slidesLength}}',
  scrollOnFocus: false,
  wrapperLiveRegion: false,
};

interface ProjectMediaCarouselProps {
  gallery: AboutProjectGallery;
  projectTitle: string;
  className?: string;
  imageSizes?: string;
  /** 전환이 수락되면 원본 이미지의 0 기반 인덱스를 알린다. 초기 인덱스는 0이다. */
  onActiveIndexChange?: (index: number) => void;
}

export default function ProjectMediaCarousel({
  gallery,
  projectTitle,
  className,
  imageSizes = '(max-width: 720px) 100vw, 520px',
  onActiveIndexChange,
}: ProjectMediaCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandedRef = useRef(false);
  const activeIndexRef = useRef(0);
  const inlineSwiperRef = useRef<SwiperInstance | null>(null);
  const expandedSwiperRef = useRef<SwiperInstance | null>(null);
  const slideButtonRefs = useRef(new Map<number, HTMLButtonElement>());
  const lightboxCloseRef = useRef<HTMLButtonElement | null>(null);
  const touchPointers = useRef(new Set<number>());
  const pinchLocked = useRef(false);
  const unlockFrame = useRef<number | null>(null);
  const lastDragFinishedAt = useRef<number | null>(null);
  const speed = useMediaSwiperSpeed();
  const { images } = gallery;
  const hasMultipleImages = images.length > 1;

  const resetGesture = useCallback(() => {
    touchPointers.current.clear();
    pinchLocked.current = false;
    if (unlockFrame.current !== null) {
      window.cancelAnimationFrame(unlockFrame.current);
      unlockFrame.current = null;
    }
    [inlineSwiperRef.current, expandedSwiperRef.current].forEach((swiper) => {
      if (!swiper || swiper.destroyed) return;
      swiper.allowTouchMove = hasMultipleImages;
      swiper.allowSlideNext = true;
      swiper.allowSlidePrev = true;
    });
  }, [hasMultipleImages]);
  const closeExpandedView = useCallback(() => {
    resetGesture();
    isExpandedRef.current = false;
    setIsExpanded(false);
    window.requestAnimationFrame(() => {
      slideButtonRefs.current.get(activeIndexRef.current)?.focus({ preventScroll: true });
    });
  }, [resetGesture]);

  useEffect(() => {
    if (!isExpanded) return;
    const previousOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => {
      lightboxCloseRef.current?.focus({ preventScroll: true });
    });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeExpandedView();
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isExpanded, closeExpandedView]);

  useEffect(() => () => {
    if (unlockFrame.current !== null) window.cancelAnimationFrame(unlockFrame.current);
  }, []);

  const liveSwipers = () => [inlineSwiperRef.current, expandedSwiperRef.current]
    .filter((swiper): swiper is SwiperInstance => Boolean(swiper && !swiper.destroyed));

  // 두 손가락 제스처는 브라우저 확대에 맡긴다. 이동 거리/인덱스 계산은 Swiper가 담당한다.
  const capturePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') return;
    touchPointers.current.add(event.pointerId);
    if (touchPointers.current.size < 2) return;
    if (unlockFrame.current !== null) window.cancelAnimationFrame(unlockFrame.current);
    pinchLocked.current = true;
    liveSwipers().forEach((swiper) => {
      swiper.allowTouchMove = false;
      swiper.allowSlideNext = false;
      swiper.allowSlidePrev = false;
    });
  };
  const capturePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    touchPointers.current.delete(event.pointerId);
    if (!pinchLocked.current || touchPointers.current.size > 0) return;
    lastDragFinishedAt.current = window.performance.now();
    // Swiper의 document pointerup 처리가 끝난 뒤 잠금을 해제한다.
    unlockFrame.current = window.requestAnimationFrame(() => {
      liveSwipers().forEach((swiper) => {
        swiper.allowTouchMove = hasMultipleImages;
        swiper.allowSlideNext = true;
        swiper.allowSlidePrev = true;
        if (hasMultipleImages) swiper.slideToLoop(activeIndexRef.current, 0, false);
      });
      pinchLocked.current = false;
      unlockFrame.current = null;
    });
  };
  const recordDragEnd = (swiper: SwiperInstance) => {
    if (!swiper.allowClick || pinchLocked.current) {
      lastDragFinishedAt.current = window.performance.now();
    }
  };
  const acceptSlide = (swiper: SwiperInstance) => {
    if (!swiper.initialized || pinchLocked.current) return;
    // slideToLoop는 RAF 뒤 slideChange를 발생시킨다. 동기화 대상의 echo는 수락하지 않는다.
    const authoritativeSwiper = isExpandedRef.current ? expandedSwiperRef.current : inlineSwiperRef.current;
    if (swiper !== authoritativeSwiper) return;
    const nextIndex = mediaSlideIndex(swiper.realIndex, images.length);
    if (nextIndex === null || nextIndex === activeIndexRef.current) return;
    const focusedSlide = slideButtonRefs.current.get(activeIndexRef.current);
    const transferFocus = document.activeElement === focusedSlide;
    if (transferFocus) focusedSlide?.blur();
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
    onActiveIndexChange?.(nextIndex);
    liveSwipers().forEach((other) => {
      if (other !== swiper && other.realIndex !== nextIndex) {
        other.slideToLoop(nextIndex, 0, false);
      }
    });
    if (transferFocus) {
      window.requestAnimationFrame(() => {
        slideButtonRefs.current.get(nextIndex)?.focus({ preventScroll: true });
      });
    }
  };
  const visibleSwiper = () => isExpanded ? expandedSwiperRef.current : inlineSwiperRef.current;
  const move = (direction: -1 | 1) => {
    const swiper = visibleSwiper();
    if (!hasMultipleImages || !swiper || swiper.destroyed || swiper.animating || pinchLocked.current) return;
    if (direction === 1) swiper.slideNext();
    else swiper.slidePrev();
  };
  const selectSlide = (index: number) => {
    const swiper = visibleSwiper();
    if (!swiper || swiper.destroyed || swiper.animating || pinchLocked.current) return;
    if (mediaSlideIndex(index, images.length) !== null) swiper.slideToLoop(index);
  };
  const openExpandedView = () => {
    if (pinchLocked.current || (lastDragFinishedAt.current !== null
      && window.performance.now() - lastDragFinishedAt.current < 250)) return;
    isExpandedRef.current = true;
    setIsExpanded(true);
  };

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
  const swiperProps = {
    modules: swiperModules,
    a11y: swiperA11y,
    slidesPerView: 1,
    loop: hasMultipleImages,
    speed,
    threshold: 10,
    allowTouchMove: hasMultipleImages,
    touchStartPreventDefault: false,
    focusableElements: 'input, select, option, textarea, video, label',
    preventInteractionOnTransition: true,
    runCallbacksOnInit: false,
    onSlideChange: acceptSlide,
    onTouchEnd: recordDragEnd,
  };

  return (
    <>
      <div className={`${styles.root} ${className ?? ''}`} role="region"
        aria-roledescription="carousel" aria-label={`${projectTitle} 이미지`}>
        <div className={`${styles.frame} ${hasMultipleImages ? styles.interactiveFrame : ''}`}
          onPointerDownCapture={capturePointerDown} onPointerUpCapture={capturePointerEnd}
          onPointerCancelCapture={capturePointerEnd}>
          <Swiper {...swiperProps} className={styles.swiper}
            onSwiper={(swiper) => { inlineSwiperRef.current = swiper; }}>
            {images.map((image, index) => (
              <SwiperSlide key={image.src} className={styles.swiperSlide} inert={index !== activeIndex}>
                <button type="button" className={styles.slide} onClick={openExpandedView}
                  ref={(node) => {
                    if (node) slideButtonRefs.current.set(index, node);
                    else slideButtonRefs.current.delete(index);
                  }}
                  aria-label={index === activeIndex ? `${image.alt} 크게 보기` : undefined}
                  tabIndex={index === activeIndex ? 0 : -1}>
                  <Image src={`${basePath}${image.src}`} alt={index === activeIndex ? image.alt : ''}
                    fill sizes={imageSizes} className={styles.image} draggable={false} />
                </button>
              </SwiperSlide>
            ))}
          </Swiper>
          {hasMultipleImages && (
            <>
              <button type="button" className={`${styles.navButton} ${styles.previous}`}
                onClick={() => move(-1)} aria-label="이전 이미지">‹</button>
              <button type="button" className={`${styles.navButton} ${styles.next}`}
                onClick={() => move(1)} aria-label="다음 이미지">›</button>
              <span className={styles.counter} aria-live="polite">{activeIndex + 1} / {images.length}</span>
            </>
          )}
        </div>
        {(currentImage.caption || hasMultipleImages) && (
          <div className={styles.footer}>
            {currentImage.caption ? <p className={styles.caption}>{currentImage.caption}</p> : <span />}
            {hasMultipleImages && (
              <div className={styles.dots} aria-label="이미지 선택">
                {images.map((image, index) => (
                  <button key={image.src} type="button"
                    className={`${styles.dot} ${index === activeIndex ? styles.dotActive : ''}`}
                    onClick={() => selectSlide(index)} aria-label={`${index + 1}번 이미지 보기`}
                    aria-current={index === activeIndex ? 'true' : undefined} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {isExpanded && (
        <div className={styles.lightboxOverlay} role="dialog" aria-modal="true"
          aria-label={`${projectTitle} 크게 보기`} onClick={closeExpandedView}>
          <div className={styles.lightboxDialog} onClick={(event) => event.stopPropagation()}>
            <button ref={lightboxCloseRef} type="button" className={styles.lightboxClose}
              onClick={closeExpandedView} aria-label="크게 보기 닫기" />
            <div className={`${styles.lightboxFrame} ${hasMultipleImages ? styles.lightboxInteractive : ''}`}
              onPointerDownCapture={capturePointerDown} onPointerUpCapture={capturePointerEnd}
              onPointerCancelCapture={capturePointerEnd}>
              <Swiper {...swiperProps} className={styles.swiper} initialSlide={activeIndex}
                onSwiper={(swiper) => { expandedSwiperRef.current = swiper; }}>
                {images.map((image, index) => (
                  <SwiperSlide key={`lightbox-${image.src}`} className={styles.lightboxSlide}
                    aria-hidden={index !== activeIndex} inert={index !== activeIndex}>
                    <Image src={`${basePath}${image.src}`} alt={index === activeIndex ? image.alt : ''}
                      fill sizes="96vw" className={styles.lightboxImage} draggable={false} />
                  </SwiperSlide>
                ))}
              </Swiper>
              {hasMultipleImages && (
                <>
                  <button type="button" className={`${styles.lightboxNav} ${styles.lightboxPrevious}`}
                    onClick={() => move(-1)} aria-label="이전 이미지">‹</button>
                  <button type="button" className={`${styles.lightboxNav} ${styles.lightboxNext}`}
                    onClick={() => move(1)} aria-label="다음 이미지">›</button>
                </>
              )}
            </div>
            <div className={styles.lightboxFooter}>
              <p>{currentImage.caption ?? currentImage.alt}</p><span>{activeIndex + 1} / {images.length}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
