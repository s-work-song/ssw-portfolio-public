const HISTORY_KEY = 'portfolioLogListReturn';
const DETAIL_HISTORY_KEY = 'portfolioLogDetailReturn';

export type LogListReturn = { url: string; slug: string };
const detailTransfers = new WeakMap<Window, { slug: string; entry: LogListReturn }>();
const listTransfers = new WeakMap<Window, LogListReturn>();

function listUrl(location: Pick<Location, 'pathname' | 'search' | 'hash'>): string | null {
  if (!/\/about-me\/log\/?$/.test(location.pathname)) return null;
  return `${location.pathname}${location.search}${location.hash}`;
}

function parseEntry(value: unknown): LogListReturn | null {
  if (!value || typeof value !== 'object' || !('url' in value) || !('slug' in value)) return null;
  if (typeof value.url !== 'string' || typeof value.slug !== 'string' || !value.slug) return null;
  try {
    const url = new URL(value.url, 'https://portfolio.invalid');
    if (url.origin !== 'https://portfolio.invalid' || listUrl(url) !== value.url) return null;
    return { url: value.url, slug: value.slug };
  } catch { return null; }
}

function saveHistory(view: Window, key: string, value: unknown): void {
  try {
    view.history.replaceState({ ...view.history.state, [key]: value }, '',
      `${view.location.pathname}${view.location.search}${view.location.hash}`);
  } catch { /* 방문 기록 저장이 제한돼도 글 열기는 계속한다. */ }
}

function readDetailReturn(view: Window, slug: string): LogListReturn | null {
  if (!/\/about-me\/log\/view\/?$/.test(view.location.pathname)) return null;
  const saved = view.history.state?.[DETAIL_HISTORY_KEY];
  return saved?.slug === slug ? parseEntry(saved.entry) : null;
}

/** 출발 목록은 history에 보존하고, 관련 글에서도 원래 목록의 복귀 대상을 이어받는다. */
export function rememberLogListReturn(view: Window, slug: string): void {
  const url = listUrl(view.location);
  const entry = url && slug ? { url, slug }
    : readDetailReturn(view, new URLSearchParams(view.location.search).get('slug') ?? '');
  if (url && entry) saveHistory(view, HISTORY_KEY, entry);
  if (entry) detailTransfers.set(view, { slug, entry });
  else detailTransfers.delete(view);
}

export function readLogListReturn(view: Window): LogListReturn | null {
  const entry = parseEntry(view.history.state?.[HISTORY_KEY]);
  return entry?.url === listUrl(view.location) ? entry : null;
}

/** 상세 방문 기록에도 저장해 새로고침 후의 목록 버튼이 동일한 목적지를 가리키게 한다. */
export function captureLogDetailReturn(view: Window, slug: string): LogListReturn | null {
  if (!/\/about-me\/log\/view\/?$/.test(view.location.pathname)
    || new URLSearchParams(view.location.search).get('slug') !== slug) return null;
  const transfer = detailTransfers.get(view);
  if (transfer?.slug === slug) {
    detailTransfers.delete(view);
    saveHistory(view, DETAIL_HISTORY_KEY, transfer);
    return transfer.entry;
  }
  return readDetailReturn(view, slug);
}

/** Link가 basePath를 붙이므로 앱 내부 경로로 바꾼다. 임의 외부 URL은 사용하지 않는다. */
export function logListReturnHref(value: LogListReturn | null): string {
  const entry = parseEntry(value);
  return entry ? entry.url.slice(entry.url.indexOf('/about-me/log')) : '/about-me/log';
}

export function requestLogListReturn(view: Window, value: LogListReturn | null): void {
  const entry = parseEntry(value);
  if (entry) listTransfers.set(view, entry);
  else listTransfers.delete(view);
}

/** 버튼으로 새로 열린 목록에도 뒤로가기와 같은 복귀 정보를 설치한다. */
export function takeLogListReturn(view: Window): LogListReturn | null {
  const entry = listTransfers.get(view);
  listTransfers.delete(view);
  if (entry?.url === listUrl(view.location)) {
    saveHistory(view, HISTORY_KEY, entry);
    return entry;
  }
  return readLogListReturn(view);
}

/** 관계도는 선택한 기록의 설명 패널을 복원하고, 사라진 글은 목록 시작으로 돌아간다. */
export function findLogListReturnTarget(root: HTMLElement, slug: string, mode: 'list' | 'map', available: boolean): HTMLElement | null {
  if (!available) return root;
  const target = mode === 'list'
    ? root.ownerDocument.getElementById(`log-card-${slug}`)
    : [...root.querySelectorAll<HTMLElement>('[data-log-return-slug]')]
      .find((node) => node.dataset.logReturnSlug === slug);
  return target && root.contains(target) ? target : null;
}

export function restoreLogListTarget(view: Window, target: HTMLElement): () => void {
  const from = view.scrollY;
  const top = Math.min(Math.max(0, from + target.getBoundingClientRect().top - 24),
    Math.max(0, view.document.documentElement.scrollHeight - view.innerHeight));
  const motion = view.document.documentElement.dataset.motion;
  const reduced = motion === 'off'
    || (motion !== 'on' && view.matchMedia('(prefers-reduced-motion: reduce)').matches);
  target.focus({ preventScroll: true });
  if (reduced || Math.abs(top - from) < 1) {
    view.scrollTo({ top, left: 0, behavior: 'instant' });
    return () => {};
  }
  // 브라우저의 history/기본 smooth 복원에 맡기지 않고 450ms 동안 목적지까지 이동한다.
  let frame = 0;
  let started: number | undefined;
  let stopped = false;
  const tick = (time: number) => {
    if (stopped || !target.isConnected) return;
    started ??= time;
    const progress = Math.min(1, (time - started) / 450);
    const eased = 1 - (1 - progress) ** 3;
    view.scrollTo({ top: from + (top - from) * eased, left: 0, behavior: 'instant' });
    if (progress < 1) frame = view.requestAnimationFrame(tick);
  };
  frame = view.requestAnimationFrame(tick);
  return () => { stopped = true; view.cancelAnimationFrame(frame); };
}
