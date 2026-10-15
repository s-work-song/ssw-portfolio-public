'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { A11y } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperInstance } from 'swiper';
import MermaidDiagram from './MermaidDiagram';
import ECommerceDeploymentDiagram from './ECommerceDeploymentDiagram';
import SharedInfrastructureDeploymentDiagram from './SharedInfrastructureDeploymentDiagram';
import PortfolioDeploymentDiagram from './PortfolioDeploymentDiagram';
import { mediaSlideIndex } from './mediaSwiperPolicy';
import { useMediaSwiperSpeed } from './useMediaSwiperMotion';
import styles from './DeploymentDiagramCarousel.module.css';

type DeploymentDiagram = {
  id: string;
  title: string;
  description: string;
  source: string;
  compactSource: string;
};

const swiperModules = [A11y];
const swiperA11y = {
  slideLabelMessage: '{{index}} / {{slidesLength}}',
  scrollOnFocus: false,
  wrapperLiveRegion: false,
};

/** 처음 방문할 때 렌더링하고, 방문한 그림은 유지해 Swiper의 입장·퇴장 이동을 보존한다. */
export default function DeploymentDiagramCarousel({ diagrams }: { diagrams: readonly DeploymentDiagram[] }) {
  const headingId = useId();
  const [activeIndex, setActiveIndex] = useState(0);
  const [heldHeight, setHeldHeight] = useState<number | null>(null);
  const [visitedIndices, setVisitedIndices] = useState(() => new Set([0]));
  const readyIndices = useRef(new Set<number>());
  const activeIndexRef = useRef(0);
  const swiperRef = useRef<SwiperInstance | null>(null);
  const contentRefs = useRef(new Map<number, HTMLDivElement>());
  const touchPointers = useRef(new Set<number>());
  const pinchLocked = useRef(false);
  const unlockFrame = useRef<number | null>(null);
  const speed = useMediaSwiperSpeed();
  const hasMultiple = diagrams.length > 1;

  useEffect(() => {
    const content = contentRefs.current.get(activeIndex);
    if (!content) return;
    let frame: number | null = null;
    const updateHeight = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const swiper = swiperRef.current;
        // 숫자를 넘기면 Swiper의 가로 이동 transition-duration까지 덮어쓴다.
        if (swiper && !swiper.destroyed) swiper.updateAutoHeight();
      });
    };
    // Mermaid가 placeholder를 SVG로 바꾸거나 화면 폭이 바뀌어도 높이를 자르지 않는다.
    const observer = new ResizeObserver(updateHeight);
    observer.observe(content);
    updateHeight();
    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [activeIndex, diagrams.length, heldHeight]);

  useEffect(() => () => {
    if (unlockFrame.current !== null) window.cancelAnimationFrame(unlockFrame.current);
  }, []);

  const capturePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') return;
    touchPointers.current.add(event.pointerId);
    if (touchPointers.current.size < 2) return;
    if (unlockFrame.current !== null) window.cancelAnimationFrame(unlockFrame.current);
    pinchLocked.current = true;
    const swiper = swiperRef.current;
    if (!swiper || swiper.destroyed) return;
    swiper.allowTouchMove = false;
    swiper.allowSlideNext = false;
    swiper.allowSlidePrev = false;
  };

  const capturePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    touchPointers.current.delete(event.pointerId);
    if (!pinchLocked.current || touchPointers.current.size > 0) return;
    // Swiper의 document pointerup 처리가 끝난 뒤 원래 슬라이드로 복귀한다.
    unlockFrame.current = window.requestAnimationFrame(() => {
      const swiper = swiperRef.current;
      if (swiper && !swiper.destroyed) {
        swiper.allowTouchMove = hasMultiple;
        swiper.allowSlideNext = true;
        swiper.allowSlidePrev = true;
        swiper.slideTo(activeIndexRef.current, 0, false);
      }
      pinchLocked.current = false;
      unlockFrame.current = null;
    });
  };

  const acceptSlide = (swiper: SwiperInstance) => {
    if (!swiper.initialized || pinchLocked.current) return;
    const nextIndex = mediaSlideIndex(swiper.realIndex, diagrams.length);
    if (nextIndex === null || nextIndex === activeIndexRef.current) return;
    const previousContent = contentRefs.current.get(activeIndexRef.current);
    const previousHeight = Math.ceil(Math.max(
      previousContent?.getBoundingClientRect().height ?? 0,
      swiper.wrapperEl.getBoundingClientRect().height,
    ));
    if (previousHeight > 0) {
      // slideChange 뒤 Swiper가 빈 다음 슬라이드의 높이를 계산하기 전에 확보한다.
      // 빠른 연속 이동에서도 아직 유지 중인 wrapper 높이보다 작아지지 않는다.
      swiper.slides.forEach(slide => { slide.style.minHeight = `${previousHeight}px`; });
      setHeldHeight(previousHeight);
    }
    activeIndexRef.current = nextIndex;
    setVisitedIndices(previous => new Set(previous).add(nextIndex));
    setActiveIndex(nextIndex);
  };

  const releaseHeight = (index: number) => {
    readyIndices.current.add(index);
    if (index !== activeIndexRef.current) return;
    if (swiperRef.current?.animating) return;
    // 모션이 0ms이면 state 변경이 합쳐질 수 있어 직접 확보한 높이도 명시적으로 지운다.
    swiperRef.current?.slides.forEach(slide => { slide.style.minHeight = ''; });
    setHeldHeight(null);
  };

  const finishTransition = () => {
    if (readyIndices.current.has(activeIndexRef.current)) releaseHeight(activeIndexRef.current);
  };

  const selectSlide = (index: number) => {
    const swiper = swiperRef.current;
    if (!swiper || swiper.destroyed || swiper.animating || pinchLocked.current) return;
    if (mediaSlideIndex(index, diagrams.length) !== null) swiper.slideTo(index);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // 다이어그램·버튼의 키 입력을 가로채지 않고 캐러셀 자체에 초점이 있을 때만 이동한다.
    if (event.target !== event.currentTarget) return;
    let nextIndex: number;
    if (event.key === 'ArrowLeft') nextIndex = activeIndexRef.current - 1;
    else if (event.key === 'ArrowRight') nextIndex = activeIndexRef.current + 1;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = diagrams.length - 1;
    else return;
    event.preventDefault();
    selectSlide(nextIndex);
  };

  if (diagrams.length === 0) return null;

  return (
    <section className={styles.carousel} role="region" aria-roledescription="carousel"
      aria-labelledby={headingId} tabIndex={0} onKeyDown={handleKeyDown}>
      <div className={styles.header}>
        <h4 id={headingId}>프로젝트별 상세 구성</h4>
        <p>프로젝트를 선택해 화면·백엔드·추론 경로를 살펴보세요.</p>
      </div>
      <div className={styles.projectSelector} aria-label="배포 구성 프로젝트 선택">
        {diagrams.map((diagram, index) => (
          <button key={diagram.id} type="button" onClick={() => selectSlide(index)}
            className={index === activeIndex ? styles.selectedProject : styles.projectButton}
            aria-pressed={index === activeIndex}>
            {diagram.title}
          </button>
        ))}
      </div>
      <div className={styles.controls}>
        <button type="button" onClick={() => selectSlide(activeIndex - 1)}
          disabled={activeIndex === 0} aria-label="이전 프로젝트">
          <span aria-hidden="true">←</span> 이전
        </button>
        <span className={styles.counter} aria-live="polite" aria-atomic="true">
          {activeIndex + 1} / {diagrams.length}
        </span>
        <button type="button" onClick={() => selectSlide(activeIndex + 1)}
          disabled={activeIndex === diagrams.length - 1} aria-label="다음 프로젝트">
          다음 <span aria-hidden="true">→</span>
        </button>
      </div>
      <div className={styles.frame} data-deployment-height-held={heldHeight ?? undefined} onPointerDownCapture={capturePointerDown}
        onPointerUpCapture={capturePointerEnd} onPointerCancelCapture={capturePointerEnd}>
        <Swiper className={styles.swiper} modules={swiperModules} a11y={swiperA11y}
          slidesPerView={1} loop={false} autoHeight speed={speed} threshold={10}
          allowTouchMove={hasMultiple} touchStartPreventDefault={false}
          preventInteractionOnTransition runCallbacksOnInit={false}
          onSlideChange={acceptSlide} onTransitionEnd={finishTransition}
          onSwiper={(swiper) => { swiperRef.current = swiper; }}>
          {diagrams.map((diagram, index) => (
            <SwiperSlide key={diagram.id} className={styles.slide}
              style={{ minHeight: heldHeight ?? undefined }}
              aria-hidden={index !== activeIndex} inert={index !== activeIndex}>
              {visitedIndices.has(index) && (
                <div className={styles.content} ref={(node) => {
                  if (node) contentRefs.current.set(index, node);
                  else contentRefs.current.delete(index);
                }}>
                  {diagram.id === 'portfolio' ? (
                    <PortfolioDeploymentDiagram title={diagram.title} description={diagram.description}
                      onSettled={() => releaseHeight(index)} />
                  ) : diagram.id === 'e-commerce' ? (
                    <ECommerceDeploymentDiagram compactDiagram={diagram.compactSource}
                      title={diagram.title} description={diagram.description} onSettled={() => releaseHeight(index)} />
                  ) : diagram.id === 'shared-infrastructure' ? (
                    <SharedInfrastructureDeploymentDiagram
                      title={diagram.title} description={diagram.description} onSettled={() => releaseHeight(index)} />
                  ) : (
                    <MermaidDiagram diagram={diagram.source} compactDiagram={diagram.compactSource}
                      title={diagram.title} description={diagram.description} onSettled={() => releaseHeight(index)} />
                  )}
                </div>
              )}
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
