let requestedSlug: string | null = null;

export function requestLogReadingStart(slug: string): void {
  requestedSlug = slug;
}

/** 비동기 본문이 렌더된 뒤 새 기록의 시작점 또는 요청한 소제목을 보여 준다. */
export function scheduleLogReadingPosition(view: Window, slug: string): () => void {
  const frameId = view.requestAnimationFrame(() => {
    const startRequested = requestedSlug === slug;
    if (startRequested) requestedSlug = null;
    const hash = view.location.hash;
    const target = hash ? view.document.getElementById(hash.slice(1)) : null;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.focus({ preventScroll: true });
      return;
    }

    // 새 글 링크만 초기화하며 뒤로가기·앞으로가기의 복원 위치는 덮어쓰지 않는다.
    if (startRequested) view.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  });
  return () => view.cancelAnimationFrame(frameId);
}
