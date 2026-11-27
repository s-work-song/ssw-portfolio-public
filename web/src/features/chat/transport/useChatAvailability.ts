"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestChatStatus } from "./api";
import { createChatAvailabilityMonitor } from "./chatAvailability";
import type { ChatAvailability, ChatStatusResponse } from "../types";

/**
 * 페이지를 처음 열 때 한 번 조용히 확인하고(물어보기 버튼은 온라인이 확인돼야 보인다), 그 뒤로는
 * 채팅 열기·명시적 재연결·실제 응답으로만 상태를 갱신한다. 주기적인 재조회는 하지 않는다.
 */
export function useChatAvailability() {
  const [availability, setAvailability] = useState<ChatAvailability>("idle");
  const monitorRef = useRef<ReturnType<typeof createChatAvailabilityMonitor> | null>(null);

  useEffect(() => {
    const monitor = createChatAvailabilityMonitor({
      requestStatus: requestChatStatus,
      onChange: setAvailability,
      isNetworkOnline: () => navigator.onLine !== false,
    });
    monitorRef.current = monitor;
    const reportOffline = () => monitor.report("offline");
    window.addEventListener("offline", reportOffline);
    monitor.start();
    // 첫 확인은 '확인 중' 화면을 띄우지 않는다(silent). 결과가 오면 online/offline으로 바뀐다.
    void monitor.refresh({ silent: true });
    return () => {
      window.removeEventListener("offline", reportOffline);
      monitor.stop();
      if (monitorRef.current === monitor) monitorRef.current = null;
    };
  }, []);

  const refreshAvailability = useCallback((options?: { silent?: boolean }) =>
    monitorRef.current?.refresh(options) ?? Promise.resolve(), []);
  const reportAvailability = useCallback((status: ChatStatusResponse["status"]) => {
    monitorRef.current?.report(status);
  }, []);

  return { availability, refreshAvailability, reportAvailability };
}
