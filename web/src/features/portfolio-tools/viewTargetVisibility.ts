/** 비활성 슬라이드·숨겨진 탭·이동 중인 본문을 도착으로 오인하지 않는다. */
export function isPortfolioTargetReady(target: HTMLElement): boolean {
  if (target.closest('[inert], [hidden], [aria-hidden="true"]')) return false;
  if (!target.getClientRects().length) return false;
  const style = window.getComputedStyle(target);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const wrapper = target.closest<HTMLElement>('.swiper-wrapper');
  if (wrapper?.getAnimations().some(animation => animation.playState === 'running')) return false;
  // 앞선 연도의 카드 높이도 현재 앵커를 움직인다. 카드 클래스만 바뀐 순간은 도착이 아니다.
  const timeline = target.closest<HTMLElement>('#research-timeline');
  if (timeline?.getAnimations({ subtree: true }).some(animation =>
    animation.playState === 'running'
      && (animation as CSSTransition).transitionProperty === 'grid-template-rows')) return false;
  return true;
}

/** 스크롤 완료를 보고하기 전에 목적지가 의도한 상단 위치에 정렬됐는지 확인한다. */
export function isPortfolioTargetAligned(
  target: Pick<HTMLElement, 'getBoundingClientRect'>,
  expectedTop: number,
  scrollTop: number,
  maximumScrollTop: number,
  viewportHeight = window.innerHeight,
): boolean {
  const rect = target.getBoundingClientRect();
  if (Math.abs(rect.top - expectedTop) <= 2) return true;
  const reachedDocumentEnd = Math.abs(scrollTop - maximumScrollTop) <= 1;
  return reachedDocumentEnd && rect.bottom > 0 && rect.top < viewportHeight;
}
