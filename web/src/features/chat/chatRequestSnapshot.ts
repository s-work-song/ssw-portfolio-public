import type { ChatRequest } from "./types";

/** 보고 요청은 원본과 파생본 모두 깊은 복사 후 고정해 실제 관측을 보존한다. */
export function immutableChatRequest(request: ChatRequest): ChatRequest {
  const snapshot = structuredClone(request);
  const freeze = (value: unknown): void => {
    if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  };
  freeze(snapshot);
  return snapshot;
}
