"use client";

import { useSyncExternalStore } from "react";
import { CHAT_DOCK_VIEWPORT_QUERY } from "../../portfolio-tools/schema.ts";

function subscribe(listener: () => void) {
  const media = window.matchMedia(CHAT_DOCK_VIEWPORT_QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
const browserSnapshot = () => window.matchMedia(CHAT_DOCK_VIEWPORT_QUERY).matches;
const serverSnapshot = () => false;

/**
 * 오른쪽 고정 패널을 놓을 만큼 넓은 화면인지 구독한다.
 *
 * 설정에서 dock을 골랐어도 이 값이 false면 플로팅으로 그린다. 좁은 화면에서
 * 본문을 반쯤 가리는 패널을 만들지 않기 위해서다. 채팅 창 배치와 배치 선택지의
 * 너비 안내가 같은 판단을 쓰도록 한곳에 둔다.
 */
export function useChatDockViewport(): boolean {
  return useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot);
}
