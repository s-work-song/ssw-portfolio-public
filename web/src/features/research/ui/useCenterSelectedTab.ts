"use client";

/**
 * 가로로 넘치는 탭 막대에서 선택된 탭이 막대 밖에 있으면 막대 안에서만 가로로 옮겨 가운데로 데려온다.
 * 이동 안내나 선택으로 탭이 바뀌어도 선택 표시가 화면에 보이게 하려는 것이며, 페이지 세로 위치는 건드리지 않는다.
 * 탭 컴포넌트가 브라우저 API를 직접 알지 않도록 스크롤 계산을 이 훅에 모은다.
 */
import { useEffect, type RefObject } from 'react';

export function useCenterSelectedTab(
  containerRef: RefObject<HTMLElement | null>,
  selectedTabElementId: string,
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || container.scrollWidth <= container.clientWidth) return;
    const tab = document.getElementById(selectedTabElementId);
    if (!tab || !container.contains(tab)) return;
    const containerRect = container.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    const offset = tabRect.left - containerRect.left - (containerRect.width - tabRect.width) / 2;
    if (Math.abs(offset) < 1) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    container.scrollBy({ left: offset, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [containerRef, selectedTabElementId]);
}
