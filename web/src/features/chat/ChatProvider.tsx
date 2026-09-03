"use client";

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
  type Accent,
} from "../../context/ThemeContext";
import { chatSettingsDataset } from "../../context/settingsDataset";
import {
  requestChat,
  requestChatStatus,
  requestChatStream,
  ChatApiError,
} from "./api";
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
  TONES,
  TONE_STORAGE_KEY,
  audienceToApi,
  pageContextFromPathname,
} from "./constants";
import { ChatContext, type ChatContextValue } from "./ChatContext";
import { ChatWidget } from "./ChatWidget";
import { loadMarkdownRenderer } from "./MessageItem";
import { StreamRenderQueue } from "./streamRenderQueue";
import { useGuidedTour } from "./useGuidedTour";
import { dispatchPortfolioModelToolExecution } from "../webmcp/logSearchView";
import { readPortfolioViewState } from "../webmcp/portfolioView";
import {
  executePortfolioUiTool as runPortfolioUiTool,
  portfolioUiCommandFromChatExecution,
  type PortfolioUiToolExecutor,
  type PortfolioUiToolRuntime,
} from "../portfolio-tools/portfolioUiToolExecutor";
import {
  CHAT_ACTION_NAVIGATE_EVENT,
  CHAT_ACTION_PAGE_ENTERED_EVENT,
  CHAT_ACTION_RESTORE_CHAT_INPUT_EVENT,
  CHAT_ACTION_TARGET_ARRIVED_EVENT,
  aboutTabPathFromPath,
  normalizeNavigationPath,
  pathWithoutHash,
  type ChatActionNavigateDetail,
  type ChatActionPageEnteredDetail,
  type ChatActionTargetArrivedDetail,
} from "./navigation";
import type {
  ActionId,
  AudienceChoice,
  ChatAnimation,
  ChatAvailability,
  ChatHistoryItem,
  ChatMessage,
  ChatRequest,
  ChatStreamAnimation,
  ChatToolExecution,
  Tone,
} from "./types";

/**
 * 서버로 보내는 이전 대화의 상한이다.
 * 턴 수와 글자 수를 함께 제한해, 대화가 길어져도 요청 크기와 모델 비용이
 * 무한정 커지지 않게 한다.
 */
const MAX_HISTORY_ITEMS = 10;
const MAX_HISTORY_CHARACTERS = 12_000;
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
 * 포인트 색상 순회의 한 칸을 기다린다. 중단 신호가 오면 즉시 거부한다.
 *
 * 단순한 setTimeout이 아니라 중단 가능한 대기여야 한다. 사용자가 응답 생성을
 * 멈췄는데 색이 계속 바뀌면 화면이 제멋대로 움직이는 것처럼 보이기 때문이다.
 * 이미 중단된 신호로 들어오면 기다리지 않고 바로 거부하며, 어느 경로로 끝나든
 * 타이머와 리스너를 남기지 않는다.
 */
function waitForAccentCycleStep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("The operation was aborted.", "AbortError"));
      return;
    }
    const timeout = window.setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    const abort = () => {
      window.clearTimeout(timeout);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}
/** 연결 상태 확인의 시간 상한이다. 넘기면 오프라인으로 본다. */
const CHAT_STATUS_TIMEOUT_MS = 5_000;
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

/**
 * 화면의 말풍선 목록에서 서버로 보낼 대화 기록을 뽑는다.
 *
 * 최신 것부터 거꾸로 훑으며 턴 수와 글자 수 상한에 닿으면 멈춘다. 인사말은
 * 대화가 아니므로 건너뛰고, 완료되지 않은 답변(스트리밍·중단·실패)도 넣지
 * 않는다. 실패한 답변은 짝지어진 질문까지 함께 버린다. 답이 없는 질문만
 * 남으면 모델이 그 질문에 다시 답하려 들기 때문이다.
 */
function historyFromMessages(messages: ChatMessage[]): ChatHistoryItem[] {
  const history: ChatHistoryItem[] = [];
  let characters = 0;
  let dropPairedUserTurn = false;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.kind === "greeting") continue;
    if (
      message.generationState &&
      message.generationState !== "complete"
    ) {
      // 실패한 답변은 짝지어진 질문까지 함께 버려 짝 없는 사용자 턴을 남기지 않는다.
      dropPairedUserTurn = message.generationState === "failed";
      continue;
    }
    if (dropPairedUserTurn) {
      dropPairedUserTurn = false;
      if (message.role === "user") continue;
    }
    if (history.length >= MAX_HISTORY_ITEMS) break;
    if (characters + message.content.length > MAX_HISTORY_CHARACTERS) break;

    characters += message.content.length;
    history.unshift({ role: message.role, content: message.content });
  }

  return history;
}

/** 저장소에서 읽은 값이 지원하는 말투인지 확인한다. */
function isTone(value: string | null): value is Tone {
  return value !== null && TONES.includes(value as Tone);
}

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

/**
 * 다시 시도할 때 그대로 재사용할 요청 재료다.
 * 재시도가 "그때 그 요청"과 같아야 하므로 대화 기록까지 스냅숏으로 들고 있다.
 * assistantMessageId는 실패한 답변 말풍선을 재시도 전에 지우는 데 쓴다.
 */
interface PendingRetry {
  message: string;
  history: ChatHistoryItem[];
  audienceOverride?: AudienceChoice;
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
  const [focusInputOnOpen, setFocusInputOnOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [availability, setAvailability] =
    useState<ChatAvailability>("idle");
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
  const statusAbortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const retryRef = useRef<PendingRetry | null>(null);
  const retryWaitTimerRef = useRef<number | null>(null);
  /** 렌더 사이클과 무관하게 최신 대화·포인트 색을 읽기 위한 참조다. */
  const messagesRef = useRef<ChatMessage[]>(messages);
  const accentRef = useRef<Accent>(accent);
  const mobileHistoryEntryRef = useRef(false);
  const pendingActionRouteRef = useRef<string | null>(null);
  const pendingActionAnchorRef = useRef<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);
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
  const actionNavigationTokenRef = useRef(0);
  const pendingChatNavigationFocusRef = useRef(false);
  const navigateRouteRef = useRef<(route: string) => void>(() => undefined);
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

  // 색상 순회 도구가 "시작 직전의 색"으로 되돌릴 수 있게 최신 값을 비춘다.
  useEffect(() => {
    accentRef.current = accent;
  }, [accent]);

  /** 재시도 대기 카운트다운을 멈추고 남은 초를 0으로 되돌린다. */
  const clearRetryWait = useCallback(() => {
    if (retryWaitTimerRef.current !== null) {
      window.clearInterval(retryWaitTimerRef.current);
      retryWaitTimerRef.current = null;
    }
    setRetryWaitSeconds(0);
  }, []);

  /** 서버가 알려준 대기 시간 동안 재시도 버튼을 잠그고 남은 초를 센다. */
  const beginRetryWait = useCallback((durationMs: number) => {
    if (retryWaitTimerRef.current !== null) {
      window.clearInterval(retryWaitTimerRef.current);
      retryWaitTimerRef.current = null;
    }
    if (durationMs <= 0) {
      setRetryWaitSeconds(0);
      return;
    }
    const deadline = Date.now() + durationMs;
    setRetryWaitSeconds(Math.max(1, Math.ceil(durationMs / 1_000)));
    retryWaitTimerRef.current = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1_000));
      setRetryWaitSeconds(remaining);
      if (remaining === 0 && retryWaitTimerRef.current !== null) {
        window.clearInterval(retryWaitTimerRef.current);
        retryWaitTimerRef.current = null;
      }
    }, RETRY_WAIT_TICK_MS);
  }, []);

  useEffect(
    () => () => {
      if (retryWaitTimerRef.current !== null) {
        window.clearInterval(retryWaitTimerRef.current);
        retryWaitTimerRef.current = null;
      }
    },
    [],
  );

  // 저장된 채팅 설정은 아래 다섯 개 복원 이펙트가 맡는다. 모두 첫 페인트보다
  // 앞서야 해서 아이소모픽 레이아웃 이펙트를 쓴다. useEffect로 복원하면
  // 하이드레이션이 그린 기본값이 한 번 화면에 나갔다가 바뀌어, 설정 화면의
  // 선택 표시가 새로고침마다 깜빡인다. 값이 깨졌으면 기본값으로 덮어써 다음
  // 방문부터는 정상 값이 읽히게 한다.
  useIsomorphicLayoutEffect(() => {
    try {
      const stored = window.localStorage.getItem(REASONING_STORAGE_KEY);
      if (stored === "true" || stored === "false") {
        setReasoningEnabledState(stored === "true");
      } else if (stored !== null) {
        window.localStorage.setItem(
          REASONING_STORAGE_KEY,
          String(DEFAULT_REASONING_ENABLED),
        );
      }
    } catch {
      // 저장소를 사용할 수 없어도 안전한 기본값인 사고모드 OFF로 동작한다.
    }
  }, []);

  // 저장된 말투를 복원한다. 알 수 없는 값이면 기본 말투로 덮어쓴다.
  useIsomorphicLayoutEffect(() => {
    try {
      const storedTone = window.localStorage.getItem(TONE_STORAGE_KEY);
      if (isTone(storedTone)) {
        setTone(storedTone);
      } else if (storedTone !== null) {
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

    return () => {
      mountedRef.current = false;
      renderQueueRef.current?.cancel();
      abortRef.current?.abort();
      statusAbortRef.current?.abort();
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

  const pageContext = pageContextFromPathname(pathname);

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
    ) => {
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
        scroller.scrollTop = targetTop;
        setFrame(null);
        onComplete();
        return;
      }

      const duration = scrollDurationForDistance(distance);
      const startedAt = window.performance.now();
      const step = (timestamp: number) => {
        const progress = Math.min(1, (timestamp - startedAt) / duration);
        const easedProgress =
          easing === "ease-out"
            ? easeOutCubic(progress)
            : easeInOutCubic(progress);
        scroller.scrollTop = startTop + distance * easedProgress;

        if (progress >= 1) {
          scroller.scrollTop = targetTop;
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

  const portfolioUiToolRuntimeRef = useRef<PortfolioUiToolRuntime | null>(null);
  // 도구 실행에 필요한 setter 묶음을 ref에 갈아 끼운다. 실행기 자체의
  // 아이덴티티는 고정된 채로 최신 setter만 바뀐다.
  useEffect(() => {
    portfolioUiToolRuntimeRef.current = {
      getSettings: () => ({
        theme: mode,
        accent,
        chatLayout,
        chatFont,
        chatFontSize,
      }),
      setMode,
      setAccent,
      setChatLayout,
      setChatFont,
      setChatFontSize,
      setStreamAnimation,
      navigateRoute: (route) => navigateRouteRef.current(route),
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
  ]);

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
   * 예약해 둔 앵커로 문서를 스크롤하고 도착 지점을 잠시 강조한다.
   *
   * 앵커 요소는 페이지 전환 직후 아직 없을 수 있어 50ms 간격으로 최대 3초까지
   * 기다린다. 페이지·패널 진입 애니메이션이 재생 중이면 끝나기를 기다린 뒤
   * 위치를 잰다. 애니메이션 도중의 좌표로 스크롤하면 엉뚱한 곳에서 멈춘다.
   *
   * 도착하면 포커스를 옮기고 도착 이벤트를 알린 뒤 강조 표시를 1.65초 뒤에
   * 거둔다. 모션이 억제된 환경에서는 강조를 생략한다. 끝내 요소를 찾지 못하면
   * 예약을 비우고 조용히 포기한다.
   */
  const scrollToPendingActionAnchor = useCallback(() => {
    const anchor = pendingActionAnchorRef.current;
    if (!anchor) return;
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

    const startedAt = window.performance.now();
    const completeTargetArrival = (target: HTMLElement) => {
      pendingActionAnchorRef.current = null;
      pendingActionPathRef.current = null;
      activeActionNavigationRouteRef.current = null;
      actionScrollFrameRef.current = null;
      actionScrollTimerRef.current = null;
      target.focus({ preventScroll: true });
      window.dispatchEvent(
        new CustomEvent<ChatActionTargetArrivedDetail>(
          CHAT_ACTION_TARGET_ARRIVED_EVENT,
          { detail: { anchor: target.id } },
        ),
      );
      restoreChatInputAfterNavigation();

      if (motionSuppressed) return;
      if (actionTargetHighlightTimerRef.current !== null) {
        window.clearTimeout(actionTargetHighlightTimerRef.current);
      }
      highlightedActionTargetRef.current?.removeAttribute(
        "data-chat-action-target",
      );
      highlightedActionTargetRef.current = target;
      target.setAttribute("data-chat-action-target", "true");
      actionTargetHighlightTimerRef.current = window.setTimeout(() => {
        target.removeAttribute("data-chat-action-target");
        if (highlightedActionTargetRef.current === target) {
          highlightedActionTargetRef.current = null;
        }
        actionTargetHighlightTimerRef.current = null;
      }, 1_650);
    };

    const scroll = () => {
      if (pendingActionAnchorRef.current !== anchor) return;
      const target = document.getElementById(anchor);
      if (!target) {
        if (
          window.performance.now() - startedAt <
          ACTION_TARGET_WAIT_TIMEOUT_MS
        ) {
          actionScrollTimerRef.current = window.setTimeout(scroll, 50);
        } else {
          pendingActionAnchorRef.current = null;
          pendingActionPathRef.current = null;
          activeActionNavigationRouteRef.current = null;
          actionScrollTimerRef.current = null;
          restoreChatInputAfterNavigation();
        }
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
          if (pendingActionAnchorRef.current === anchor) scroll();
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
          actionScrollFrameRef.current = frame;
        },
        () => {
          if (pendingActionAnchorRef.current === anchor) {
            completeTargetArrival(target);
          }
        },
      );
    };
    actionScrollFrameRef.current = window.requestAnimationFrame(() => {
      actionScrollFrameRef.current = window.requestAnimationFrame(scroll);
    });
  }, [animateDocumentScroll, motionSuppressed, restoreChatInputAfterNavigation]);

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
    (route: string) => {
      if (!SAFE_ROUTE_PATTERN.test(route)) {
        console.warn("허용되지 않은 이동 경로를 무시했습니다.", route);
        return;
      }
      if (activeActionNavigationRouteRef.current === route) return;
      activeActionNavigationRouteRef.current = route;
      actionNavigationTokenRef.current += 1;
      const navigationToken = actionNavigationTokenRef.current;
      if (actionTopScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(actionTopScrollFrameRef.current);
        actionTopScrollFrameRef.current = null;
      }
      if (actionPageEntryTimerRef.current !== null) {
        window.clearTimeout(actionPageEntryTimerRef.current);
        actionPageEntryTimerRef.current = null;
      }

      const hashIndex = route.indexOf("#");
      const actionAnchor =
        hashIndex >= 0
          ? decodeURIComponent(route.slice(hashIndex + 1))
          : null;
      pendingActionAnchorRef.current = actionAnchor;
      const routePath = pathWithoutHash(route);
      pendingActionPathRef.current = routePath;
      if (!actionAnchor) {
        pendingActionAnchorRef.current = null;
        pendingActionPathRef.current = null;
        pendingActionAwaitingPageEntryRef.current = false;
        activeActionNavigationRouteRef.current = null;
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
        if (actionNavigationTokenRef.current !== navigationToken) return;
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
          actionTopScrollFrameRef.current = frame;
        },
        () => {
          if (actionNavigationTokenRef.current === navigationToken) {
            dispatchNavigation();
          }
        },
        "ease-out",
      );
    },
    [
      animateDocumentScroll,
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
    actionPageEntryTimerRef.current = window.setTimeout(() => {
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
   * 추론 서버 연결 상태를 다시 확인한다.
   *
   * 확인이 겹치면 앞선 요청을 취소하고 마지막 결과만 반영한다. 5초 안에
   * 응답이 없거나 실패하면 오프라인으로 본다(확인할 수 없다는 것과
   * 꺼져 있다는 것을 화면에서 구분할 필요가 없다).
   *
   * `silent`를 주면 확인 중이라는 표시(`checking`)로 넘어가지 않는다.
   * 대화 도중 배경에서 상태만 갱신할 때 쓰며, 그러지 않으면 읽고 있던
   * 대화가 "연결 확인 중" 화면으로 잠시 가려진다.
   */
  const refreshAvailability = useCallback(async (
    options?: { silent?: boolean },
  ) => {
    statusAbortRef.current?.abort();
    const controller = new AbortController();
    statusAbortRef.current = controller;
    if (!options?.silent) setAvailability("checking");
    const timeout = window.setTimeout(
      () => controller.abort(),
      CHAT_STATUS_TIMEOUT_MS,
    );

    try {
      const response = await requestChatStatus(controller.signal);
      if (statusAbortRef.current === controller) {
        setAvailability(response.status);
      }
    } catch {
      if (statusAbortRef.current === controller) {
        setAvailability("offline");
      }
    } finally {
      window.clearTimeout(timeout);
      if (statusAbortRef.current === controller) {
        statusAbortRef.current = null;
      }
    }
  }, []);

  /*
   * 콘텐츠 카드의 "AI에게 물어보기" 진입점을 온라인일 때만 노출하려면
   * 채팅창을 열기 전에도 가벼운 상태 확인이 한 번 필요하다.
   */
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void refreshAvailability();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [refreshAvailability]);

  /**
   * 채팅 패널을 연다.
   *
   * 이미 열려 있거나 닫히는 중이면 아무 일도 하지 않는다. 모바일에서는
   * 히스토리 항목을 하나 밀어 넣어 뒤로가기로 패널만 닫히게 하고, 온라인이
   * 아니면 상태를 다시 확인한다. 여는 순간 마크다운 렌더러를 미리 불러
   * 첫 답변이 완성될 때 서식이 바로 붙게 한다.
   */
  const open = useCallback((options?: { focusInput?: boolean }) => {
    if (
      isOpenRef.current ||
      isClosingRef.current ||
      cleanupHistoryPopRef.current
    ) {
      return;
    }
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
    setIsOpen(true);
    if (availability !== "online") {
      void refreshAvailability();
    }
  }, [availability, refreshAvailability]);

  /**
   * 퇴장 연출이 끝난 시점에 패널을 실제로 내린다.
   *
   * 모바일에서 히스토리 항목을 밀어 넣었다면 그것을 되돌린 뒤, popstate
   * 처리에서 예약된 이동을 이어 간다. 닫히는 중이 아니면 아무 일도 하지 않아
   * 애니메이션 끝 이벤트와 타이머가 겹쳐도 두 번 실행되지 않는다.
   */
  const completeCloseAnimation = useCallback(() => {
    if (!isClosingRef.current) return;
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
    if (pendingRoute) navigateToActionTarget(pendingRoute);
  }, [navigateToActionTarget]);

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
      isClosingRef.current = true;
      setIsClosing(true);
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      closeTimerRef.current = window.setTimeout(
        completeCloseAnimation,
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
      isClosingRef.current = true;
      setIsClosing(true);
      closeTimerRef.current = window.setTimeout(
        completeCloseAnimation,
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
            navigateToActionTarget(pendingRoute),
          );
        }
        return;
      }

      if (!mobileHistoryEntryRef.current) return;
      mobileHistoryEntryRef.current = false;
      beginMobileClose(false);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [beginMobileClose, navigateToActionTarget]);

  /**
   * 질문 한 번의 전체 수명주기를 실행한다. 이 파일에서 가장 무거운 함수다.
   *
   * 흐름은 이렇다. 요청 본문을 조립하고(설정·화면 상태 포함), 스트리밍이면
   * 빈 답변 말풍선을 먼저 만들어 delta를 이어 붙인다. 도착한 delta는 렌더
   * 큐가 화면 재생 속도를 맡고, 네트워크 읽기는 그와 무관하게 계속 진행된다.
   *
   * 도구 실행은 순차 큐에서 처리한다. 하나가 실패해도 답변 전체를 실패로
   * 만들지 않는다. 색상 순회처럼 시간이 걸리는 도구가 오면 그동안 도착한
   * 텍스트를 잠시 보류했다가 순회가 끝난 뒤 이어서 그린다. 연출과 글자가
   * 동시에 쏟아지면 어느 쪽도 눈에 들어오지 않기 때문이다.
   *
   * 끝맺음은 세 갈래다. 정상 완료면 말풍선을 완성본으로 교체하고, 사용자가
   * 중단했으면 그때까지의 글을 남긴 채 중단 표시를 붙이며, 실패하면 사유를
   * 말풍선에 담고 재시도 재료를 보관한다. 중단·실패와 무관하게 마지막에는
   * 렌더 큐·컨트롤러·진행 플래그를 반드시 정리한다.
   *
   * 이미 요청이 진행 중이면 아무 일도 하지 않는다.
   */
  const performRequest = useCallback(
    async (pending: PendingRetry) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      stopRequestedRef.current = false;
      setIsLoading(true);
      setError(null);
      clearRetryWait();

      const controller = new AbortController();
      abortRef.current = controller;
      const request: ChatRequest = {
        message: pending.message,
        history: pending.history,
        audience: audienceToApi(pending.audienceOverride ?? audience),
        tone,
        pageContext,
        reasoningEnabled,
        uiSettings: {
          theme: mode,
          accent,
          chatLayout,
          chatFont,
          chatFontSize,
        },
        viewState: readPortfolioViewState(pathname),
      };
      const shouldStream = streamingEnabled;
      let streamingMessageId: string | undefined;
      const handledToolCallIds = new Set<string>();
      let toolExecutionQueue = Promise.resolve();
      let deferStreamDeltas = false;
      const deferredStreamDeltas: string[] = [];
      const handleToolExecution = (execution: ChatToolExecution) => {
        if (handledToolCallIds.has(execution.toolCallId)) return;
        handledToolCallIds.add(execution.toolCallId);
        if (execution.type === "cycle_portfolio_accent") {
          deferStreamDeltas = true;
        }
        // 도구 하나가 실패해도 답변 전체를 실패로 만들지 않는다.
        toolExecutionQueue = toolExecutionQueue.then(async () => {
          try {
            if (execution.type === "cycle_portfolio_accent") {
              // 중단·실패로 끝나면 순회 직전의 색으로 되돌린다.
              const accentBeforeCycle = accentRef.current;
              let cycleCompleted = false;
              try {
                for (
                  let index = 0;
                  index < execution.accents.length;
                  index += 1
                ) {
                  if (controller.signal.aborted) {
                    throw new DOMException(
                      "The operation was aborted.",
                      "AbortError",
                    );
                  }
                  setAccent(execution.accents[index] as Accent);
                  if (index + 1 < execution.accents.length) {
                    await waitForAccentCycleStep(
                      execution.stepMs,
                      controller.signal,
                    );
                  }
                }
                cycleCompleted = true;
              } finally {
                if (!cycleCompleted) setAccent(accentBeforeCycle);
              }
              return;
            }
            const uiCommand = portfolioUiCommandFromChatExecution(execution);
            if (uiCommand) {
              if (execution.type === "control_portfolio_view") {
                pendingChatNavigationFocusRef.current = true;
              }
              executePortfolioUiTool(uiCommand);
              return;
            }
            if (
              execution.type === "report_portfolio_ui_settings" ||
              execution.type === "report_portfolio_view_state"
            ) {
              return;
            }
            if (execution.type === "show_portfolio_log_results") {
              dispatchPortfolioModelToolExecution(execution);
            }
          } catch (toolError) {
            if (
              toolError instanceof DOMException &&
              toolError.name === "AbortError"
            ) {
              // 요청 취소는 도구 실패가 아니다. 중단 처리는 요청 쪽이 맡는다.
              return;
            }
            console.warn(
              `포트폴리오 도구 '${execution.toolName}'을(를) 실행하지 못했습니다.`,
              toolError,
            );
          }
        });
      };

      const appendStreamDelta = (text: string) => {
        if (
          !mountedRef.current ||
          controller.signal.aborted ||
          !text ||
          !streamingMessageId
        ) {
          return;
        }
        setMessages((current) =>
          current.map((chatMessage) =>
            chatMessage.id === streamingMessageId
              ? {
                  ...chatMessage,
                  content: `${chatMessage.content}${text}`,
                }
              : chatMessage,
          ),
        );
      };

      if (shouldStream) {
        streamingMessageId = nextId("assistant");
        pending.assistantMessageId = streamingMessageId;
        setMessages((current) => [
          ...current,
          {
            id: streamingMessageId as string,
            role: "assistant",
            content: "",
            kind: "message",
            generationState: "streaming",
          },
        ]);
      }

      const renderQueue = shouldStream
        ? new StreamRenderQueue(appendStreamDelta)
        : null;
      renderQueueRef.current?.cancel();
      renderQueueRef.current = renderQueue;

      try {
        const response = shouldStream
          ? await requestChatStream(request, controller.signal, {
              onDelta(text) {
                if (deferStreamDeltas) deferredStreamDeltas.push(text);
                else renderQueue?.enqueue(text);
              },
              onTool: handleToolExecution,
            })
          : await requestChat(request, controller.signal);
        response.toolExecutions.forEach(handleToolExecution);
        await toolExecutionQueue;
        deferStreamDeltas = false;
        for (const text of deferredStreamDeltas) renderQueue?.enqueue(text);
        deferredStreamDeltas.length = 0;
        await renderQueue?.drain();
        if (controller.signal.aborted) {
          throw new DOMException("The operation was aborted.", "AbortError");
        }
        if (!mountedRef.current) return;
        if (response.status === "upstream_offline") {
          if (
            !messagesRef.current.some(
              (chatMessage) => chatMessage.role === "user",
            )
          ) {
            // 대화가 시작되기 전이면 화면 전체를 오프라인 안내로 바꾼다.
            setAvailability("offline");
          } else {
            // 대화 중에는 화면을 갈아끼우지 않고 상태만 조용히 다시 확인한다.
            // 실제로 서버가 꺼져 있으면 상단 배너가 그 사실을 알린다.
            void refreshAvailability({ silent: true });
          }
        }
        const completedMessage: ChatMessage = {
          id: streamingMessageId ?? nextId("assistant"),
          role: "assistant",
          content: response.answer,
          kind:
            response.mode === "retrieval_fallback"
              ? "retrieval_fallback"
              : "message",
          generationState: "complete",
          segments: response.segments,
          actions: response.actions,
          suggestedQuestions: response.suggestedQuestions,
        };
        setMessages((current) =>
          streamingMessageId
            ? current.map((chatMessage) =>
                chatMessage.id === streamingMessageId
                  ? completedMessage
                  : chatMessage,
              )
            : [...current, completedMessage],
        );
        retryRef.current = null;
        clearRetryWait();
      } catch (requestError) {
        if (!mountedRef.current) return;
        const requestWasAborted =
          controller.signal.aborted ||
          (requestError instanceof DOMException &&
            requestError.name === "AbortError");
        if (!requestWasAborted && deferredStreamDeltas.length > 0) {
          // 도구를 기다리며 보류한 텍스트는 서버가 이미 보낸 답변이다. 남긴다.
          deferStreamDeltas = false;
          for (const text of deferredStreamDeltas) renderQueue?.enqueue(text);
          deferredStreamDeltas.length = 0;
          await renderQueue?.drain();
        }
        if (requestWasAborted) {
          if (stopRequestedRef.current) {
            if (streamingMessageId) {
              setMessages((current) =>
                current.map((chatMessage) =>
                  chatMessage.id === streamingMessageId
                    ? { ...chatMessage, generationState: "stopped" }
                    : chatMessage,
                ),
              );
            }
            setError(
              "응답 생성이 중단되었습니다. 원하면 다시 시도할 수 있어요.",
            );
          }
          return;
        }
        const failureMessage =
          requestError instanceof ChatApiError
            ? requestError.message
            : "요청을 처리하지 못했습니다. 다시 시도해 주세요.";
        if (streamingMessageId) {
          setMessages((current) =>
            current.map((chatMessage) =>
              chatMessage.id === streamingMessageId
                ? {
                    ...chatMessage,
                    generationState: "failed",
                    errorMessage: failureMessage,
                  }
                : chatMessage,
            ),
          );
        }
        retryRef.current = pending;
        // 실패 말풍선이 사유와 재시도를 직접 안내하므로 하단 오류 박스는 비운다.
        setError(streamingMessageId ? null : failureMessage);
        beginRetryWait(
          requestError instanceof ChatApiError && requestError.retryAfterMs
            ? requestError.retryAfterMs
            : 0,
        );
      } finally {
        void toolExecutionQueue.catch(() => undefined);
        renderQueue?.cancel();
        if (renderQueueRef.current === renderQueue) renderQueueRef.current = null;
        if (abortRef.current === controller) abortRef.current = null;
        stopRequestedRef.current = false;
        inFlightRef.current = false;
        if (mountedRef.current) setIsLoading(false);
      }
    },
    [
      audience,
      accent,
      beginRetryWait,
      chatFont,
      chatFontSize,
      chatLayout,
      clearRetryWait,
      executePortfolioUiTool,
      mode,
      nextId,
      pageContext,
      pathname,
      reasoningEnabled,
      refreshAvailability,
      streamingEnabled,
      setAccent,
      tone,
    ],
  );

  /**
   * 추론 서버가 꺼져 있어도 대화가 시작된 뒤에는 계속 물어볼 수 있다.
   * 이때 서버는 검색 결과 기반(retrieval_fallback) 답변을 돌려준다.
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
   * 대화 기록은 사용자 말풍선을 추가하기 전의 것으로 만든다. 방금 던진 질문이
   * 기록에 중복으로 들어가지 않게 하기 위함이다. 재시도 재료도 여기서 남긴다.
   */
  const sendMessage = useCallback(
    async (content: string, audienceOverride?: AudienceChoice) => {
      const message = content.trim();
      if (!message || !canRequest() || inFlightRef.current) {
        return;
      }

      const history = historyFromMessages(messagesRef.current);
      setMessages((current) => [
        ...current,
        {
          id: nextId("user"),
          role: "user",
          content: message,
          kind: "message",
        },
      ]);
      const pending = { message, history, audienceOverride };
      retryRef.current = pending;
      await performRequest(pending);
    },
    [canRequest, nextId, performRequest],
  );

  /**
   * 마지막으로 실패한 요청을 같은 재료로 다시 보낸다.
   *
   * 실패한 답변 말풍선이 있으면 먼저 지운다. 그러지 않으면 실패한 답변과 새
   * 답변이 나란히 남는다. 재시도할 재료가 없거나 요청이 진행 중이면 아무 일도
   * 하지 않는다.
   */
  const retry = useCallback(async () => {
    if (!canRequest() || !retryRef.current || inFlightRef.current) {
      return;
    }
    const pending = retryRef.current;
    if (pending.assistantMessageId) {
      setMessages((current) =>
        current.filter(({ id }) => id !== pending.assistantMessageId),
      );
      pending.assistantMessageId = undefined;
    }
    await performRequest(pending);
  }, [canRequest, performRequest]);

  /**
   * 진행 중인 응답 생성을 사용자의 뜻으로 중단한다.
   *
   * 렌더 큐를 먼저 비워 이미 받은 글이 계속 흘러나오지 않게 하고, 요청을
   * 취소한다. 중단 표시와 안내는 요청 쪽 실패 처리에서 붙인다.
   */
  const stopGenerating = useCallback(() => {
    if (!inFlightRef.current || !abortRef.current) return;
    stopRequestedRef.current = true;
    renderQueueRef.current?.cancel();
    abortRef.current.abort();
  }, []);

  /**
   * 대화를 처음 상태로 되돌린다.
   *
   * 진행 중인 요청이 있으면 함께 취소하되, 중단 요청 표시는 세우지 않는다.
   * 사용자가 원한 것은 "새 대화"이지 "중단 안내"가 아니기 때문이다.
   */
  const resetConversation = useCallback(() => {
    retryRef.current = null;
    setError(null);
    clearRetryWait();
    setAudience(null);
    setMessages(initialMessages());

    if (inFlightRef.current && abortRef.current) {
      // 사용자 중단 안내를 남기지 않고 진행 중인 요청만 조용히 정리한다.
      stopRequestedRef.current = false;
      renderQueueRef.current?.cancel();
      abortRef.current.abort();
    }
  }, [clearRetryWait]);

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
  const selectTone = useCallback((nextTone: Tone) => {
    if (!TONES.includes(nextTone)) return;
    setTone(nextTone);
    try {
      window.localStorage.setItem(TONE_STORAGE_KEY, nextTone);
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
    (route: string) => {
      if (
        window.matchMedia(MOBILE_QUERY).matches &&
        isOpenRef.current
      ) {
        pendingActionRouteRef.current = route;
        beginMobileClose(
          mobileHistoryEntryRef.current &&
            window.history.state?.[MOBILE_HISTORY_MARKER] === true,
        );
        return;
      }
      navigateToActionTarget(route);
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
    (route: string) => navigateRouteRef.current(route),
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
      focusInputOnOpen,
      isLoading,
      isOpen,
      isClosing,
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
