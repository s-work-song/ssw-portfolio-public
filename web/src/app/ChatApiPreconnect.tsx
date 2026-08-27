"use client";

import ReactDOM from "react-dom";

export function ChatApiPreconnect() {
  const baseUrl = process.env.NEXT_PUBLIC_RAG_API_BASE_URL?.trim();
  if (baseUrl) {
    try {
      const origin = new URL(baseUrl).origin;
      ReactDOM.preconnect(origin, { crossOrigin: "anonymous" });
      ReactDOM.prefetchDNS(origin);
    } catch {
      // 잘못된 선택 환경변수는 빌드와 페이지 렌더링을 방해하지 않는다.
    }
  }
  return null;
}
