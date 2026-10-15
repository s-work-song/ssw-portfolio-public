import type { ResearchTabId } from '@/data/research';

export interface ResearchTabSelectionRequest {
  activeTab: ResearchTabId;
  targetTab: ResearchTabId;
}

/** 확정 전 같은 선택 요청만 합치고, 다른 목표의 최신 요청은 허용한다. */
export function researchTabSelectionRequest(
  activeTab: ResearchTabId,
  targetTab: ResearchTabId,
  pending: ResearchTabSelectionRequest | null,
): ResearchTabSelectionRequest | null {
  if (targetTab === activeTab) return null;
  if (pending?.activeTab === activeTab && pending.targetTab === targetTab) {
    return null;
  }
  return { activeTab, targetTab };
}
