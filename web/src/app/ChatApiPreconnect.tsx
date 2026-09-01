"use client";

import ReactDOM from "react-dom";

export function ChatApiPreconnect() {
  const candidates = [
    process.env.NEXT_PUBLIC_RAG_API_BASE_URL?.trim(),
    process.env.NEXT_PUBLIC_INFERENCE_GATEWAY_URL?.trim(),
  ].filter((value): value is string => Boolean(value));
  const origins = new Set<string>();
  for (const candidate of candidates) {
    try {
      origins.add(new URL(candidate).origin);
    } catch {
      // 잘못된 선택 환경변수는 빌드와 페이지 렌더링을 방해하지 않는다.
    }
  }
  for (const origin of origins) {
    ReactDOM.preconnect(origin, { crossOrigin: "anonymous" });
    ReactDOM.prefetchDNS(origin);
  }
  return null;
}
