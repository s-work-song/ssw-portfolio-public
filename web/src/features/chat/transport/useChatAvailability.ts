"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestChatStatus } from "./api";
import { createChatAvailabilityMonitor } from "./chatAvailability";
import type { ChatAvailability, ChatStatusResponse } from "../types";

/** 채팅 열기·명시적 재연결·실제 응답으로만 상태를 갱신한다. */
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
