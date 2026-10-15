/** 비활성 슬라이드·숨겨진 탭·이동 중인 본문을 도착으로 오인하지 않는다. */
export function isPortfolioTargetReady(target: HTMLElement): boolean {
  if (target.closest('[inert], [hidden], [aria-hidden="true"]')) return false;
  if (!target.getClientRects().length) return false;
  const style = window.getComputedStyle(target);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const wrapper = target.closest<HTMLElement>('.swiper-wrapper');
  if (wrapper?.getAnimations().some(animation => animation.playState === 'running')) return false;
  return true;
}
