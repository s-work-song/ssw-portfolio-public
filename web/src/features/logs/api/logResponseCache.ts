export const LOG_CACHE_TTL_MS = 5 * 60 * 1000;
export const LOG_FALLBACK_MAX_AGE_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 40;

export type LogResponseSnapshot<T> = { value: T; receivedAt: number };

export function latestRecentLogSnapshot<T>(
  ...snapshots: (LogResponseSnapshot<T> | null | undefined)[]
): LogResponseSnapshot<T> | null {
  const now = Date.now();
  let latest: LogResponseSnapshot<T> | null = null;
  for (const snapshot of snapshots) {
    if (!snapshot || snapshot.receivedAt > now || now - snapshot.receivedAt >= LOG_FALLBACK_MAX_AGE_MS) continue;
    if (!latest || snapshot.receivedAt > latest.receivedAt) latest = snapshot;
  }
  return latest;
}

type Entry<T> = {
  snapshot?: LogResponseSnapshot<T>;
  expiresAt: number;
  pending?: Promise<T>;
  controller: AbortController;
  readers: number;
};

const aborted = () => new DOMException('기록 조회가 취소되었습니다.', 'AbortError');

/** 같은 탭의 화면 이동만 위한 메모리 캐시다. 새로고침·탭 종료 시 자연히 사라진다. */
export function createLogResponseCache<T>() {
  const entries = new Map<string, Entry<T>>();
  const createEntry = (snapshot?: LogResponseSnapshot<T> | null): Entry<T> => ({
    snapshot: snapshot ?? undefined, expiresAt: 0, controller: new AbortController(), readers: 0,
  });
  const keepRecent = (key: string, entry: Entry<T>) => {
    if (entries.get(key) !== entry) return;
    const snapshot = latestRecentLogSnapshot(entry.snapshot);
    if (snapshot) entries.set(key, createEntry(snapshot));
    else entries.delete(key);
  };

  return {
    clear() { entries.clear(); },
    /** 새 요청을 강제하되 마지막 성공본은 실패 시에만 쓸 수 있게 남긴다. */
    invalidate() {
      for (const [key, entry] of entries) keepRecent(key, entry);
    },
    getRecent(key: string) { return latestRecentLogSnapshot(entries.get(key)?.snapshot); },
    seed(key: string, snapshot: LogResponseSnapshot<T>) {
      const previous = entries.get(key);
      if (!latestRecentLogSnapshot(snapshot) || previous?.pending ||
          (previous?.snapshot && previous.snapshot.receivedAt >= snapshot.receivedAt)) return;
      entries.delete(key);
      entries.set(key, createEntry(snapshot));
      while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
    },
    get(
      key: string,
      load: (signal: AbortSignal) => Promise<T>,
      signal?: AbortSignal,
      allowFallbackOnError: (error: unknown) => boolean = () => true,
    ): Promise<T> {
      if (signal?.aborted) return Promise.reject(aborted());
      let entry = entries.get(key);
      if (!entry || (!entry.pending && entry.expiresAt <= Date.now())) {
        const created = createEntry(latestRecentLogSnapshot(entry?.snapshot));
        entries.set(key, created);
        created.pending = Promise.resolve().then(() => load(created.controller.signal)).then((value) => {
          if (entries.get(key) === created && !created.controller.signal.aborted) {
            const receivedAt = Date.now();
            created.snapshot = { value, receivedAt };
            created.expiresAt = receivedAt + LOG_CACHE_TTL_MS;
          }
          return value;
        }).catch((error: unknown) => {
          if (allowFallbackOnError(error)) keepRecent(key, created);
          else if (entries.get(key) === created) entries.delete(key);
          throw error;
        }).finally(() => { created.pending = undefined; });
        entry = created;
      }
      // 최근 사용한 항목을 남기고 검색 조합·본문이 무한히 쌓이지 않게 제한한다.
      entries.delete(key);
      entries.set(key, entry);
      while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
      if (!entry.pending) return Promise.resolve(entry.snapshot!.value).then((value) => {
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
              keepRecent(key, shared);
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
