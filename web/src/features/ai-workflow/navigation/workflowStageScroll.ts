/** 문서 높이는 유지한 채 상단에 도착한 후에만 단계 전환을 허용합니다. */
export function scrollToWorkflowStageNav(target: HTMLElement, animated: boolean, onArrival: () => void): () => void {
  const document = target.ownerDocument;
  const defaultView = document.defaultView;
  if (!defaultView) return () => {};
  const view = defaultView;

  const margin = Number.parseFloat(view.getComputedStyle(target).scrollMarginTop) || 0;
  const padding = Number.parseFloat(view.getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  const maximum = Math.max(0, (document.scrollingElement?.scrollHeight ?? document.documentElement.scrollHeight) - view.innerHeight);
  const startTop = view.scrollY;
  const top = Math.min(maximum, Math.max(0, startTop + target.getBoundingClientRect().top - margin - padding));
  const distance = top - startTop;

  if (!animated || Math.abs(distance) <= 2) {
    view.scrollTo({ top, behavior: 'instant' });
    onArrival();
    return () => {};
  }

  let active = true;
  let frame = 0;
  let startedAt: number | null = null;
  const duration = Math.min(900, Math.max(480, Math.abs(distance) * .12));
  const cleanup = () => {
    active = false;
    view.cancelAnimationFrame(frame);
    view.removeEventListener('wheel', cancel);
    view.removeEventListener('touchstart', cancel);
    view.removeEventListener('pointerdown', cancel);
    view.removeEventListener('keydown', interruptByKey);
  };
  function cancel() {
    if (!active) return;
    cleanup();
  }
  function interruptByKey(event: KeyboardEvent) {
    if (!event.defaultPrevented && ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Tab', 'Escape'].includes(event.key)) cancel();
  }
  const animate = (timestamp: number) => {
    if (!active) return;
    startedAt ??= timestamp;
    const progress = Math.min(1, Math.max(0, (timestamp - startedAt) / duration));
    const eased = progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
    // native smooth가 생략되더라도 각 프레임의 위치는 직접 보간합니다.
    view.scrollTo({ top: progress === 1 ? top : startTop + distance * eased, behavior: 'instant' });
    if (progress === 1) {
      cleanup();
      // 문서 잠금 등으로 도착하지 못했다면 나중에 본문만 바꾸지 않습니다.
      if (Math.abs(view.scrollY - top) <= 2) onArrival();
      return;
    }
    frame = view.requestAnimationFrame(animate);
  };

  view.addEventListener('wheel', cancel, { passive: true });
  view.addEventListener('touchstart', cancel, { passive: true });
  view.addEventListener('pointerdown', cancel, { passive: true });
  view.addEventListener('keydown', interruptByKey);
  frame = view.requestAnimationFrame(animate);
  return cancel;
}
