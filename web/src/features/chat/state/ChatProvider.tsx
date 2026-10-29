"use client";

import {
  isPortfolioTargetAligned,
  isPortfolioTargetReady,
} from '../../portfolio-tools/viewTargetVisibility';
import { createTargetLayoutStabilityCheck, resolvePortfolioNavigationTarget } from '../../portfolio-tools/experimentNavigation';
import { agentExperimentViewTargetForAnchor } from '../../experiments/data/agentExperimentViewTargets';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  useIsomorphicLayoutEffect,
  useTheme,
} from "../../settings/state/ThemeContext";
import { chatSettingsDataset } from "../../settings/state/settingsDataset";
import {
  ChatApiError,
  closeChatSession,
  createChatSession,
  streamChatToolResults,
  streamChatTurn,
  type ChatSession,
} from "../transport/api";
import {
  ACTION_LABELS,
  ACTION_ROUTES,
  CHAT_ANIMATIONS,
  CHAT_ANIMATION_STORAGE_KEY,
  CHAT_STREAM_ANIMATIONS,
  DEFAULT_CHAT_ANIMATION,
  DEFAULT_CHAT_STREAM_ANIMATION,
  DEFAULT_REASONING_ENABLED,
  GREETING,
  REASONING_STORAGE_KEY,
  SETTINGS_WEBMCP_GUIDE,
  STREAMING_STORAGE_KEY,
  STREAM_ANIMATION_STORAGE_KEY,
  TONE_STORAGE_KEY,
} from "../constants";
import { ChatContext, type ChatContextValue } from "./ChatContext";
import { ChatWidget } from "../ui/ChatWidget";
import {
  chatFailureRetryAfterMs,
  chatRetryWaitSeconds,
  failedChatMessage,
  logChatFailureLocally,
} from "../transport/chatFailure";
import { navigationPathMatches, observeToolNavigation } from "../workflow/toolNavigationObservation";
import { ChatTurnError, runChatTurn, type ChatTurnApi } from "../workflow/chatTurn";
import { runBrowserToolCalls, TOOL_OBSERVATION_MIN_DELAY_MS } from "../workflow/browserToolRunner";
import { loadMarkdownRenderer } from "../ui/MessageItem";
import { StreamRenderQueue } from "../streaming/streamRenderQueue";
import { useGuidedTour } from "../onboarding/useGuidedTour";
import { useChatAvailability } from "../transport/useChatAvailability";
import { canSendUnverifiedExplanation, chatFailureAvailability } from "../transport/chatAvailability";
import { readPortfolioViewState } from "../../webmcp/portfolioView";
import {
  executePortfolioUiTool as runPortfolioUiTool,
  type PortfolioUiToolExecutor,
  type PortfolioUiToolRuntime,
} from "../../portfolio-tools/portfolioUiToolExecutor";
import { CHOICE_SETTING_TARGETS, chatDockFitsViewport, type PortfolioChoiceSetting } from "../../portfolio-tools/schema";
import {
  CHAT_ACTION_NAVIGATE_EVENT,
  CHAT_ACTION_PAGE_ENTERED_EVENT,
  CHAT_ACTION_RESTORE_CHAT_INPUT_EVENT,
  CHAT_ACTION_TARGET_ABANDONED_EVENT,
  CHAT_ACTION_TARGET_ARRIVED_EVENT,
  CHAT_ACTION_TARGET_PREPARE_EVENT,
  aboutTabPathFromPath,
  normalizeNavigationPath,
  pathWithoutHash,
  type ChatActionNavigationOptions,
  type ChatActionNavigateDetail,
  type ChatActionPageEnteredDetail,
  type ChatActionTargetArrivedDetail,
  type ChatActionTargetPrepareDetail,
} from "../navigation";
import type {
  ActionId,
  AudienceChoice,
  ChatAnimation,
  ChatMessage,
  ChatStreamAnimation,
  ChatUiSettings,
  Tone,
  ToolResult,
} from "../types";

/** 모바일 취급 기준. 좁은 화면이면서 포인터가 손가락일 때만이다. */
const MOBILE_QUERY = "(max-width: 720px) and (pointer: coarse)";
/** OS의 모션 줄이기 설정을 읽는 미디어쿼리다. */
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
/**
 * 모바일에서 채팅을 열 때 밀어 넣는 히스토리 항목의 표식이다.
 * 이 표식이 있는 항목에서 뒤로가기가 오면 페이지 이동 대신 패널만 닫는다.
 */
const MOBILE_HISTORY_MARKER = "__portfolioChatOpen";
/** 모바일 패널이 화면 밖으로 빠져나가는 연출 길이다. */
const MOBILE_EXIT_DURATION_MS = 260;
/**
 * 도구가 지시한 이동 경로가 이 포트폴리오 내부 경로인지 확인한다.
 * 기록 상세는 `/about-me/log/view/?slug=...#section` 형태라 질의 문자열까지
 * 허용하되, `//호스트`와 스킴이 붙은 절대 주소는 통과시키지 않는다.
 */
const SAFE_ROUTE_PATTERN =
  /^\/(?!\/)[\w\-/]*(\?[\w\-=&%.+]{0,256})?(#[\w\-]{0,64})?$/u;
/** 재시도 대기 남은 시간을 화면에 보여줄 때 쓰는 갱신 주기다. */
const RETRY_WAIT_TICK_MS = 250;
/**
 * 액션 이동 시 문서 스크롤 연출의 길이 범위와 거리 환산 계수다.
 * 짧은 이동은 최소 시간을 보장해 뚝 끊기지 않게 하고, 먼 이동은 최대 시간에서
 * 잘라 답답해지지 않게 한다.
 */
const ACTION_SCROLL_MIN_DURATION_MS = 420;
const ACTION_SCROLL_MAX_DURATION_MS = 900;
const ACTION_SCROLL_MS_PER_PIXEL = 0.45;
/** 목적지 요소가 DOM에 나타나기를 기다리는 상한이다. 넘기면 포기한다. */
const ACTION_TARGET_WAIT_TIMEOUT_MS = 3_000;
/** 페이지 진입 신호가 오지 않아도 이 시간 뒤에는 스크롤을 시작한다. */
const ACTION_PAGE_ENTRY_FALLBACK_MS = 720;
/**
 * 이동 도구의 도착 신호를 기다리는 상한이다.
 * 페이지 진입 대기(720ms) + 앵커 대기(3초) + 스크롤 연출(최대 900ms)을
 * 모두 더한 최악의 정상 경로보다 넉넉해, 넘기면 정말 도착하지 못한 것이다.
 */
const TOOL_ARRIVAL_TIMEOUT_MS = 8_000;
/**
 * PC 패널이 퇴장 연출을 끝낼 때까지 DOM을 유지할 시간이다.
 * 슬라이드는 CSS 퇴장 애니메이션 길이에 맞추고, 젤리는 스프링이 수렴하며
 * 캔버스를 정리하는 시간까지 감안해 넉넉히 잡는다.
 */
const DESKTOP_EXIT_DURATION_MS: Readonly<
  Record<Exclude<ChatAnimation, "none">, number>
> = {
  slide: 240,
  jelly: 620,
};

/** 출발과 도착을 모두 부드럽게 만드는 가감속 곡선이다. */
function easeInOutCubic(progress: number): number {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

/** 빠르게 출발해 부드럽게 멈추는 감속 곡선이다. */
function easeOutCubic(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
}

/**
 * 스크롤 거리에 비례한 연출 시간을 정한다.
 * 최소·최대 사이로 잘라, 아주 짧은 이동도 최대한 눈에 보이게 하고 아주 긴
 * 이동도 지루해지지 않게 한다.
 */
function scrollDurationForDistance(distance: number): number {
  return Math.min(
    ACTION_SCROLL_MAX_DURATION_MS,
    Math.max(
      ACTION_SCROLL_MIN_DURATION_MS,
      Math.abs(distance) * ACTION_SCROLL_MS_PER_PIXEL,
    ),
  );
}

/**
 * 새 대화의 시작 상태를 만든다. 인사말 말풍선 하나뿐이다.
 * 대화 초기화 때마다 새 배열을 만들어, 이전 대화의 객체가 남지 않게 한다.
 */
function initialMessages(): ChatMessage[] {
  return [
    {
      id: "chat-greeting",
      role: "assistant",
      content: GREETING,
      kind: "greeting",
    },
  ];
}

/** 저장소에서 읽은 값이 지원하는 말투인지 확인한다. */
/** 저장소에서 읽은 값이 지원하는 패널 연출인지 확인한다. */
function isChatAnimation(value: string | null): value is ChatAnimation {
  return (
    value !== null && CHAT_ANIMATIONS.includes(value as ChatAnimation)
  );
}

/** 저장소에서 읽은 값이 지원하는 스트리밍 텍스트 연출인지 확인한다. */
function isStreamAnimation(
  value: string | null,
): value is ChatStreamAnimation {
  return (
    value !== null &&
    CHAT_STREAM_ANIMATIONS.includes(value as ChatStreamAnimation)
  );
}

/** 서버 채팅이 만료돼 새 채팅으로 이어 갈 때 화면에 남기는 안내다. */
const SESSION_RENEWED_NOTICE =
  "이전 대화가 만료되어 새 대화로 이어서 답합니다. 앞선 대화 내용은 이어지지 않습니다.";

/** 턴 진행에 쓰는 서버 API 묶음이다. 테스트에서 갈아 끼울 수 있도록 한 객체로 모은다. */
const CHAT_TURN_API: ChatTurnApi = {
  createSession: createChatSession,
  streamTurn: streamChatTurn,
  streamToolResults: streamChatToolResults,
};

/** 실패한 질문을 같은 말풍선에서 다시 보내기 위한 재료다. */
interface PendingTurn {
  message: string;
  userMessageId: string;
  /** 상태 확인 전 카드 설명처럼 보낼 때 허용된 조건을 재시도에도 그대로 적용한다. */
  responseMode: "default" | "explanation";
  assistantMessageId?: string;
}

/**
 * 챗봇의 모든 상태와 부작용을 한곳에 모아 전역에 공급하는 Provider다.
 *
 * 담당은 크게 다섯 가지다. (1) 대화·요청 수명주기(전송·스트리밍·중단·재시도),
 * (2) 연결 상태 확인, (3) 설정값의 저장소 영속화, (4) 액션·도구가 지시한
 * 화면 이동과 앵커 스크롤 연출, (5) 모델 도구 실행을 실제 UI 변경으로 옮기기.
 *
 * 렌더와 무관하게 최신 값을 읽어야 하는 것(대화 배열, 현재 포인트 색, 이동
 * 함수)은 ref에 담는다. 그래야 전송·요청 함수가 매 delta마다 새로 만들어지지
 * 않고, 그 위에 얹힌 WebMCP 도구 등록도 마운트당 한 번만 일어난다.
 *
 * 언마운트 시 진행 중인 요청·타이머·애니메이션 프레임을 모두 정리한다.
 */
export function ChatProvider({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    mode,
    accent,
    motion,
    pageTransition,
    chatLayout,
    chatFont,
    chatFontSize,
    setMode,
    setAccent,
    setChatLayout,
    setChatFont,
    setChatFontSize,
  } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [closeAnimationEpoch, setCloseAnimationEpoch] = useState(0);
  const [panelGeneration, setPanelGeneration] = useState(0);
  const [focusInputOnOpen, setFocusInputOnOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { availability, refreshAvailability, reportAvailability } = useChatAvailability();
  const [error, setError] = useState<string | null>(null);
  /** 429 등으로 재시도까지 남은 초다. 0이면 바로 재시도할 수 있다. */
  const [retryWaitSeconds, setRetryWaitSeconds] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [audience, setAudience] = useState<AudienceChoice | null>(null);
  const [tone, setTone] = useState<Tone>("official");
  const [streamingEnabled, setStreamingEnabledState] = useState(true);
  const [reasoningEnabled, setReasoningEnabledState] = useState(
    DEFAULT_REASONING_ENABLED,
  );
  const [chatAnimation, setChatAnimationState] = useState<ChatAnimation>(
    DEFAULT_CHAT_ANIMATION,
  );
  const [streamAnimation, setStreamAnimationState] =
    useState<ChatStreamAnimation>(DEFAULT_CHAT_STREAM_ANIMATION);
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const idRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const renderQueueRef = useRef<StreamRenderQueue | null>(null);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const retryRef = useRef<PendingTurn | null>(null);
  // 대화 이력은 서버 채팅(메인·작업 세션)이 보관한다. 브라우저는 접근 권한만 메모리에 둔다.
  const sessionRef = useRef<ChatSession | null>(null);
  /** 페이지를 떠날 때 채팅을 닫았는지다. 뒤로가기로 화면이 복원돼도 서버 대화는 이어지지 않는다. */
  const sessionClosedOnPageHideRef = useRef(false);
  const retryWaitTimerRef = useRef<number | null>(null);
  const retryWaitDeadlineRef = useRef(0);
  /** 서버 not-before는 중단·새 대화와 독립적이며 이 Provider 마운트 동안 유지한다. */
  const requestCooldownDeadlineRef = useRef(0);
  /** 렌더 사이클과 무관하게 최신 대화를 읽기 위한 참조다. */
  const messagesRef = useRef<ChatMessage[]>(messages);
  const mobileHistoryEntryRef = useRef(false);
  const pendingActionRouteRef = useRef<{ route: string; options?: ChatActionNavigationOptions } | null>(null);
  const pendingActionAnchorRef = useRef<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const closeAnimationEpochRef = useRef(0);
  const pendingOpenAfterCloseRef = useRef<Parameters<ChatContextValue["open"]>[0] | null>(null);
  const actionScrollFrameRef = useRef<number | null>(null);
  const actionScrollTimerRef = useRef<number | null>(null);
  const actionTopScrollFrameRef = useRef<number | null>(null);
  const actionPageEntryTimerRef = useRef<number | null>(null);
  const actionTargetHighlightTimerRef = useRef<number | null>(null);
  const chatInputRestoreTimerRef = useRef<number | null>(null);
  const highlightedActionTargetRef = useRef<HTMLElement | null>(null);
  const pendingActionPathRef = useRef<string | null>(null);
  const pendingActionAwaitingPageEntryRef = useRef(false);
  const activeActionNavigationRouteRef = useRef<string | null>(null);
  const activeActionNavigationOptionsRef = useRef<ChatActionNavigationOptions | undefined>(undefined);
  const actionNavigationAbortCleanupRef = useRef<(() => void) | null>(null);
  const actionNavigationTokenRef = useRef(0);
  const actionScrollTokenRef = useRef(0);
  const pendingChatNavigationFocusRef = useRef(false);
  const navigateRouteRef = useRef<(route: string, options?: ChatActionNavigationOptions) => void>(() => undefined);
  /** 설정 도구가 "요청값 = 실제값"을 확인할 때 읽는 최신 UI 설정이다. */
  const uiSettingsRef = useRef<ChatUiSettings | null>(null);
  /** 아직 결말이 나지 않은 도구 결과 감시자들의 정리 함수다. */
  const toolResultWatchersRef = useRef<Set<() => void>>(new Set());
  const isOpenRef = useRef(false);
  const isClosingRef = useRef(false);
  const cleanupHistoryPopRef = useRef(false);
  const consumeHistoryOnCloseRef = useRef(false);

  /**
   * 말풍선에 붙일 고유 id를 만든다.
   *
   * 렌더와 무관한 카운터를 쓰므로 같은 내용이 두 번 와도 키가 겹치지 않는다.
   * 대화가 초기화돼도 카운터는 이어져, 되살아난 이전 키와 충돌하지 않는다.
   */
  const nextId = useCallback((prefix: string) => {
    idRef.current += 1;
    return `${prefix}-${idRef.current}`;
  }, []);

  // 요청 함수가 messages를 의존성으로 갖지 않도록 최신 대화를 ref에 비춘다.
  // 그러지 않으면 delta마다 sendMessage가 새로 만들어져 도구 등록까지 흔들린다.
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /** 현재 재시도와 독립 서버 cooldown 중 더 늦은 시각을 화면에 반영한다. */
  const syncRetryWait = useCallback(() => {
    if (retryWaitTimerRef.current !== null) {
      window.clearInterval(retryWaitTimerRef.current);
      retryWaitTimerRef.current = null;
    }
    const update = () => {
      const remaining = chatRetryWaitSeconds(
        Math.max(retryWaitDeadlineRef.current, requestCooldownDeadlineRef.current), Date.now(),
      );
      setRetryWaitSeconds(remaining);
      if (remaining === 0 && retryWaitTimerRef.current !== null) {
        window.clearInterval(retryWaitTimerRef.current);
        retryWaitTimerRef.current = null;
      }
      return remaining;
    };
    if (update() > 0) retryWaitTimerRef.current = window.setInterval(update, RETRY_WAIT_TICK_MS);
  }, []);

  /** 현재 flow의 대기만 취소한다. 서버가 정한 다음 전송 가능 시각은 지우지 않는다. */
  const clearRetryWait = useCallback(() => {
    retryWaitDeadlineRef.current = 0;
    syncRetryWait();
  }, [syncRetryWait]);

  /** 자동 복구·수동 재시도 버튼에 같은 남은 대기 시간을 표시한다. */
  const beginRetryWait = useCallback((durationMs: number) => {
    retryWaitDeadlineRef.current = durationMs > 0 ? Date.now() + durationMs : 0;
    syncRetryWait();
  }, [syncRetryWait]);

  useEffect(
    () => () => {
      if (retryWaitTimerRef.current !== null) {
        window.clearInterval(retryWaitTimerRef.current);
        retryWaitTimerRef.current = null;
      }
    },
    [],
  );

  // 채팅 설정의 초기화·복원은 아래 레이아웃 이펙트가 맡는다. 모두 첫 페인트보다
  // 앞서야 해서 아이소모픽 레이아웃 이펙트를 쓴다. useEffect로 처리하면
  // 하이드레이션이 그린 기본값이 한 번 화면에 나갔다가 바뀌어, 설정 화면의
  // 선택 표시가 새로고침마다 깜빡인다. 값이 깨졌으면 기본값으로 덮어써 다음
  // 방문부터는 정상 값이 읽히게 한다.
  useIsomorphicLayoutEffect(() => {
    setReasoningEnabledState(DEFAULT_REASONING_ENABLED);
    try {
      window.localStorage.setItem(
        REASONING_STORAGE_KEY,
        String(DEFAULT_REASONING_ENABLED),
      );
    } catch {
      // 저장소를 사용할 수 없어도 안전한 기본값인 사고모드 OFF로 동작한다.
    }
  }, []);

  // 저장된 말투를 복원한다. 알 수 없는 값이면 기본 말투로 덮어쓴다.
  useIsomorphicLayoutEffect(() => {
    try {
      const storedTone = window.localStorage.getItem(TONE_STORAGE_KEY);
      if (storedTone !== "official") {
        window.localStorage.setItem(TONE_STORAGE_KEY, "official");
      }
    } catch {
      // 저장소를 사용할 수 없는 브라우저에서도 기본 말투로 계속 동작한다.
    }
  }, []);

  // 저장된 스트리밍 사용 여부를 복원한다.
  useIsomorphicLayoutEffect(() => {
    try {
      const stored = window.localStorage.getItem(STREAMING_STORAGE_KEY);
      if (stored === "true" || stored === "false") {
        setStreamingEnabledState(stored === "true");
      } else if (stored !== null) {
        window.localStorage.setItem(STREAMING_STORAGE_KEY, "true");
      }
    } catch {
      // 저장소를 사용할 수 없어도 안전한 기본값인 streaming ON으로 동작한다.
    }
  }, []);

  // 저장된 패널 연출을 복원한다.
  useIsomorphicLayoutEffect(() => {
    try {
      const stored = window.localStorage.getItem(CHAT_ANIMATION_STORAGE_KEY);
      if (isChatAnimation(stored)) {
        setChatAnimationState(stored);
      } else if (stored !== null) {
        window.localStorage.setItem(
          CHAT_ANIMATION_STORAGE_KEY,
          DEFAULT_CHAT_ANIMATION,
        );
      }
    } catch {
      // 저장소를 사용할 수 없어도 기본 연출인 젤리로 계속 동작한다.
    }
  }, []);

  // 저장된 스트리밍 텍스트 연출을 복원한다.
  useIsomorphicLayoutEffect(() => {
    try {
      const stored = window.localStorage.getItem(STREAM_ANIMATION_STORAGE_KEY);
      if (isStreamAnimation(stored)) {
        setStreamAnimationState(stored);
      } else if (stored !== null) {
        window.localStorage.setItem(
          STREAM_ANIMATION_STORAGE_KEY,
          DEFAULT_CHAT_STREAM_ANIMATION,
        );
      }
    } catch {
      // 저장소를 사용할 수 없어도 기본 연출인 단어 페이드로 계속 동작한다.
    }
  }, []);

  // 채팅 설정을 문서 루트의 data 속성으로 내보낸다. 설정 화면의 "선택됨"
  // 표시를 그리는 CSS가 이 속성을 본다. <head>의 부트 스크립트가 하이드레이션
  // 전에 같은 키·같은 값을 이미 심어 두므로, 여기서 덮어써도 화면은 그대로다.
  // 첫 페인트 전에 끝나야 해서 레이아웃 이펙트를 쓴다.
  useIsomorphicLayoutEffect(() => {
    Object.assign(
      document.documentElement.dataset,
      chatSettingsDataset({
        tone,
        streamingEnabled,
        streamAnimation,
        chatAnimation,
      }),
    );
  }, [chatAnimation, streamAnimation, streamingEnabled, tone]);

  // OS의 모션 줄이기 설정을 구독한다. 설정 화면의 모션 정책과 함께 판정에 쓴다.
  useEffect(() => {
    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const update = () => setSystemReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  // 언마운트 시 남아 있는 요청·타이머·프레임·강조 표시를 한곳에서 정리한다.
  // 하나라도 남으면 사라진 화면을 향해 setState가 일어난다.
  useEffect(() => {
    mountedRef.current = true;
    // 탭을 닫거나 다른 사이트로 떠나면 서버 채팅을 닫는다. 돌아오면 다음 질문이 새 채팅을 연다.
    const handlePageHide = () => {
      const session = sessionRef.current;
      sessionRef.current = null;
      if (!session) return;
      sessionClosedOnPageHideRef.current = true;
      closeChatSession(session);
    };
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("pagehide", handlePageHide);
      handlePageHide();
      pendingOpenAfterCloseRef.current = null;
      closeAnimationEpochRef.current += 1;
      renderQueueRef.current?.cancel();
      actionNavigationAbortCleanupRef.current?.();
      abortRef.current?.abort();
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
      if (actionScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(actionScrollFrameRef.current);
      }
      if (actionScrollTimerRef.current !== null) {
        window.clearTimeout(actionScrollTimerRef.current);
      }
      if (actionTopScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(actionTopScrollFrameRef.current);
      }
      if (actionPageEntryTimerRef.current !== null) {
        window.clearTimeout(actionPageEntryTimerRef.current);
      }
      if (actionTargetHighlightTimerRef.current !== null) {
        window.clearTimeout(actionTargetHighlightTimerRef.current);
      }
      if (chatInputRestoreTimerRef.current !== null) {
        window.clearTimeout(chatInputRestoreTimerRef.current);
      }
      highlightedActionTargetRef.current?.removeAttribute(
        "data-chat-action-target",
      );
    };
  }, []);

  /**
   * 모션 정책이 꺼져 있거나 시스템이 모션 줄이기를 요구하면 연출을 생략한다.
   * 설정 화면의 모션 판정과 같은 규칙을 쓰고, 두 애니메이션 설정이 함께 따른다.
   */
  const motionSuppressed =
    motion === "off" || (motion === "system" && systemReducedMotion);

  /**
   * 라우트와 해시가 함께 바뀌는 채팅 액션에서는 브라우저의 native smooth
   * scroll이 중간 프레임을 생략하기도 한다. 문서 스크롤을 직접 보간해
   * 이동 거리에 관계없이 출발과 도착을 눈으로 따라갈 수 있게 한다.
   */
  const animateDocumentScroll = useCallback(
    (
      requestedTop: number,
      setFrame: (frame: number | null) => void,
      onComplete: () => void,
      easing: "ease-in-out" | "ease-out" = "ease-in-out",
      canContinue: () => boolean = () => true,
    ) => {
      if (!canContinue()) return;
      const scroller = document.scrollingElement;
      if (!scroller) {
        setFrame(null);
        onComplete();
        return;
      }

      const startTop = scroller.scrollTop;
      const maximumTop = Math.max(0, scroller.scrollHeight - window.innerHeight);
      const targetTop = Math.min(maximumTop, Math.max(0, requestedTop));
      const distance = targetTop - startTop;

      if (motionSuppressed || Math.abs(distance) <= 1) {
        scroller.scrollTo({ top: targetTop, behavior: "instant" });
        setFrame(null);
        onComplete();
        return;
      }

      const duration = scrollDurationForDistance(distance);
      const startedAt = window.performance.now();
      const step = (timestamp: number) => {
        if (!canContinue()) return;
        const progress = Math.min(1, (timestamp - startedAt) / duration);
        const easedProgress =
          easing === "ease-out"
            ? easeOutCubic(progress)
            : easeInOutCubic(progress);
        scroller.scrollTo({
          top: startTop + distance * easedProgress,
          behavior: "instant",
        });

        if (progress >= 1) {
          scroller.scrollTo({ top: targetTop, behavior: "instant" });
          setFrame(null);
          onComplete();
          return;
        }
        setFrame(window.requestAnimationFrame(step));
      };

      setFrame(window.requestAnimationFrame(step));
    },
    [motionSuppressed],
  );

  /** 패널 연출. 모바일 구간은 기존 동작을 유지하므로 이 값을 보지 않는다. */
  const effectiveChatAnimation = useMemo<ChatAnimation>(
    () => (motionSuppressed ? "none" : chatAnimation),
    [chatAnimation, motionSuppressed],
  );

  /** 응답 텍스트 연출. 텍스트 수준이라 모바일에서도 그대로 적용된다. */
  const effectiveStreamAnimation = useMemo<ChatStreamAnimation>(
    () => (motionSuppressed ? "none" : streamAnimation),
    [motionSuppressed, streamAnimation],
  );

  /**
   * 스트리밍 텍스트 연출을 바꾸고 저장소에 남긴다.
   * 허용 목록 밖 값은 무시한다. 이 함수는 도구 실행 경로로도 불린다.
   */
  const setStreamAnimation = useCallback((animation: ChatStreamAnimation) => {
    if (!CHAT_STREAM_ANIMATIONS.includes(animation)) return;
    setStreamAnimationState(animation);
    try {
      window.localStorage.setItem(STREAM_ANIMATION_STORAGE_KEY, animation);
    } catch {
      // 저장 실패가 현재 브라우저 세션의 설정 변경을 막지는 않는다.
    }
  }, []);

  /** 지금 화면 설정이다. 도구가 읽는 ref와 설정 선택지의 현재 값 표시가 같은 값을 쓴다. */
  const uiSettings = useMemo<ChatUiSettings>(() => ({
    theme: mode, accent, chatLayout, chatFont, chatFontSize, streamAnimation,
  }), [accent, chatFont, chatFontSize, chatLayout, mode, streamAnimation]);
  const portfolioUiToolRuntimeRef = useRef<PortfolioUiToolRuntime | null>(null);
  // 도구 실행에 필요한 setter 묶음을 ref에 갈아 끼운다. 실행기 자체의
  // 아이덴티티는 고정된 채로 최신 setter만 바뀐다.
  useEffect(() => {
    uiSettingsRef.current = uiSettings;
    portfolioUiToolRuntimeRef.current = {
      getSettings: () => ({
        theme: mode,
        accent,
        chatLayout,
        chatFont,
        chatFontSize,
        streamAnimation,
      }),
      setMode,
      setAccent,
      setChatLayout,
      setChatFont,
      setChatFontSize,
      setStreamAnimation,
      navigateRoute: (route, options) => navigateRouteRef.current(route, options),
    };
  }, [
    accent,
    chatFont,
    chatFontSize,
    chatLayout,
    mode,
    setAccent,
    setChatFont,
    setChatFontSize,
    setChatLayout,
    setMode,
    setStreamAnimation,
    streamAnimation,
    uiSettings,
  ]);

  // 결말을 기다리던 도구 결과 감시자는 언마운트와 함께 모두 걷는다.
  // 남겨 두면 사라진 말풍선을 향해 타이머와 리스너가 계속 살아 있다.
  useEffect(
    () => () => {
      const watchers = toolResultWatchersRef.current;
      watchers.forEach((dispose) => dispose());
      watchers.clear();
    },
    [],
  );

  /**
   * 챗봇과 WebMCP가 공유하는 UI 도구 실행 진입점이다.
   *
   * 실제 setter 묶음은 ref에 담아 두고 여기서 꺼내 쓴다. 덕분에 이 함수의
   * 아이덴티티가 테마·설정 변경마다 흔들리지 않아, 이를 의존성으로 삼는
   * WebMCP 도구 등록이 다시 일어나지 않는다.
   * 런타임이 아직 준비되지 않았으면 오류를 던진다.
   */
  const executePortfolioUiTool = useCallback<PortfolioUiToolExecutor>(
    (command) => {
      const runtime = portfolioUiToolRuntimeRef.current;
      if (!runtime) {
        throw new Error('포트폴리오 UI 도구 실행기를 사용할 수 없습니다.');
      }
      return runPortfolioUiTool(command, runtime);
    },
    [],
  );

  /**
   * 도구가 화면을 옮긴 뒤 채팅 입력창으로 포커스를 되돌린다.
   *
   * 이동을 요청한 사람은 곧바로 다음 말을 이어 가려 하므로, 도착 직후 입력창이
   * 다시 잡혀야 한다. 이동 예약이 없었다면 아무 일도 하지 않는다. 도착 애니메이션
   * 위에서 포커스를 옮기면 스크롤이 튀어, 짧게 지연한 뒤 이벤트로 알린다.
   */
  const restoreChatInputAfterNavigation = useCallback(() => {
    if (!pendingChatNavigationFocusRef.current) return;
    pendingChatNavigationFocusRef.current = false;
    if (chatInputRestoreTimerRef.current !== null) {
      window.clearTimeout(chatInputRestoreTimerRef.current);
    }
    chatInputRestoreTimerRef.current = window.setTimeout(() => {
      chatInputRestoreTimerRef.current = null;
      window.dispatchEvent(new Event(CHAT_ACTION_RESTORE_CHAT_INPUT_EVENT));
    }, 220);
  }, []);

  /**
   * 끝난 이동의 타이머·프레임·취소 구독만 정리한다. 오래된 콜백은 토큰으로 걸러낸다.
   * 앵커에 도착하지 못한 채 끝났으면 그 사실을 알려, 도착을 기다리던 쪽(둘러보기)이 바로 잠금을 풀게 한다.
   */
  const clearActionNavigation = useCallback((arrived = false) => {
    const abandonedAnchor = arrived ? null : pendingActionAnchorRef.current;
    actionScrollTokenRef.current += 1;
    if (actionScrollFrameRef.current !== null) window.cancelAnimationFrame(actionScrollFrameRef.current);
    if (actionTopScrollFrameRef.current !== null) window.cancelAnimationFrame(actionTopScrollFrameRef.current);
    if (actionScrollTimerRef.current !== null) window.clearTimeout(actionScrollTimerRef.current);
    if (actionPageEntryTimerRef.current !== null) window.clearTimeout(actionPageEntryTimerRef.current);
    actionScrollFrameRef.current = null;
    actionTopScrollFrameRef.current = null;
    actionScrollTimerRef.current = null;
    actionPageEntryTimerRef.current = null;
    pendingActionAnchorRef.current = null;
    pendingActionPathRef.current = null;
    pendingActionAwaitingPageEntryRef.current = false;
    activeActionNavigationRouteRef.current = null;
    activeActionNavigationOptionsRef.current = undefined;
    actionNavigationAbortCleanupRef.current?.();
    actionNavigationAbortCleanupRef.current = null;
    if (abandonedAnchor) {
      window.dispatchEvent(new CustomEvent<ChatActionTargetArrivedDetail>(
        CHAT_ACTION_TARGET_ABANDONED_EVENT,
        { detail: { anchor: abandonedAnchor } },
      ));
    }
  }, []);

  /**
   * 예약해 둔 앵커로 문서를 스크롤하고 도착 지점을 잠시 강조한다.
   *
   * 앵커 요소는 페이지 전환 직후 아직 없을 수 있어 50ms 간격으로 최대 3초까지
   * 기다린다. 페이지·패널 진입 애니메이션이 재생 중이면 끝나기를 기다린 뒤
   * 위치를 잰다. 애니메이션 도중의 좌표로 스크롤하면 엉뚱한 곳에서 멈춘다.
   *
   * 도착하면 포커스·강조를 먼저 적용하고 도착 이벤트를 알린다. 강조는 1.65초
   * 뒤에 거두며 모션 억제 시 실험 목적지만 정적인 테두리로 표시한다. 끝내 요소를 찾지 못하면
   * 예약을 비우고 조용히 포기한다.
   */
  const scrollToPendingActionAnchor = useCallback(() => {
    const anchor = pendingActionAnchorRef.current;
    if (!anchor) return;
    const navigationToken = actionNavigationTokenRef.current;
    const scrollToken = ++actionScrollTokenRef.current;
    const options = activeActionNavigationOptionsRef.current;
    const targetPath = pendingActionPathRef.current;
    const experimentDestination = agentExperimentViewTargetForAnchor(anchor);
    const checkStableLayout = createTargetLayoutStabilityCheck();
    const hasStableTargetLayout = (target: HTMLElement | null) => !experimentDestination
      || checkStableLayout(target, window.performance.now(),
        document.scrollingElement?.scrollTop ?? window.scrollY, window.innerWidth, window.innerHeight);
    const isCurrent = () => actionNavigationTokenRef.current === navigationToken
      && actionScrollTokenRef.current === scrollToken && pendingActionAnchorRef.current === anchor;
    if (actionScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(actionScrollFrameRef.current);
    }
    if (actionScrollTimerRef.current !== null) {
      window.clearTimeout(actionScrollTimerRef.current);
    }

    const targetHash = `#${encodeURIComponent(anchor)}`;
    if (window.location.hash !== targetHash) {
      const oldUrl = window.location.href;
      const targetUrl = new URL(oldUrl);
      targetUrl.hash = targetHash;
      const nextUrl = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
      window.history.pushState(window.history.state, "", nextUrl);
      window.dispatchEvent(
        new HashChangeEvent("hashchange", {
          oldURL: oldUrl,
          newURL: targetUrl.href,
        }),
      );
    }

    const canContinue = () => {
      if (!isCurrent()) return false;
      if (options?.signal?.aborted || window.location.hash !== targetHash
        || !targetPath || !navigationPathMatches(targetPath, window.location.pathname, process.env.NEXT_PUBLIC_BASE_PATH ?? "")) {
        clearActionNavigation();
        return false;
      }
      return true;
    };
    if (!canContinue()) return;
    // URL이 그대로여도 이전 수동 선택을 복원한 뒤 실제 본문 커밋을 기다린다.
    window.dispatchEvent(new CustomEvent<ChatActionTargetPrepareDetail>(CHAT_ACTION_TARGET_PREPARE_EVENT, {
      detail: { anchor, signal: options?.signal },
    }));
    const startedAt = window.performance.now();
    const abandonPendingAction = () => {
      if (!isCurrent()) return;
      clearActionNavigation();
      restoreChatInputAfterNavigation();
    };
    const retryOrAbandon = () => {
      if (!canContinue()) return;
      if (
        window.performance.now() - startedAt <
        ACTION_TARGET_WAIT_TIMEOUT_MS
      ) {
        actionScrollTimerRef.current = window.setTimeout(scroll, 50);
      } else {
        abandonPendingAction();
      }
    };
    const completeTargetArrival = (target: HTMLElement) => {
      if (!canContinue()) return;
      const scroller = document.scrollingElement;
      const scrollTop = scroller?.scrollTop ?? window.scrollY;
      const maximumScrollTop = Math.max(
        0,
        (scroller?.scrollHeight ?? document.documentElement.scrollHeight) -
          window.innerHeight,
      );
      const targetStyle = window.getComputedStyle(target);
      const rootStyle = window.getComputedStyle(document.documentElement);
      const expectedTop =
        (Number.parseFloat(targetStyle.scrollMarginTop) || 0) +
        (Number.parseFloat(rootStyle.scrollPaddingTop) || 0);
      if (
        options?.isTargetReady?.() === false ||
        resolvePortfolioNavigationTarget(anchor) !== target ||
        !isPortfolioTargetReady(target) ||
        !hasStableTargetLayout(target) ||
        !isPortfolioTargetAligned(
          target,
          expectedTop,
          scrollTop,
          maximumScrollTop,
        )
      ) {
        retryOrAbandon();
        return;
      }
      clearActionNavigation(true);
      target.focus({ preventScroll: true });
      if (!motionSuppressed || experimentDestination) {
        if (actionTargetHighlightTimerRef.current !== null) {
          window.clearTimeout(actionTargetHighlightTimerRef.current);
        }
        highlightedActionTargetRef.current?.removeAttribute("data-chat-action-target");
        highlightedActionTargetRef.current = target;
        target.setAttribute("data-chat-action-target", motionSuppressed ? "static" : "true");
        actionTargetHighlightTimerRef.current = window.setTimeout(() => {
          target.removeAttribute("data-chat-action-target");
          if (highlightedActionTargetRef.current === target) highlightedActionTargetRef.current = null;
          actionTargetHighlightTimerRef.current = null;
        }, 1_650);
      }
      window.dispatchEvent(
        new CustomEvent<ChatActionTargetArrivedDetail>(
          CHAT_ACTION_TARGET_ARRIVED_EVENT,
          { detail: { anchor } },
        ),
      );
      restoreChatInputAfterNavigation();
    };

    const scroll = () => {
      if (!canContinue()) return;
      const target = resolvePortfolioNavigationTarget(anchor);
      if (!target || options?.isTargetReady?.() === false || !isPortfolioTargetReady(target)) {
        hasStableTargetLayout(null);
        retryOrAbandon();
        return;
      }
      if (!hasStableTargetLayout(target)) {
        retryOrAbandon();
        return;
      }

      const transitionElements = [
        target,
        target.closest<HTMLElement>(".about-page-content"),
        target.closest<HTMLElement>(".research-panel-content"),
      ].filter((element): element is HTMLElement => element !== null);
      const runningAnimations = motionSuppressed
        ? []
        : transitionElements.flatMap((element) =>
            element.getAnimations().filter((animation) => {
              const name = (animation as CSSAnimation).animationName ?? "";
              return (
                animation.playState === "running" &&
                (name.startsWith("about-page-") ||
                  name.startsWith("research-panel-"))
              );
            }),
          );
      if (runningAnimations.length > 0) {
        void Promise.allSettled(
          runningAnimations.map((animation) => animation.finished),
        ).then(() => {
          if (canContinue()) scroll();
        });
        return;
      }

      actionScrollTimerRef.current = null;
      const scroller = document.scrollingElement;
      const scrollTop = scroller?.scrollTop ?? window.scrollY;
      const targetStyle = window.getComputedStyle(target);
      const rootStyle = window.getComputedStyle(document.documentElement);
      const scrollMarginTop =
        Number.parseFloat(targetStyle.scrollMarginTop) || 0;
      const scrollPaddingTop =
        Number.parseFloat(rootStyle.scrollPaddingTop) || 0;
      const targetTop =
        scrollTop +
        target.getBoundingClientRect().top -
        scrollMarginTop -
        scrollPaddingTop;
      animateDocumentScroll(
        targetTop,
        (frame) => {
          if (isCurrent()) actionScrollFrameRef.current = frame;
        },
        () => {
          if (canContinue()) completeTargetArrival(target);
        },
        "ease-in-out",
        canContinue,
      );
    };
    actionScrollFrameRef.current = window.requestAnimationFrame(() => {
      if (!canContinue()) return;
      actionScrollFrameRef.current = window.requestAnimationFrame(scroll);
    });
  }, [animateDocumentScroll, clearActionNavigation, motionSuppressed, restoreChatInputAfterNavigation]);

  /**
   * 액션·도구가 지시한 경로로 이동한다. 이 포트폴리오의 이동 경로는 모두 여기를 지난다.
   *
   * 먼저 경로가 내부 경로 형태인지 확인하고, 아니면 경고만 남기고 무시한다.
   * 같은 경로로의 중복 요청도 무시해 이동이 겹치지 않게 한다.
   *
   * 해시가 없으면 라우터에 맡기고 끝난다. 해시가 있고 같은 페이지면 곧바로
   * 앵커 스크롤로 넘어간다. 다른 About 탭으로 넘어갈 때는 셸이 전환 연출을
   * 맡을 수 있도록 취소 가능한 이벤트를 먼저 던지고, 아무도 처리하지 않았을
   * 때만 라우터로 직접 이동한다. 탭 전환 연출을 쓰는 경우에는 문서를 맨 위로
   * 먼저 올린다. 전환이 스크롤 중간에서 시작하면 새 페이지가 잘린 채 나타난다.
   *
   * 이동마다 토큰을 하나 올려, 늦게 도착한 콜백이 이미 지난 이동을 되살리지 못하게 한다.
   */
  const navigateToActionTarget = useCallback(
    (route: string, options?: ChatActionNavigationOptions) => {
      if (options?.signal?.aborted) return;
      if (!SAFE_ROUTE_PATTERN.test(route)) {
        logChatFailureLocally("navigation", null);
        return;
      }
      // 새 DOM 준비 조건이 있는 요청은 같은 경로라도 별도 작업이다. 옛 도착을 재사용하지 않는다.
      if (activeActionNavigationRouteRef.current === route && !options) return;
      clearActionNavigation();
      activeActionNavigationRouteRef.current = route;
      activeActionNavigationOptionsRef.current = options;
      actionNavigationTokenRef.current += 1;
      const navigationToken = actionNavigationTokenRef.current;
      const isCurrent = () => actionNavigationTokenRef.current === navigationToken
        && !options?.signal?.aborted;
      const cancel = () => {
        if (actionNavigationTokenRef.current !== navigationToken) return;
        actionNavigationTokenRef.current += 1;
        pendingChatNavigationFocusRef.current = false;
        clearActionNavigation();
      };
      const cancelForScrollKey = (event: KeyboardEvent) => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return;
        if ((event.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
        cancel();
      };
      const cancelForPointer = (event: PointerEvent) => {
        // 둘러보기 카드는 이동 중 버튼을 잠근다. 잠긴 버튼을 다시 눌러도 진행 중인 이동은 이어 간다.
        if ((event.target as HTMLElement | null)?.closest?.('[data-guided-tour-card]')) return;
        cancel();
      };
      options?.signal?.addEventListener("abort", cancel, { once: true });
      // 새 클릭·수동 스크롤은 도구의 예약된 이동보다 우선한다. 자체 스크롤 이벤트는 듣지 않는다.
      window.addEventListener('wheel', cancel, { passive: true });
      window.addEventListener('touchmove', cancel, { passive: true });
      window.addEventListener('pointerdown', cancelForPointer, { passive: true });
      window.addEventListener('keydown', cancelForScrollKey);
      actionNavigationAbortCleanupRef.current = () => {
        options?.signal?.removeEventListener("abort", cancel);
        window.removeEventListener('wheel', cancel);
        window.removeEventListener('touchmove', cancel);
        window.removeEventListener('pointerdown', cancelForPointer);
        window.removeEventListener('keydown', cancelForScrollKey);
      };

      const hashIndex = route.indexOf("#");
      const actionAnchor =
        hashIndex >= 0
          ? decodeURIComponent(route.slice(hashIndex + 1))
          : null;
      pendingActionAnchorRef.current = actionAnchor;
      const routePath = pathWithoutHash(route);
      pendingActionPathRef.current = routePath;
      if (!actionAnchor) {
        clearActionNavigation();
        router.prefetch(routePath);
        if (routePath === normalizeNavigationPath(pathname)) {
          window.scrollTo({ top: 0, behavior: "auto" });
        } else {
          router.push(routePath, { scroll: true });
        }
        return;
      }
      if (
        actionAnchor &&
        routePath === normalizeNavigationPath(pathname)
      ) {
        pendingActionAwaitingPageEntryRef.current = false;
        scrollToPendingActionAnchor();
        return;
      }

      const currentTabPath = aboutTabPathFromPath(pathname);
      const targetTabPath = aboutTabPathFromPath(routePath);
      const attractTab =
        currentTabPath !== null &&
        targetTabPath !== null &&
        currentTabPath !== targetTabPath;
      const shouldStageTab =
        attractTab &&
        !motionSuppressed &&
        pageTransition !== "none";

      router.prefetch(routePath);

      const dispatchNavigation = () => {
        if (!isCurrent()) return;
        const event = new CustomEvent<ChatActionNavigateDetail>(
          CHAT_ACTION_NAVIGATE_EVENT,
          {
            cancelable: true,
            detail: { route, attractTab: shouldStageTab },
          },
        );
        pendingActionAwaitingPageEntryRef.current =
          !motionSuppressed &&
          pageTransition !== "none";
        const handledByAboutLayout = !window.dispatchEvent(event);
        if (!handledByAboutLayout) {
          pendingActionAwaitingPageEntryRef.current = false;
          router.push(routePath, { scroll: false });
        }
      };

      if (!shouldStageTab) {
        dispatchNavigation();
        return;
      }

      const currentScrollTop =
        document.scrollingElement?.scrollTop ?? window.scrollY;
      if (Math.abs(currentScrollTop) < 1) {
        dispatchNavigation();
        return;
      }

      animateDocumentScroll(
        0,
        (frame) => {
          if (isCurrent()) actionTopScrollFrameRef.current = frame;
        },
        () => {
          if (isCurrent()) dispatchNavigation();
        },
        "ease-out",
        isCurrent,
      );
    },
    [
      animateDocumentScroll,
      clearActionNavigation,
      motionSuppressed,
      pageTransition,
      pathname,
      router,
      scrollToPendingActionAnchor,
    ],
  );

  // 예약한 경로에 실제로 도착했으면 앵커 스크롤을 시작한다. 페이지 진입
  // 신호를 기다리는 경우에도 일정 시간이 지나면 스스로 시작한다.
  useEffect(() => {
    const pendingPath = pendingActionPathRef.current;
    if (
      !pendingPath ||
      normalizeNavigationPath(pathname) !== pendingPath
    ) {
      return;
    }

    if (!pendingActionAwaitingPageEntryRef.current) {
      scrollToPendingActionAnchor();
      return;
    }

    if (actionPageEntryTimerRef.current !== null) {
      window.clearTimeout(actionPageEntryTimerRef.current);
    }
    const navigationToken = actionNavigationTokenRef.current;
    actionPageEntryTimerRef.current = window.setTimeout(() => {
      if (actionNavigationTokenRef.current !== navigationToken) return;
      actionPageEntryTimerRef.current = null;
      pendingActionAwaitingPageEntryRef.current = false;
      scrollToPendingActionAnchor();
    }, ACTION_PAGE_ENTRY_FALLBACK_MS);
  }, [pathname, scrollToPendingActionAnchor]);

  // About 셸이 페이지 진입 연출을 마쳤다고 알리면 그때 앵커 스크롤을 시작한다.
  useEffect(() => {
    const handlePageEntered = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<ChatActionPageEnteredDetail>;
      const enteredPath = event.detail?.path;
      if (
        !enteredPath ||
        normalizeNavigationPath(enteredPath) !== pendingActionPathRef.current ||
        !pendingActionAwaitingPageEntryRef.current
      ) {
        return;
      }

      if (actionPageEntryTimerRef.current !== null) {
        window.clearTimeout(actionPageEntryTimerRef.current);
        actionPageEntryTimerRef.current = null;
      }
      pendingActionAwaitingPageEntryRef.current = false;
      scrollToPendingActionAnchor();
    };

    window.addEventListener(
      CHAT_ACTION_PAGE_ENTERED_EVENT,
      handlePageEntered,
    );
    return () =>
      window.removeEventListener(
        CHAT_ACTION_PAGE_ENTERED_EVENT,
        handlePageEntered,
      );
  }, [scrollToPendingActionAnchor]);

  /**
   * 채팅 패널을 연다.
   *
   * 이미 열려 있으면 아무 일도 하지 않는다. 카드 질문의 명시 열기는 닫힘·
   * 모바일 history 정리가 끝난 뒤 한 번 이어 연다. 그 외 열기는 기존대로 무시한다.
   * 모바일에서는
   * 히스토리 항목을 하나 밀어 넣어 뒤로가기로 패널만 닫히게 하고, 온라인이
   * 아니면 상태를 다시 확인한다. 여는 순간 마크다운 렌더러를 미리 불러
   * 첫 답변이 완성될 때 서식이 바로 붙게 한다.
   */
  const open = useCallback((options?: { focusInput?: boolean; checkAvailability?: boolean; reopenAfterClose?: boolean }) => {
    if (!mountedRef.current) return;
    if (isClosingRef.current || cleanupHistoryPopRef.current) {
      if (options?.reopenAfterClose) pendingOpenAfterCloseRef.current = { ...options };
      return;
    }
    if (isOpenRef.current) return;
    void loadMarkdownRenderer().catch(() => undefined);
    setFocusInputOnOpen(options?.focusInput !== false);
    if (
      window.matchMedia(MOBILE_QUERY).matches &&
      !mobileHistoryEntryRef.current
    ) {
      window.history.pushState(
        {
          ...(window.history.state ?? {}),
          [MOBILE_HISTORY_MARKER]: true,
        },
        "",
        window.location.href,
      );
      mobileHistoryEntryRef.current = true;
    }
    isOpenRef.current = true;
    setPanelGeneration(generation => generation + 1);
    setIsOpen(true);
    if (options?.checkAvailability !== false && availability !== "online") {
      void refreshAvailability();
    }
  }, [availability, refreshAvailability]);

  /** 질문을 다시 보내지 않고, 예약된 패널 열기만 실행한다. */
  const reopenAfterClose = useCallback(() => {
    const options = pendingOpenAfterCloseRef.current;
    pendingOpenAfterCloseRef.current = null;
    if (options && mountedRef.current) open(options);
  }, [open]);

  /**
   * 퇴장 연출이 끝난 시점에 패널을 실제로 내린다.
   *
   * 모바일에서 히스토리 항목을 밀어 넣었다면 그것을 되돌린 뒤, popstate
   * 처리에서 예약된 이동을 이어 간다. 닫히는 중이 아니면 아무 일도 하지 않아
   * 애니메이션 끝 이벤트와 타이머가 겹쳐도 두 번 실행되지 않는다.
   */
  const completeCloseAnimation = useCallback((epoch = closeAnimationEpoch) => {
    if (!mountedRef.current || !isClosingRef.current || epoch !== closeAnimationEpochRef.current) return;
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    const consumeHistoryEntry = consumeHistoryOnCloseRef.current;
    consumeHistoryOnCloseRef.current = false;
    isOpenRef.current = false;
    isClosingRef.current = false;
    setIsOpen(false);
    setIsClosing(false);

    if (
      consumeHistoryEntry &&
      mobileHistoryEntryRef.current &&
      window.history.state?.[MOBILE_HISTORY_MARKER] === true
    ) {
      cleanupHistoryPopRef.current = true;
      window.history.back();
      return;
    }

    const pendingRoute = pendingActionRouteRef.current;
    pendingActionRouteRef.current = null;
    if (pendingRoute) navigateToActionTarget(pendingRoute.route, pendingRoute.options);
    reopenAfterClose();
  }, [closeAnimationEpoch, navigateToActionTarget, reopenAfterClose]);

  /**
   * 모바일 패널의 닫힘을 시작한다.
   *
   * 연출이 끝날 때까지 DOM을 남겨 두고 타이머로 마무리한다. 모션이 억제된
   * 환경에서는 기다리지 않는다. consumeHistoryEntry는 열 때 밀어 넣은
   * 히스토리 항목을 닫으면서 되돌릴지 여부다(뒤로가기로 닫을 때는 이미
   * 소비됐으므로 false).
   */
  const beginMobileClose = useCallback(
    (consumeHistoryEntry: boolean) => {
      if (!isOpenRef.current || isClosingRef.current) return;

      consumeHistoryOnCloseRef.current = consumeHistoryEntry;
      const epoch = ++closeAnimationEpochRef.current;
      setCloseAnimationEpoch(epoch);
      isClosingRef.current = true;
      setIsClosing(true);
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      closeTimerRef.current = window.setTimeout(
        () => completeCloseAnimation(epoch),
        reducedMotion ? 0 : MOBILE_EXIT_DURATION_MS + 300,
      );
    },
    [completeCloseAnimation],
  );

  /**
   * PC 패널의 퇴장 연출이 재생되는 동안 패널 DOM을 유지한다.
   * 슬라이드는 CSS animationend가 먼저 도착해 타이머보다 빨리 마무리한다.
   */
  const beginDesktopClose = useCallback(
    (durationMs: number) => {
      if (!isOpenRef.current || isClosingRef.current) return;

      consumeHistoryOnCloseRef.current = false;
      const epoch = ++closeAnimationEpochRef.current;
      setCloseAnimationEpoch(epoch);
      isClosingRef.current = true;
      setIsClosing(true);
      closeTimerRef.current = window.setTimeout(
        () => completeCloseAnimation(epoch),
        durationMs,
      );
    },
    [completeCloseAnimation],
  );

  /**
   * 채팅 패널을 닫는다. 환경에 따라 닫는 방식이 다르다.
   *
   * 모바일은 히스토리 항목을 되돌리며 닫고, PC는 선택한 연출 길이만큼 DOM을
   * 남겼다가 닫는다. 연출이 없으면 즉시 닫는다. 닫기 요청은 예약된 이동을
   * 취소한다. 사용자가 스스로 닫았다면 그 이동은 더 이상 원한 것이 아니다.
   */
  const close = useCallback(() => {
    pendingOpenAfterCloseRef.current = null;
    pendingActionRouteRef.current = null;
    if (window.matchMedia(MOBILE_QUERY).matches) {
      beginMobileClose(true);
      return;
    }
    if (effectiveChatAnimation !== "none") {
      beginDesktopClose(DESKTOP_EXIT_DURATION_MS[effectiveChatAnimation]);
      return;
    }

    isOpenRef.current = false;
    isClosingRef.current = false;
    setIsOpen(false);
    setIsClosing(false);
  }, [beginDesktopClose, beginMobileClose, effectiveChatAnimation]);

  /** 열려 있으면 닫고, 닫혀 있으면 연다. */
  const toggle = useCallback(() => {
    if (isOpenRef.current) close();
    else open();
  }, [close, open]);

  // 모바일 뒤로가기를 패널 닫기로 해석한다. 우리가 되돌린 히스토리라면
  // 닫기 대신 예약해 둔 이동을 이어 간다.
  useEffect(() => {
    const handlePopState = () => {
      if (cleanupHistoryPopRef.current) {
        cleanupHistoryPopRef.current = false;
        mobileHistoryEntryRef.current = false;
        const pendingRoute = pendingActionRouteRef.current;
        pendingActionRouteRef.current = null;
        if (pendingRoute) {
          window.requestAnimationFrame(() =>
            navigateToActionTarget(pendingRoute.route, pendingRoute.options),
          );
        }
        reopenAfterClose();
        return;
      }

      if (!mobileHistoryEntryRef.current) return;
      pendingOpenAfterCloseRef.current = null;
      mobileHistoryEntryRef.current = false;
      beginMobileClose(false);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [beginMobileClose, navigateToActionTarget, reopenAfterClose]);

  /** 서버 채팅을 닫는다. 새 대화·페이지 이탈·언마운트에서 부른다. 실패해도 서버 TTL이 정리한다. */
  const closeSession = useCallback(() => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) closeChatSession(session);
  }, []);

  /**
   * 이동 도구가 정말 목적지에 닿았는지 지켜본다.
   *
   * 앵커가 있는 경로는 도착 이벤트를 기다린다. 앵커가 없는 경로(설정 페이지·연구 전체)도
   * 경로와 본문이 실제로 준비될 때까지 기다린다. 상한을 넘기면 실패로 판정한다.
   */
  const observeNavigationArrival = useCallback(
    (route: string, startedAt: number, signal: AbortSignal): Promise<"arrived" | "failed"> => {
      const hashIndex = route.indexOf("#");
      const anchor = hashIndex >= 0 ? decodeURIComponent(route.slice(hashIndex + 1)) : null;
      const observation = observeToolNavigation({
        route,
        basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
        startedAt,
        minimumDelayMs: TOOL_OBSERVATION_MIN_DELAY_MS,
        timeoutMs: TOOL_ARRIVAL_TIMEOUT_MS,
        signal,
        now: () => performance.now(),
        schedule: (callback, delay) => {
          const timer = window.setTimeout(callback, delay);
          return () => window.clearTimeout(timer);
        },
        read: () => {
          // URL이 먼저 바뀌어도 이전 페이지의 main을 도착으로 보지 않는다.
          const target = anchor
            ? resolvePortfolioNavigationTarget(anchor)
            : pathWithoutHash(route) === "/about-me/research"
              ? document.getElementById("research-experiments")?.closest("main")
              : document.querySelector<HTMLElement>('[data-option="theme-mode"]')?.closest("main");
          return {
            pathname: window.location.pathname,
            targetReady: !!target && isPortfolioTargetReady(target),
          };
        },
        subscribe: (arrived) => {
          const handleArrived = (event: Event) => {
            const detail = (event as CustomEvent<ChatActionTargetArrivedDetail>).detail;
            if (detail?.anchor) arrived(detail.anchor);
          };
          window.addEventListener(CHAT_ACTION_TARGET_ARRIVED_EVENT, handleArrived);
          return () => window.removeEventListener(CHAT_ACTION_TARGET_ARRIVED_EVENT, handleArrived);
        },
      });
      toolResultWatchersRef.current.add(observation.cancel);
      return observation.completion.finally(() => toolResultWatchersRef.current.delete(observation.cancel));
    },
    [],
  );

  /**
   * 질문 한 번의 전체 수명주기를 실행한다.
   *
   * 빈 답변 말풍선을 먼저 만들고, 서버가 보내는 delta를 렌더 큐로 이어 붙인다.
   * 서버가 브라우저 도구를 요청하면 순서대로 실행·관측해 결과를 돌려주고 같은 턴을
   * 이어 간다(대화 이력은 서버가 보관한다). 끝맺음은 세 갈래다. 정상 완료면 서버가
   * 확정한 답으로 말풍선을 마무리하고, 사용자가 중단했으면 받은 글을 남긴 채 중단 표시를
   * 붙이며, 실패하면 실패 안내를 남긴다. 화면 도구를 실행하지 않은 일시적 실패만
   * 같은 질문을 다시 보낼 수 있다(이미 바뀐 화면을 다시 조작하지 않기 위해서다).
   */
  const performTurn = useCallback(
    async (pending: PendingTurn) => {
      if (inFlightRef.current || !mountedRef.current) return;
      const controller = new AbortController();
      abortRef.current = controller;
      inFlightRef.current = true;
      stopRequestedRef.current = false;
      setIsLoading(true);
      setError(null);
      clearRetryWait();

      const isActive = () => mountedRef.current && abortRef.current === controller && !controller.signal.aborted;
      const messageId = pending.assistantMessageId ?? nextId("assistant");
      pending.assistantMessageId = messageId;
      const hadConversation = messagesRef.current.some((item) => item.role === "user" && item.id !== pending.userMessageId);
      const toolResults = new Map<string, ToolResult>();
      const update = (patch: (message: ChatMessage) => ChatMessage) => {
        if (!mountedRef.current || abortRef.current !== controller) return;
        setMessages((current) => current.map((item) => (item.id === messageId ? patch(item) : item)));
      };
      setMessages((current) => {
        const message: ChatMessage = {
          id: messageId, role: "assistant", content: "", kind: "message", generationState: "streaming",
        };
        return current.some((item) => item.id === messageId)
          ? current.map((item) => (item.id === messageId ? message : item))
          : [...current, message];
      });

      const renderQueue = streamingEnabled
        ? new StreamRenderQueue((text: string) => {
          if (text) update((message) => ({ ...message, content: `${message.content}${text}` }));
        })
        : null;
      renderQueueRef.current?.cancel();
      renderQueueRef.current = renderQueue;

      // 이전 대화가 서버에서 사라졌다. 모델은 앞선 내용을 모르므로 화면에서 알린다.
      const showRenewedNotice = () => {
        if (!isActive() || !hadConversation) return;
        const notice: ChatMessage = {
          id: nextId("notice"), role: "assistant", kind: "chat_notice", generated: false,
          content: SESSION_RENEWED_NOTICE, generationState: "complete",
        };
        setMessages((current) => {
          const index = current.findIndex((item) => item.id === messageId);
          return index < 0 ? [...current, notice] : [...current.slice(0, index), notice, ...current.slice(index)];
        });
      };
      if (sessionClosedOnPageHideRef.current && !sessionRef.current) showRenewedNotice();
      sessionClosedOnPageHideRef.current = false;

      try {
        const { answer, suggestedQuestions } = await runChatTurn({
          api: CHAT_TURN_API,
          message: pending.message,
          signal: controller.signal,
          getSession: () => sessionRef.current,
          setSession: (session) => { sessionRef.current = session; },
          clientState: () => ({
            uiSettings: uiSettingsRef.current,
            viewState: readPortfolioViewState(window.location.pathname),
          }),
          onEvent: (event) => {
            if (!isActive()) return;
            if (event.type === "status") update((message) => ({ ...message, statusStage: event.stage }));
            else if (event.type === "delta") renderQueue?.enqueue(event.text);
          },
          runTools: (calls, signal) => runBrowserToolCalls(calls, {
            execute: executePortfolioUiTool,
            readSettings: () => uiSettingsRef.current,
            readViewState: () => readPortfolioViewState(window.location.pathname),
            observeNavigation: observeNavigationArrival,
            // 앵커가 있는 이동만 도착 뒤 입력창 포커스를 되돌린다.
            beforeNavigate: () => { pendingChatNavigationFocusRef.current = true; },
            report: (result) => {
              if (!isActive()) return;
              toolResults.set(result.callId, result);
              const snapshot = [...toolResults.values()];
              update((message) => ({ ...message, toolResults: snapshot, statusStage: "working" }));
            },
            // 선택지는 이 답변 말풍선에 띄우기만 한다. 버튼은 chooseSetting이 턴과 무관하게 처리한다.
            showChoice: ({ callId, setting }) => update((message) => ({ ...message, settingChoice: { callId, setting } })),
            chatDockFits: chatDockFitsViewport,
            now: () => performance.now(),
          }, signal),
          onSessionRenewed: showRenewedNotice,
        });
        await renderQueue?.drain();
        if (!isActive()) throw new DOMException("The operation was aborted.", "AbortError");
        reportAvailability("online");
        retryRef.current = null;
        update((message) => ({
          ...message,
          content: answer,
          generationState: "complete",
          statusStage: undefined,
          ...(suggestedQuestions.length > 0 ? { suggestedQuestions } : {}),
          ...(toolResults.size > 0 ? { toolResults: [...toolResults.values()] } : {}),
        }));
      } catch (requestError) {
        if (!mountedRef.current || abortRef.current !== controller) return;
        renderQueue?.cancel();
        const aborted = controller.signal.aborted
          || (requestError instanceof DOMException && requestError.name === "AbortError");
        if (aborted) {
          if (stopRequestedRef.current) {
            retryRef.current = null;
            setMessages((current) => current.map((item) => item.id === messageId
              ? { ...item, generationState: "stopped", retryAllowed: false, statusStage: undefined }
              : item));
            setError(null);
          }
          return;
        }
        // 화면 도구를 이미 실행했다면 같은 질문을 다시 보내 조작을 반복하지 않는다.
        const toolsExecuted = requestError instanceof ChatTurnError && requestError.toolsExecuted;
        const retryAllowed = requestError instanceof ChatApiError && requestError.retryable && !toolsExecuted;
        const serverDelay = chatFailureRetryAfterMs(requestError);
        if (serverDelay > 0) {
          requestCooldownDeadlineRef.current = Math.max(requestCooldownDeadlineRef.current, Date.now() + serverDelay);
        }
        const failureAvailability = chatFailureAvailability(requestError);
        if (failureAvailability) reportAvailability(failureAvailability);
        logChatFailureLocally("request", requestError);
        retryRef.current = retryAllowed ? pending : null;
        const failureNotice = requestError instanceof ChatApiError ? requestError.message : undefined;
        setMessages((current) => current.map((item) => item.id === messageId
          ? failedChatMessage({
            ...item, retryAllowed, statusStage: undefined,
            ...(failureNotice ? { failureNotice } : {}),
            ...(toolResults.size > 0 ? { toolResults: [...toolResults.values()] } : {}),
          }, false)
          : item));
        setError(null);
        if (retryAllowed) beginRetryWait(serverDelay);
        else clearRetryWait();
      } finally {
        if (renderQueueRef.current === renderQueue) renderQueueRef.current = null;
        if (abortRef.current === controller) {
          abortRef.current = null;
          inFlightRef.current = false;
          stopRequestedRef.current = false;
          if (mountedRef.current) setIsLoading(false);
        }
      }
    },
    [
      beginRetryWait,
      clearRetryWait,
      executePortfolioUiTool,
      nextId,
      observeNavigationArrival,
      reportAvailability,
      streamingEnabled,
    ],
  );

  /**
   * 추론 서버가 오프라인으로 보여도 대화가 시작된 뒤에는 다시 보내 볼 수 있다.
   * 성공하면 상태가 온라인으로 돌아온다.
   */
  const canRequest = useCallback(
    () =>
      availability === "online" ||
      (availability === "offline" &&
        messagesRef.current.some(
          (chatMessage) => chatMessage.role === "user",
        )),
    [availability],
  );

  /**
   * 사용자 질문을 보낸다.
   *
   * 공백만 있는 입력, 요청할 수 없는 상태, 이미 진행 중인 요청은 무시한다.
   * audience·responseMode는 화면이 질문 문구를 고를 때만 쓰고 서버로 보내지 않는다.
   * 빠른 시작 질문 문구 자체가 의도를 담고 있기 때문이다.
   */
  const sendMessage = useCallback(
    async (content: string, _audienceOverride?: AudienceChoice, responseMode: "default" | "explanation" = "default") => {
      const message = content.trim();
      if (!mountedRef.current || !message || inFlightRef.current) return;
      if ((!canRequest() && !canSendUnverifiedExplanation(availability, responseMode)) ||
        Date.now() < Math.max(requestCooldownDeadlineRef.current, retryWaitDeadlineRef.current)) {
        return;
      }
      const userMessageId = nextId("user");
      setMessages((current) => [
        ...current,
        { id: userMessageId, role: "user", content: message, kind: "message" },
      ]);
      const pending: PendingTurn = { message, userMessageId, responseMode };
      retryRef.current = pending;
      await performTurn(pending);
    },
    [availability, canRequest, nextId, performTurn],
  );

  /** 마지막 실패를 같은 말풍선에서 다시 보낸다. 재시도할 재료가 없거나 대기 중이면 무시한다. */
  const retry = useCallback(async () => {
    const pending = retryRef.current;
    if (!pending || !mountedRef.current || inFlightRef.current
      || (!canRequest() && !canSendUnverifiedExplanation(availability, pending.responseMode))
      || Date.now() < Math.max(requestCooldownDeadlineRef.current, retryWaitDeadlineRef.current)) return;
    await performTurn(pending);
  }, [availability, canRequest, performTurn]);

  /**
   * 진행 중인 응답 생성을 사용자의 뜻으로 중단한다.
   * 렌더 큐를 먼저 비워 이미 받은 글이 계속 흘러나오지 않게 하고 요청을 취소한다.
   * 서버는 연결이 끊긴 것을 보고 그 턴을 멈춘다.
   */
  const stopGenerating = useCallback(() => {
    if (!inFlightRef.current || !abortRef.current) return;
    stopRequestedRef.current = true;
    renderQueueRef.current?.cancel();
    abortRef.current.abort();
  }, []);

  /**
   * 답변 말풍선의 설정 선택지 버튼이다. 대화 턴 없이 같은 UI 실행기로 설정을 바로 바꾼다.
   * 바뀐 값은 다음 질문의 clientState로 서버에 전해진다.
   */
  const chooseSetting = useCallback((setting: PortfolioChoiceSetting, value: string) => {
    const { tool, argument } = CHOICE_SETTING_TARGETS[setting];
    Promise.resolve()
      .then(() => executePortfolioUiTool({ name: tool, input: { [argument]: value } }))
      .catch((error: unknown) => logChatFailureLocally("tool", error));
  }, [executePortfolioUiTool]);

  /**
   * 대화를 처음 상태로 되돌린다. 서버 채팅도 닫아 다음 질문은 새 채팅에서 시작한다.
   * 진행 중인 요청은 중단 안내 없이 조용히 정리한다.
   */
  const resetConversation = useCallback(() => {
    stopRequestedRef.current = false;
    renderQueueRef.current?.cancel();
    abortRef.current?.abort();
    closeSession();
    pendingOpenAfterCloseRef.current = null;
    retryRef.current = null;
    setError(null);
    clearRetryWait();
    setAudience(null);
    setMessages(initialMessages());
  }, [clearRetryWait, closeSession]);

  /** 스트리밍 사용 여부를 바꾸고 저장소에 남긴다. */
  const setStreamingEnabled = useCallback((enabled: boolean) => {
    setStreamingEnabledState(enabled);
    try {
      window.localStorage.setItem(STREAMING_STORAGE_KEY, String(enabled));
    } catch {
      // 저장 실패가 현재 브라우저 세션의 설정 변경을 막지는 않는다.
    }
  }, []);

  /** 사고모드 사용 여부를 바꾸고 저장소에 남긴다. */
  const setReasoningEnabled = useCallback((enabled: boolean) => {
    setReasoningEnabledState(enabled);
    try {
      window.localStorage.setItem(
        REASONING_STORAGE_KEY,
        String(enabled),
      );
    } catch {
      // 저장 실패가 현재 브라우저 세션의 설정 변경을 막지는 않는다.
    }
  }, []);

  /** 패널 연출을 바꾸고 저장소에 남긴다. 허용 목록 밖 값은 무시한다. */
  const setChatAnimation = useCallback((animation: ChatAnimation) => {
    if (!CHAT_ANIMATIONS.includes(animation)) return;
    setChatAnimationState(animation);
    try {
      window.localStorage.setItem(CHAT_ANIMATION_STORAGE_KEY, animation);
    } catch {
      // 저장 실패가 현재 브라우저 세션의 설정 변경을 막지는 않는다.
    }
  }, []);

  /** 답변 말투를 바꾸고 저장소에 남긴다. 허용 목록 밖 값은 무시한다. */
  const selectTone = useCallback(() => {
    setTone("official");
    try {
      window.localStorage.setItem(TONE_STORAGE_KEY, "official");
    } catch {
      // 저장 실패가 현재 대화의 말투 변경을 막지는 않는다.
    }
  }, []);

  /**
   * 이동 요청을 받아 지금 화면에 맞는 방식으로 처리한다.
   *
   * 모바일에서 패널이 열려 있으면 목적지를 예약해 두고 패널부터 닫는다.
   * 전체 화면을 덮은 패널 뒤에서 페이지가 바뀌면 사용자가 이동을 놓치기
   * 때문이다. 그 밖에는 곧바로 이동한다.
   */
  const navigateRoute = useCallback(
    (route: string, options?: ChatActionNavigationOptions) => {
      if (options?.signal?.aborted) return;
      if (
        window.matchMedia(MOBILE_QUERY).matches &&
        isOpenRef.current
      ) {
        pendingActionRouteRef.current = { route, options };
        beginMobileClose(
          mobileHistoryEntryRef.current &&
            window.history.state?.[MOBILE_HISTORY_MARKER] === true,
        );
        return;
      }
      navigateToActionTarget(route, options);
    },
    [beginMobileClose, navigateToActionTarget],
  );
  // 이동 함수의 최신 구현을 ref에 비춘다. 도구와 컨텍스트에는 아이덴티티가
  // 고정된 래퍼만 노출한다.
  useEffect(() => {
    navigateRouteRef.current = navigateRoute;
  }, [navigateRoute]);

  /**
   * 라우트가 바뀔 때마다 아이덴티티가 흔들리지 않는 이동 함수다.
   * WebMCP 도구 등록이 마운트당 한 번만 일어나게 하는 것이 목적이다.
   */
  const stableNavigateRoute = useCallback(
    (route: string, options?: ChatActionNavigationOptions) => navigateRouteRef.current(route, options),
    [],
  );

  /**
   * 설정·WebMCP 안내를 서버를 거치지 않고 답변 말풍선으로 끼워 넣는다.
   *
   * 고정된 안내문이라 모델에게 물을 이유가 없고, 오프라인에서도 보여야 한다.
   * 설정 페이지로 가는 액션 버튼을 함께 붙인다.
   */
  const showSettingsWebMcpGuide = useCallback(() => {
    const action = {
      id: "settings" as const,
      label: ACTION_LABELS.settings,
    };
    setError(null);
    setMessages((current) => [
      ...current,
      {
        id: nextId("assistant"),
        role: "assistant",
        content: SETTINGS_WEBMCP_GUIDE,
        kind: "message",
        generationState: "complete",
        segments: [
          {
            markdown: SETTINGS_WEBMCP_GUIDE,
            actions: [action],
          },
        ],
      },
    ]);
  }, [nextId]);

  /**
   * 액션 식별자를 경로로 바꿔 이동한다(답변 아래 버튼용).
   * 표에 없는 식별자면 아무 일도 하지 않는다.
   */
  const navigateAction = useCallback(
    (id: ActionId) => {
      const route = ACTION_ROUTES[id];
      if (route) stableNavigateRoute(route);
    },
    [stableNavigateRoute],
  );

  /**
   * 둘러보기 단계의 이동이다. 패널을 닫는 우회 없이 곧바로 목적지로 간다.
   *
   * 둘러보기는 카드가 이동을 이끄는 흐름이라, 모바일에서 패널을 닫았다가
   * 여는 동작이 오히려 흐름을 끊는다.
   */
  const navigateGuidedTourAction = useCallback(
    (id: ActionId) => {
      const route = ACTION_ROUTES[id];
      if (route) navigateToActionTarget(route);
    },
    [navigateToActionTarget],
  );

  const {
    state: guidedTour,
    step: guidedTourStep,
    inviteVisible: guidedTourInviteVisible,
    isNavigating: guidedTourNavigating,
    start: startGuidedTour,
    advance: advanceGuidedTour,
    previous: previousGuidedTourStep,
    skip: skipGuidedTourInteraction,
    stop: stopGuidedTour,
    dismissInvite: dismissGuidedTourInvite,
    returnToCurrentStep: returnToGuidedTourStep,
    beginQuestion: beginGuidedTourQuestion,
    completeQuestion: completeGuidedTourQuestion,
  } = useGuidedTour({
    pathname,
    availability,
    navigateAction: navigateGuidedTourAction,
  });

  // 둘러보기가 끝나거나 멈추면 남아 있는 강조 표시와 포커스를 거둔다.
  // 강조된 요소에 포커스가 남으면 투어가 끝난 뒤에도 화면이 붙잡힌 것처럼 보인다.
  useEffect(() => {
    if (guidedTour.status === "active") return;

    if (actionTargetHighlightTimerRef.current !== null) {
      window.clearTimeout(actionTargetHighlightTimerRef.current);
      actionTargetHighlightTimerRef.current = null;
    }
    const highlightedTarget = highlightedActionTargetRef.current;
    highlightedTarget?.removeAttribute("data-chat-action-target");
    highlightedActionTargetRef.current = null;
    document
      .querySelectorAll<HTMLElement>('[data-guided-tour-active="true"]')
      .forEach((target) =>
        target.removeAttribute("data-guided-tour-active"),
      );

    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      (activeElement === highlightedTarget ||
        activeElement.hasAttribute("data-guided-tour-target"))
    ) {
      activeElement.blur();
    }
  }, [guidedTour.status]);

  /**
   * 컨텍스트로 내려보낼 값이다.
   *
   * 상태 하나가 바뀔 때마다 새 객체가 만들어지면 소비자 전부가 리렌더된다.
   * 그래서 useMemo로 묶고, 함수들은 useCallback으로 아이덴티티를 고정해 둔다.
   */
  const value = useMemo<ChatContextValue>(
    () => ({
      isOpen,
      isClosing,
      panelGeneration,
      isLoading,
      availability,
      error,
      retryWaitSeconds,
      messages,
      audience,
      tone,
      streamingEnabled,
      reasoningEnabled,
      chatAnimation,
      effectiveChatAnimation,
      streamAnimation,
      effectiveStreamAnimation,
      guidedTour,
      guidedTourStep,
      guidedTourInviteVisible,
      guidedTourNavigating,
      focusInputOnOpen,
      open,
      close,
      completeCloseAnimation,
      toggle,
      selectAudience: setAudience,
      selectTone,
      setStreamingEnabled,
      setReasoningEnabled,
      setChatAnimation,
      setStreamAnimation,
      refreshAvailability,
      resetConversation,
      showSettingsWebMcpGuide,
      sendMessage,
      stopGenerating,
      chooseSetting,
      uiSettings,
      retry,
      navigateRoute: stableNavigateRoute,
      executePortfolioUiTool,
      navigateAction,
      startGuidedTour,
      advanceGuidedTour,
      previousGuidedTourStep,
      skipGuidedTourInteraction,
      stopGuidedTour,
      dismissGuidedTourInvite,
      returnToGuidedTourStep,
      beginGuidedTourQuestion,
      completeGuidedTourQuestion,
    }),
    [
      audience,
      availability,
      chatAnimation,
      effectiveChatAnimation,
      effectiveStreamAnimation,
      error,
      guidedTour,
      guidedTourStep,
      guidedTourInviteVisible,
      guidedTourNavigating,
      focusInputOnOpen,
      isLoading,
      isOpen,
      isClosing,
      panelGeneration,
      messages,
      navigateAction,
      stableNavigateRoute,
      executePortfolioUiTool,
      startGuidedTour,
      advanceGuidedTour,
      previousGuidedTourStep,
      skipGuidedTourInteraction,
      stopGuidedTour,
      dismissGuidedTourInvite,
      returnToGuidedTourStep,
      beginGuidedTourQuestion,
      completeGuidedTourQuestion,
      open,
      close,
      completeCloseAnimation,
      retry,
      refreshAvailability,
      resetConversation,
      retryWaitSeconds,
      reasoningEnabled,
      setChatAnimation,
      setReasoningEnabled,
      setStreamAnimation,
      setStreamingEnabled,
      selectTone,
      showSettingsWebMcpGuide,
      sendMessage,
      stopGenerating,
      chooseSetting,
      uiSettings,
      streamAnimation,
      streamingEnabled,
      toggle,
      tone,
    ],
  );

  return (
    <ChatContext.Provider value={value}>
      {children}
      <ChatWidget />
    </ChatContext.Provider>
  );
}
