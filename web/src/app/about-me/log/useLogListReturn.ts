import { useEffect, useRef } from 'react';
import { findLogListReturnTarget, readLogListReturn, takeLogListReturn, restoreLogListTarget, type LogListReturn } from './logListReturn';

/** 목록 조회·카드 배치가 끝난 뒤 한 번만 복원한다. 사용자의 새 조작이 항상 우선한다. */
export function useLogListReturn(ready: boolean, mode: 'list' | 'map', slugs: readonly string[]) {
  const pending = useRef<LogListReturn | null>(null);
  const cancelScroll = useRef<(() => void) | null>(null);

  useEffect(() => {
    pending.current = takeLogListReturn(window);
    const cancel = () => {
      pending.current = null;
      cancelScroll.current?.();
      cancelScroll.current = null;
    };
    const cancelForKey = (event: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Tab'].includes(event.key)) cancel();
    };
    window.addEventListener('wheel', cancel, { passive: true });
    window.addEventListener('touchstart', cancel, { passive: true });
    window.addEventListener('pointerdown', cancel, { passive: true });
    window.addEventListener('keydown', cancelForKey);
    return () => {
      cancel();
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchstart', cancel);
      window.removeEventListener('pointerdown', cancel);
      window.removeEventListener('keydown', cancelForKey);
    };
  }, []);

  useEffect(() => {
    const entry = pending.current;
    const root = document.getElementById('log-entries');
    if (!ready || !entry || !root) return;
    let stopped = false;
    let frame = 0;
    let settling = false;
    const isCurrent = () => !stopped && pending.current === entry
      && readLogListReturn(window)?.url === entry.url;
    const stop = () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.clearTimeout(timeout);
    };
    const complete = async () => {
      if (!isCurrent() || settling) return;
      const target = findLogListReturnTarget(root, entry.slug, mode, slugs.includes(entry.slug));
      if (!target || target.getBoundingClientRect().height === 0) return;
      settling = true;
      // 상위 페이지의 진입 연출이 좌표를 바꾸는 동안에는 복원하지 않는다.
      const animations: Animation[] = [];
      for (let node: HTMLElement | null = target; node; node = node.parentElement) {
        animations.push(...node.getAnimations().filter((animation) =>
          animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity));
      }
      await Promise.allSettled(animations.map((animation) => animation.finished));
      if (!isCurrent()) return;
      cancelScroll.current = restoreLogListTarget(window, target);
      pending.current = null;
      stop();
    };
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => { void complete(); });
      });
    };
    // 관계도는 동적 모듈이 늦게 도착할 수 있어 해당 설명 패널까지 기다린다.
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    const timeout = window.setTimeout(() => {
      if (isCurrent()) {
        cancelScroll.current = restoreLogListTarget(window, root);
        pending.current = null;
      }
      stop();
    }, 3000);
    schedule();
    return stop;
  }, [ready, mode, slugs]);
}
