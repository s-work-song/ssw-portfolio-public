export type LogMapNavigation = { mode: "all" | "tags"; groupId: string; selectedSlug: string | null };
export type MapViewport = { x: number; y: number; zoom: number };

type Group = { id: string; posts: { slug: string }[] };

/** 공유한 주소가 우선이며, 첫 방문의 작은 화면은 읽기 쉬운 태그 탐색으로 연다. */
export function readMapNavigation(params: URLSearchParams, mobile: boolean,
  posts: { slug: string }[], groups: Group[], filterTag: string | null = null): LogMapNavigation {
  const requestedMode = params.get("mapMode");
  const mode = requestedMode === "all" || requestedMode === "tags" ? requestedMode : mobile ? "tags" : "all";
  // 상단 필터로 고른 태그는 태그 선택 지도를 거치지 않고 소속 글을 바로 연다.
  const requestedGroup = filterTag === null ? params.get("mapTag")
    : `tag:${filterTag.normalize("NFKC").trim().toLowerCase()}`;
  const group = groups.find((item) => item.id === requestedGroup);
  const selectedSlug = params.get("mapPost");
  const selectable = mode === "tags" ? group?.posts ?? [] : posts;
  return { mode, groupId: group?.id ?? "", selectedSlug: selectable.some((post) => post.slug === selectedSlug) ? selectedSlug : null };
}

export function writeMapNavigation(url: URL, state: LogMapNavigation): URL {
  const next = new URL(url);
  next.searchParams.set("mapMode", state.mode);
  for (const [key, value] of [["mapTag", state.groupId], ["mapPost", state.selectedSlug]] as const) {
    if (value) next.searchParams.set(key, value);
    else next.searchParams.delete(key);
  }
  return next;
}

/** React Flow는 기존 선택 해제와 새 선택을 한 번에 알릴 수 있다. */
export function nextMapSelection(current: string | null,
  changes: { type: string; id?: string; selected?: boolean }[]): string | null {
  const selected = changes.findLast((change) => change.type === "select" && change.selected);
  if (selected?.id) return selected.id;
  return changes.some((change) => change.type === "select" && change.id === current && !change.selected) ? null : current;
}

export function isMapViewport(value: unknown): value is MapViewport {
  if (!value || typeof value !== "object") return false;
  const view = value as MapViewport;
  return Number.isFinite(view.x) && Number.isFinite(view.y) && Number.isFinite(view.zoom)
    && view.zoom >= 0.25 && view.zoom <= 1.8;
}

type ViewportEntry = { key: string; viewport: MapViewport };
export function readViewportEntries(raw: string | null): ViewportEntry[] {
  try {
    const entries: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(entries) ? entries.filter((entry): entry is ViewportEntry =>
      entry && typeof entry.key === "string" && isMapViewport(entry.viewport)).slice(-12) : [];
  } catch { return []; }
}

export function rememberViewport(raw: string | null, key: string, viewport: MapViewport): string {
  const entries = readViewportEntries(raw).filter((entry) => entry.key !== key);
  if (isMapViewport(viewport)) entries.push({ key, viewport });
  return JSON.stringify(entries.slice(-12));
}
