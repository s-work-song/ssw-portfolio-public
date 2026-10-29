export const LOG_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 40;

type Entry<T> = {
  value?: T;
  expiresAt: number;
  pending?: Promise<T>;
  controller: AbortController;
  readers: number;
};

const aborted = () => new DOMException('기록 조회가 취소되었습니다.', 'AbortError');

/** 같은 탭의 화면 이동만 위한 메모리 캐시다. 새로고침·탭 종료 시 자연히 사라진다. */
export function createLogResponseCache<T>() {
  const entries = new Map<string, Entry<T>>();

  return {
    clear() { entries.clear(); },
    get(key: string, load: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
      if (signal?.aborted) return Promise.reject(aborted());
      let entry = entries.get(key);
      if (entry && !entry.pending && entry.expiresAt <= Date.now()) {
        entries.delete(key);
        entry = undefined;
      }
      if (!entry) {
        const created: Entry<T> = { expiresAt: 0, controller: new AbortController(), readers: 0 };
        entries.set(key, created);
        created.pending = Promise.resolve().then(() => load(created.controller.signal)).then((value) => {
          if (entries.get(key) === created && !created.controller.signal.aborted) {
            created.value = value;
            created.expiresAt = Date.now() + LOG_CACHE_TTL_MS;
          }
          return value;
        }).catch((error: unknown) => {
          if (entries.get(key) === created) entries.delete(key);
          throw error;
        }).finally(() => { created.pending = undefined; });
        entry = created;
      }
      // 최근 사용한 항목을 남기고 검색 조합·본문이 무한히 쌓이지 않게 제한한다.
      entries.delete(key);
      entries.set(key, entry);
      while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
      if (!entry.pending) return Promise.resolve(entry.value as T).then((value) => {
        if (signal?.aborted) throw aborted();
        return value;
      });

      const shared = entry;
      shared.readers += 1;
      return new Promise<T>((resolve, reject) => {
        let settled = false;
        const finish = (action: () => void) => {
          if (settled) return;
          settled = true;
          signal?.removeEventListener('abort', cancel);
          shared.readers -= 1;
          action();
          // Strict Mode의 즉시 재구독은 합치되, 모든 화면이 떠나면 실제 요청도 취소한다.
          queueMicrotask(() => {
            if (shared.pending && shared.readers === 0) {
              if (entries.get(key) === shared) entries.delete(key);
              shared.controller.abort();
            }
          });
        };
        const cancel = () => finish(() => reject(aborted()));
        signal?.addEventListener('abort', cancel, { once: true });
        shared.pending!.then(
          (value) => finish(() => signal?.aborted ? reject(aborted()) : resolve(value)),
          (error: unknown) => finish(() => reject(error)),
        );
      });
    },
  };
}
