import { normalizeNavigationPath, pathWithoutHash } from "./navigation.ts";

/** Next의 push 완료를 가정하지 않고 실제 브라우저 경로를 비교한다. */
export function navigationPathMatches(route: string, pathname: string, basePath = ""): boolean {
  return normalizeNavigationPath(pathname) ===
    normalizeNavigationPath(`${basePath}${pathWithoutHash(route)}`);
}

interface NavigationObservation {
  route: string;
  basePath: string;
  startedAt: number;
  minimumDelayMs: number;
  timeoutMs: number;
  signal: AbortSignal;
  read: () => { pathname: string; targetReady: boolean };
  subscribe: (arrived: (anchor: string) => void) => () => void;
  now: () => number;
  schedule: (callback: () => void, delay: number) => () => void;
}

/**
 * 시간 경과는 도착 증거가 아니다. 실제 경로·DOM 준비 및 앵커 도착 신호를
 * 모두 기다린다. 최소 관측은 tool 시작 기준, timeout은 감시 시작 기준이다.
 * DOM/타이머를 주입하므로 라우터나 브라우저 없이 같은 판정을 검증할 수 있다.
 */
export function observeToolNavigation(options: NavigationObservation): {
  completion: Promise<"arrived" | "failed">;
  cancel: () => void;
} {
  const hashIndex = options.route.indexOf("#");
  const anchor = hashIndex < 0 ? null : decodeURIComponent(options.route.slice(hashIndex + 1));
  const deadline = options.now() + options.timeoutMs;
  let anchorArrived = anchor === null;
  let settled = false;
  let cancelTimer = () => {};
  let unsubscribe = () => {};
  let cancel = () => {};
  const completion = new Promise<"arrived" | "failed">((resolve, reject) => {
    const cleanup = () => {
      cancelTimer();
      unsubscribe();
      options.signal.removeEventListener("abort", cancel);
    };
    cancel = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };
    const poll = () => {
      if (settled) return;
      if (options.signal.aborted) { cancel(); return; }
      try {
        const current = options.read();
        const now = options.now();
        const ready = anchorArrived && current.targetReady &&
          navigationPathMatches(options.route, current.pathname, options.basePath);
        if (ready && now <= deadline && now - options.startedAt >= options.minimumDelayMs) {
          settled = true;
          cleanup();
          resolve("arrived");
        } else if (now >= deadline) {
          settled = true;
          cleanup();
          resolve("failed");
        } else {
          cancelTimer = options.schedule(poll, Math.min(50, deadline - now));
        }
      } catch (error) {
        settled = true;
        cleanup();
        reject(error);
      }
    };
    if (options.signal.aborted) { cancel(); return; }
    unsubscribe = options.subscribe((arrivedAnchor) => {
      if (arrivedAnchor === anchor) anchorArrived = true;
    });
    options.signal.addEventListener("abort", cancel, { once: true });
    poll();
  });
  return { completion, cancel: () => cancel() };
}
