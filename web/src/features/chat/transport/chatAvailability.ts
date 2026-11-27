import type { ChatAvailability, ChatStatusResponse } from "../types";

// 서버의 메타데이터 조회 10초 예산이 끝나 응답할 여유를 둔다. 재조회 주기가 아니다.
export const CHAT_STATUS_TIMEOUT_MS = 12_000;

type Status = ChatStatusResponse["status"];
type PendingCheck = { controller: AbortController; promise: Promise<void> };

/** 사용자 액션의 상태 확인만 실행한다. 자동 조회·재연결은 예약하지 않는다. */
export function createChatAvailabilityMonitor({
  requestStatus,
  onChange,
  isNetworkOnline,
}: {
  requestStatus: (signal: AbortSignal) => Promise<ChatStatusResponse>;
  onChange: (state: ChatAvailability) => void;
  isNetworkOnline: () => boolean;
}) {
  let active = false;
  let state: ChatAvailability = "idle";
  let pending: PendingCheck | null = null;
  let lastKnownStatus: Status | null = null;
  let consecutiveTimeouts = 0;

  const publish = (next: ChatAvailability) => {
    if (!active || state === next) return;
    state = next;
    onChange(next);
  };
  const cancelCheck = () => {
    const previous = pending;
    pending = null;
    previous?.controller.abort();
  };

  function refresh(options?: { silent?: boolean }): Promise<void> {
    if (!active) return Promise.resolve();
    // 사용자 액션이 겹쳐도 진행 중인 요청을 취소하거나 복제하지 않는다.
    if (pending) return pending.promise;
    if (!isNetworkOnline()) {
      lastKnownStatus = "offline";
      consecutiveTimeouts = 0;
      publish("offline");
      return Promise.resolve();
    }
    if (!options?.silent) publish("checking");
    const check: PendingCheck = {
      controller: new AbortController(),
      promise: Promise.resolve(),
    };
    pending = check;
    check.promise = (async () => {
      const { signal } = check.controller;
      let timedOut = false;
      let rejectAborted: () => void = () => undefined;
      const aborted = new Promise<never>((_resolve, reject) => {
        rejectAborted = () => reject(new DOMException("Status check aborted", "AbortError"));
        signal.addEventListener("abort", rejectAborted, { once: true });
      });
      const timeout = setTimeout(() => {
        timedOut = true;
        check.controller.abort();
      }, CHAT_STATUS_TIMEOUT_MS);
      try {
        const response = await Promise.race([
          Promise.resolve().then(() => {
            if (signal.aborted) throw new DOMException("Status check aborted", "AbortError");
            return requestStatus(signal);
          }),
          aborted,
        ]);
        if (active && pending === check) {
          consecutiveTimeouts = 0;
          lastKnownStatus = response.status;
          publish(response.status);
        }
      } catch {
        if (active && pending === check) {
          consecutiveTimeouts = timedOut ? consecutiveTimeouts + 1 : 0;
          // 확인된 온라인을 상태 조회 시간 초과 한 번만으로 부정하지 않는다.
          // 인증 실패·명시적 offline·연속 시간 초과는 그대로 반영한다.
          const next = timedOut && lastKnownStatus === "online" && consecutiveTimeouts === 1
            ? "online" : "offline";
          if (next === "offline") lastKnownStatus = next;
          publish(next);
        }
      } finally {
        clearTimeout(timeout);
        signal.removeEventListener("abort", rejectAborted);
        if (pending === check) {
          pending = null;
        }
      }
    })();
    return check.promise;
  }

  /** 실제 채팅 응답이 알려 준 최신 상태가 이전 상태 조회 응답보다 우선한다. */
  function report(status: Status) {
    if (!active) return;
    cancelCheck();
    consecutiveTimeouts = 0;
    // 응답을 표시하는 동안 브라우저 네트워크가 끊겼을 수도 있다.
    lastKnownStatus = isNetworkOnline() ? status : "offline";
    publish(lastKnownStatus);
  }

  return {
    start() {
      if (active) return;
      active = true;
    },
    refresh,
    report,
    stop() {
      active = false;
      cancelCheck();
    },
  };
}

/** 생성 시간 초과·실행 오류와 연결 실패를 구분하고, 실패 뒤 상태 GET은 추가하지 않는다. */
export function chatFailureAvailability(error: unknown): Status | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  return ["upstream_not_configured", "upstream_unreachable", "upstream_unavailable", "upstream_auth",
    "network"].includes(String(error.code)) ? "offline" : undefined;
}

/** 상태를 아직 확인하지 않은 카드 클릭은 별도 GET 없이 실제 설명 요청으로 확인한다. */
export function canSendUnverifiedExplanation(availability: ChatAvailability, responseMode: string): boolean {
  return availability === "idle" && responseMode === "explanation";
}

/** 첫 카드 질문은 idle 상태에서도 진행된다. 준비 화면으로 실제 대화를 가리지 않는다. */
export function chatAvailabilityPresentation(availability: ChatAvailability, hasConversation: boolean) {
  const showOfflineScreen = availability === "offline" && !hasConversation;
  const showOfflineBanner = availability === "offline" && hasConversation;
  return {
    showCheckingScreen: availability === "checking" || (availability === "idle" && !hasConversation),
    showOfflineScreen,
    showOfflineBanner,
    composerVisible: availability === "online" || showOfflineBanner ||
      (availability === "idle" && hasConversation),
  };
}
