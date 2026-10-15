import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  readMapNavigation, writeMapNavigation, readViewportEntries, rememberViewport,
  type LogMapNavigation, type MapViewport,
} from "./logMapState";
import type { LogTagGroup } from "./logGraph";

function persistNavigation(next: LogMapNavigation) {
  const url = writeMapNavigation(new URL(window.location.href), next);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

export function useLogMapNavigation(posts: { slug: string }[], groups: LogTagGroup[], filterTag: string | null) {
  const [state, setState] = useState(() => readMapNavigation(
    new URLSearchParams(window.location.search), window.matchMedia("(max-width: 700px)").matches, posts, groups, filterTag,
  ));
  useEffect(() => { persistNavigation(state); }, [state]);
  return [state, (next: LogMapNavigation) => { persistNavigation(next); setState(next); }] as const;
}

const mobileQuery = "(max-width: 700px)";
const subscribeMobile = (notify: () => void) => {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
export const useMobileLogMap = () => useSyncExternalStore(subscribeMobile,
  () => window.matchMedia(mobileQuery).matches, () => false);

const VIEWPORT_STORAGE_KEY = "portfolio.log-map.viewports.v1";
const viewportKey = (sceneKey: string) => JSON.stringify([window.location.pathname, window.innerWidth, window.innerHeight, sceneKey]);

/** 화면 위치는 같은 탭·데이터·화면 크기에만 복원한다. */
export function useLogMapViewport(sceneKey: string) {
  const [initialViewport] = useState(() => {
    try {
      return readViewportEntries(sessionStorage.getItem(VIEWPORT_STORAGE_KEY)).find((entry) => entry.key === viewportKey(sceneKey))?.viewport;
    } catch { return undefined; }
  });
  const flow = useRef<{ getViewport: () => MapViewport } | null>(null);
  const saveViewport = (viewport: MapViewport) => {
    try {
      sessionStorage.setItem(VIEWPORT_STORAGE_KEY, rememberViewport(sessionStorage.getItem(VIEWPORT_STORAGE_KEY), viewportKey(sceneKey), viewport));
    } catch { /* 저장소를 사용할 수 없어도 탐색은 계속한다. */ }
  };
  return {
    initialViewport,
    onInit: (instance: { getViewport: () => MapViewport }) => { flow.current = instance; },
    onMoveEnd: (_event: unknown, viewport: MapViewport) => saveViewport(viewport),
    save: () => { if (flow.current) saveViewport(flow.current.getViewport()); },
  };
}
