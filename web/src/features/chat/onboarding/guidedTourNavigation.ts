import { ACTION_ROUTES } from "../constants.ts";
import {
  CHAT_ACTION_TARGET_ABANDONED_EVENT,
  CHAT_ACTION_TARGET_ARRIVED_EVENT,
  normalizeNavigationPath,
  pathWithoutHash,
  type ChatActionTargetArrivedDetail,
} from "../navigation.ts";
import type { ActionId } from "../types";

interface GuidedTourNavigationRuntime {
  basePath?: string;
  events: Pick<EventTarget, "addEventListener" | "removeEventListener">;
  currentPath: () => string;
  navigateAction: (id: ActionId) => void;
  onBusyChange: (busy: boolean) => void;
  scheduleTimeout: (callback: () => void, delayMs: number) => () => void;
}

/**
 * 렌더 반영 전의 연속 입력도 막고, 해당 목적지 도착 후에만 다음 이동을 받는다.
 * 이동이 취소·대체돼 도착하지 못하고 끝나면 그 신호로 바로 푼다.
 */
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
      this.runtime.events.removeEventListener(CHAT_ACTION_TARGET_ABANDONED_EVENT, abandoned);
      this.runtime.onBusyChange(false);
    };
    const arrived = (event: Event) => {
      const detail = (event as CustomEvent<ChatActionTargetArrivedDetail>).detail;
      if (detail?.anchor !== anchor || normalizeNavigationPath(this.runtime.currentPath()) !== path) return;
      finish();
    };
    const abandoned = (event: Event) => {
      if ((event as CustomEvent<ChatActionTargetArrivedDetail>).detail?.anchor === anchor) finish();
    };

    this.release = finish;
    this.runtime.events.addEventListener(CHAT_ACTION_TARGET_ARRIVED_EVENT, arrived);
    this.runtime.events.addEventListener(CHAT_ACTION_TARGET_ABANDONED_EVENT, abandoned);
    // 어느 신호도 오지 않는 예외 상황에서도 버튼이 오래 잠기지 않도록 상한을 둔다.
    // 정상 이동은 페이지를 넘어가도 4초 안쪽이다.
    const cancelTimeout = this.runtime.scheduleTimeout(finish, 5_000);
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
