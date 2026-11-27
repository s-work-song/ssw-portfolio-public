'use client';

/**
 * 챗봇이 실행한 기록 검색 결과를 기록 목록 화면에 반영하는 다리다.
 *
 * 답변 안에서 검색이 일어나도 사용자는 목록 화면에서 그 결과를 눈으로
 * 확인하고 싶어 한다. ChatProvider가 도구 실행을 이벤트로 흘려보내면
 * 이 컴포넌트가 받아 목록 상태를 준비하고 그 화면으로 이동시킨다.
 *
 * WebMCP 지원 여부와 무관하게 항상 켜져 있어야 한다. 챗봇만 쓰는 방문자도
 * 같은 동작을 보기 때문이다. 그래서 도구 등록 컴포넌트와 분리해 두었다.
 */
import { useEffect } from 'react';
import { useChat } from '@/features/chat';
import {
  PORTFOLIO_MODEL_TOOL_EXECUTION_EVENT,
  preparePortfolioModelToolView,
  type PortfolioModelToolExecution,
} from './logSearchView';

/**
 * 모델 도구 실행 이벤트를 구독해 기록 목록 화면으로 이동시킨다.
 *
 * 검색은 비동기라, 이동 전에 이 컴포넌트가 사라졌다면(라우팅·언마운트)
 * AbortController로 결과를 버린다. 검색 실패는 개발 환경에서만 경고로
 * 남기고 화면에는 아무 영향도 주지 않는다. 답변 자체는 이미 도착해 있다.
 *
 * 화면에 그리는 것은 없다.
 */
export function PortfolioLogViewBridge() {
  const { navigateRoute } = useChat();

  useEffect(() => {
    const controller = new AbortController();
    const handleModelToolExecution = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<PortfolioModelToolExecution>;
      if (!event.detail || controller.signal.aborted) return;
      void preparePortfolioModelToolView(event.detail)
        .then((result) => {
          if (!controller.signal.aborted) navigateRoute(result.view.route);
        })
        .catch((error) => {
          if (!controller.signal.aborted && process.env.NODE_ENV !== 'production') {
            console.warn('모델 도구 검색 결과를 화면에 표시하지 못했습니다.', error);
          }
        });
    };
    window.addEventListener(
      PORTFOLIO_MODEL_TOOL_EXECUTION_EVENT,
      handleModelToolExecution,
    );
    return () => {
      controller.abort();
      window.removeEventListener(
        PORTFOLIO_MODEL_TOOL_EXECUTION_EVENT,
        handleModelToolExecution,
      );
    };
  }, [navigateRoute]);

  return null;
}
