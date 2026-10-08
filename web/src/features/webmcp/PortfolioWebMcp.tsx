'use client';

/**
 * WebMCP 도구 등록의 게이트다.
 *
 * WebMCP는 아직 실험 단계라 지원하는 브라우저·에이전트 하네스가 드물다.
 * 그런데 도구 정의(긴 설명 문구와 입력 스키마)는 첫 화면 번들에 항상 실려
 * 왔다. 그래서 `document.modelContext`가 실제로 있는 환경에서만 등록
 * 컴포넌트를 불러오도록 한 겹 감쌌다.
 *
 * 판정은 마운트 뒤에 한 번 한다. 정적 export라 서버 렌더 시점에는 document가
 * 없어, 렌더 중에 판정하면 하이드레이션이 어긋난다.
 */
import dynamic from 'next/dynamic';
import { useSyncExternalStore } from 'react';

/** 지원이 확인된 뒤에만 내려받는 도구 등록 컴포넌트다. */
const PortfolioWebMcpTools = dynamic(
  () => import('./PortfolioWebMcpTools').then((module) => module.PortfolioWebMcpTools),
  { ssr: false },
);

/**
 * 브라우저가 WebMCP를 알려 주는 통지 수단은 없다. 값이 바뀌는 것을 구독할
 * 방법이 없으므로 아무것도 하지 않는 해지 함수만 돌려준다.
 */
function subscribeToModelContext(): () => void {
  return () => undefined;
}

/** 지금 이 브라우저에 WebMCP 모델 컨텍스트가 있는지 읽는다. */
function readModelContextAvailable(): boolean {
  return typeof document.modelContext?.registerTool === 'function';
}

/** 서버 렌더에는 document가 없으므로 "지원하지 않음"으로 시작한다. */
function readModelContextAvailableOnServer(): boolean {
  return false;
}

/**
 * 브라우저가 WebMCP를 지원할 때만 도구 등록 컴포넌트를 붙인다.
 *
 * 지원하지 않으면 아무것도 그리지 않고, 등록 청크도 내려받지 않는다.
 * 기록 검색은 직접 검색 UI에서만 제공하고 에이전트 도구로는 등록하지 않는다.
 *
 * `useSyncExternalStore`를 쓰는 이유는 서버 스냅숏을 따로 줄 수 있어서다.
 * 렌더 중에 document를 바로 읽으면 정적 export의 하이드레이션이 어긋난다.
 */
export function PortfolioWebMcp() {
  const modelContextAvailable = useSyncExternalStore(
    subscribeToModelContext,
    readModelContextAvailable,
    readModelContextAvailableOnServer,
  );

  if (!modelContextAvailable) return null;
  return <PortfolioWebMcpTools />;
}
