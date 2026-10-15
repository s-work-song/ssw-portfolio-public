'use client';

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperInstance } from 'swiper';
import { aiWorkflowStages, type AiWorkflowStageId } from '@/data/aiWorkflow';
import { useMediaSwiperSpeed } from '@/components/about/useMediaSwiperMotion';
import WorkflowStageNav from './WorkflowStageNav';
import { workflowStageFromHash, workflowStageIndexFromHash } from './workflowStageNavigation';
import { scrollToWorkflowStageNav } from './workflowStageScroll';
import styles from './AiWorkflow.module.css';

function subscribeToLocation(listener: () => void) {
  window.addEventListener('hashchange', listener);
  window.addEventListener('popstate', listener);
  return () => {
    window.removeEventListener('hashchange', listener);
    window.removeEventListener('popstate', listener);
  };
}
const currentHash = () => window.location.hash;
const serverHash = () => '';

/** 본문은 서버 렌더링 슬롯으로 유지하고, 선택·이동·높이만 클라이언트에서 관리합니다. */
export default function WorkflowStageTabs({ panels }: { panels: readonly ReactNode[] }) {
  const hash = useSyncExternalStore(subscribeToLocation, currentHash, serverHash);
  const activeId = workflowStageFromHash(hash);
  const activeIndex = workflowStageIndexFromHash(hash);
  const speed = useMediaSwiperSpeed();
  const swiperRef = useRef<SwiperInstance | null>(null);
  const contentRefs = useRef(new Map<number, HTMLDivElement>());
  const frameRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const buttonHashRef = useRef<string | null>(null);
  const cancelNavScrollRef = useRef<(() => void) | null>(null);

  useEffect(() => () => { cancelNavScrollRef.current?.(); }, [hash, speed]);

  useEffect(() => {
    const swiper = swiperRef.current;
    if (!swiper || swiper.destroyed || workflowStageIndexFromHash(window.location.hash) !== activeIndex) return;
    swiper.slideTo(activeIndex, speed);
    // 기본 앵커 이동이 슬라이드 뷰포트를 가로로 스크롤하지 못하게 합니다.
    if (frameRef.current) frameRef.current.scrollLeft = 0;
  }, [activeIndex, speed]);

  useEffect(() => {
    const content = contentRefs.current.get(activeIndex);
    if (!content) return;
    let frame = 0;
    const updateHeight = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const swiper = swiperRef.current;
        // 사진 설명의 높이가 바뀌어도 가로 이동 시간은 덮어쓰지 않습니다.
        if (swiper && !swiper.destroyed) swiper.updateAutoHeight();
      });
    };
    const observer = new ResizeObserver(updateHeight);
    observer.observe(content);
    updateHeight();
    return () => { observer.disconnect(); window.cancelAnimationFrame(frame); };
  }, [activeIndex]);

  useEffect(() => {
    if (buttonHashRef.current === hash) { buttonHashRef.current = null; return; }
    if (!hash.startsWith('#workflow-') && !hash.startsWith('#example-') && !hash.startsWith('#story-')) return;
    // 직접 링크와 뒤로/앞으로 이동은 패널이 제자리에 온 뒤 앵커 위치를 복원합니다.
    const timer = window.setTimeout(() => {
      const target = hash === `#workflow-${activeId}` ? navRef.current : document.getElementById(hash.slice(1));
      target?.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
      if (frameRef.current) frameRef.current.scrollLeft = 0;
    }, speed + 32);
    return () => window.clearTimeout(timer);
  }, [hash, activeId, speed]);

  function selectStage(id: AiWorkflowStageId) {
    cancelNavScrollRef.current?.();
    cancelNavScrollRef.current = null;
    if (id === activeId) return;
    const nextHash = `#workflow-${id}`;
    buttonHashRef.current = nextHash;
    window.history.pushState(window.history.state, '', nextHash);
    window.dispatchEvent(new Event('hashchange'));
  }

  function selectStageFromBottom(id: AiWorkflowStageId) {
    cancelNavScrollRef.current?.();
    const target = navRef.current;
    if (!target) return;
    // 스크롤 중에는 기존 본문 높이를 유지해 짧은 단계로의 전환도 끊기지 않게 합니다.
    cancelNavScrollRef.current = scrollToWorkflowStageNav(target, speed > 0, () => {
      document.getElementById(`workflow-tab-${id}`)?.focus({ preventScroll: true });
      selectStage(id);
    });
  }

  return (
    <div className={styles.stageTabs}>
      <div ref={navRef} className={styles.stageNavAnchor}>
        <WorkflowStageNav currentStageId={activeId} onSelect={selectStage} />
      </div>
      <div ref={frameRef} className={styles.stageViewport}>
        <Swiper className={styles.stageSwiper} slidesPerView={1} loop={false} autoHeight speed={speed}
          allowTouchMove={false} simulateTouch={false} touchStartPreventDefault={false}
          preventClicks={false} preventClicksPropagation={false} runCallbacksOnInit={false}
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
            // 첫 직접 링크는 중간 단계를 거치지 않고 즉시 맞춥니다.
            swiper.slideTo(workflowStageIndexFromHash(window.location.hash), 0, false);
          }}>
          {aiWorkflowStages.map((stage, index) => (
            <SwiperSlide key={stage.id} id={`workflow-${stage.id}`} className={styles.stageSlide}
              role="tabpanel" aria-labelledby={`workflow-tab-${stage.id}`}
              aria-hidden={index !== activeIndex} inert={index !== activeIndex} tabIndex={index === activeIndex ? 0 : -1}>
              <div className={styles.stageContent} ref={(node) => {
                if (node) contentRefs.current.set(index, node);
                else contentRefs.current.delete(index);
              }}>{panels[index]}</div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
      <WorkflowStageNav currentStageId={activeId} onSelect={selectStageFromBottom} position="bottom" />
    </div>
  );
}
