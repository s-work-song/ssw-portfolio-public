import { ACTION_ROUTES } from "./constants.ts";
import {
  CHAT_ACTION_TARGET_ARRIVED_EVENT,
  normalizeNavigationPath,
  pathWithoutHash,
  type ChatActionTargetArrivedDetail,
} from "./navigation.ts";
import type { ActionId } from "./types";

interface GuidedTourNavigationRuntime {
  basePath?: string;
  events: Pick<EventTarget, "addEventListener" | "removeEventListener">;
  currentPath: () => string;
  navigateAction: (id: ActionId) => void;
  onBusyChange: (busy: boolean) => void;
  scheduleTimeout: (callback: () => void, delayMs: number) => () => void;
}

/** 렌더 반영 전의 연속 입력도 막고, 해당 목적지 도착 후에만 다음 이동을 받는다. */
export class GuidedTourNavigation {
  private release: (() => void) | null = null;
  private readonly runtime: GuidedTourNavigationRuntime;

  constructor(runtime: GuidedTourNavigationRuntime) {
    this.runtime = runtime;
  }

  get busy(): boolean {
    return this.release !== null;
  }

  run(id: ActionId, onAccepted: () => void): boolean {
    if (this.busy) return false;
    const route = ACTION_ROUTES[id];
    const anchor = route.split("#")[1];
    if (!anchor) return false;
    const path = normalizeNavigationPath(`${this.runtime.basePath ?? ""}${pathWithoutHash(route)}`);
    const finish = () => {
      if (this.release !== finish) return;
      this.release = null;
      cancelTimeout();
      this.runtime.events.removeEventListener(CHAT_ACTION_TARGET_ARRIVED_EVENT, arrived);
      this.runtime.onBusyChange(false);
    };
    const arrived = (event: Event) => {
      const detail = (event as CustomEvent<ChatActionTargetArrivedDetail>).detail;
      if (detail?.anchor !== anchor || normalizeNavigationPath(this.runtime.currentPath()) !== path) return;
      finish();
    };

    this.release = finish;
    this.runtime.events.addEventListener(CHAT_ACTION_TARGET_ARRIVED_EVENT, arrived);
    // 목적지를 찾지 못해 이동이 중단되어도 재시도할 수 있도록 잠금의 상한을 둔다.
    const cancelTimeout = this.runtime.scheduleTimeout(finish, 8_000);
    this.runtime.onBusyChange(true);
    try {
      onAccepted();
      this.runtime.navigateAction(id);
    } catch (error) {
      finish();
      throw error;
    }
    return true;
  }

  cancel(): void {
    this.release?.();
  }
}
