import { ACCENTS, type PortfolioAccent } from './settings.ts';

/** 서버의 cycle_portfolio_accent와 같은 색상 순서·간격이다. */
export const ACCENT_CYCLE_STEP_MS = 650;

export function accentCycleOrder(current: PortfolioAccent): PortfolioAccent[] {
  const index = ACCENTS.indexOf(current);
  if (index < 0) throw new TypeError('현재 포인트 색상이 올바르지 않습니다.');
  return [...ACCENTS.slice(index + 1), ...ACCENTS.slice(0, index + 1)];
}

export function waitForAbortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** 한 번의 도구 호출 안에서 색을 순회하고, 중단·실패하면 시작 색으로 복구한다. */
export async function runPortfolioAccentCycle({
  initialAccent,
  accents,
  stepMs,
  setAccent,
  signal,
}: {
  initialAccent: PortfolioAccent;
  accents: readonly PortfolioAccent[];
  stepMs: number;
  setAccent: (accent: PortfolioAccent) => void;
  signal: AbortSignal;
}): Promise<void> {
  let completed = false;
  try {
    for (let index = 0; index < accents.length; index += 1) {
      if (signal.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }
      setAccent(accents[index]);
      if (index + 1 < accents.length) {
        await waitForAbortableDelay(stepMs, signal);
      }
    }
    completed = true;
  } finally {
    if (!completed) setAccent(initialAccent);
  }
}
