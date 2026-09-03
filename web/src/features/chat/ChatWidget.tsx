"use client";

/**
 * 채팅 패널의 셸이다. 열림·닫힘 연출, 스크롤 고정, 포커스 관리, 모바일
 * 뷰포트 대응, 빠른 메뉴와 둘러보기 카드 배치를 맡는다.
 *
 * 말풍선·온보딩·연결 상태 안내처럼 "그리기만 하는" 부분은 별도 모듈로
 * 떼어 냈다. 이 파일이 대화 상태와 브라우저 환경의 접점에만 집중하도록
 * 하기 위함이고, 떼어 낸 말풍선은 memo가 걸려 스트리밍 중 리렌더도 줄어든다.
 */
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CHAT_DOCK_DEFAULT_WIDTH,
  CHAT_DOCK_MAX_WIDTH,
  CHAT_DOCK_MIN_WIDTH,
  useTheme,
} from "../../context/ThemeContext";
import type ElasticJellyPanel from "../../lib/ElasticJellyPanel";
import {
  CHAT_QUICK_START_OPTION_BY_ACTION_ID,
  REASONING_QUICK_TOGGLE_ENABLED,
  TONE_OPTIONS,
} from "./constants";
import { useChat } from "./ChatContext";
import { GuidedTourCard, GuidedTourInvite } from "./GuidedTourCard";
import { ChatOnboarding } from "./ChatOnboarding";
import {
  ChatAvailabilityCheckingScreen,
  ChatOfflineBanner,
  ChatOfflineScreen,
} from "./ChatOfflineNotice";
import { EMPTY_SUGGESTED_QUESTIONS, MessageItem } from "./MessageItem";
import { useChatInputHistory } from "./useChatInputHistory";
import { CHAT_ACTION_RESTORE_CHAT_INPUT_EVENT } from "./navigation";
import type { ActionId, AudienceChoice } from "./types";
import styles from "./ChatWidget.module.css";

/** 모바일 취급 기준. 좁은 화면이면서 포인터가 손가락일 때만이다. */
const MOBILE_QUERY = "(max-width: 720px) and (pointer: coarse)";
/** 이 너비 이상에서만 오른쪽 고정 패널(dock)을 허용한다. */
const WIDE_DESKTOP_QUERY = "(min-width: 1100px)";
/** 목록 하단에서 이만큼 안쪽이면 "바닥을 보고 있다"고 판단한다. */
const BOTTOM_PIN_THRESHOLD_PX = 64;
/** 모바일 키보드가 뷰포트를 줄인 뒤 안정될 때까지 기다리는 시간이다. */
const KEYBOARD_SETTLE_DELAY_MS = 220;
/** 빠른 메뉴가 접히는 연출 길이다. 이후 DOM에서 제거한다. */
const QUICK_MENU_EXIT_DURATION_MS = 520;
/** 둘러보기 카드가 화면에 나타나기까지의 지연이다. */
const MOBILE_TOUR_REVEAL_DELAY_MS = 500;
/** 둘러보기 카드가 붙고 떨어질 때 패널 레이아웃이 바뀌는 시간이다. */
const TOUR_LAYOUT_TRANSITION_MS = 420;
/** 이 시간 동안 새 텍스트가 오지 않으면 "오래 걸리는 중" 안내로 바꾼다. */
const SLOW_RESPONSE_NOTICE_MS = 12_000;
/** 젤리 엔진이 콘텐츠 래퍼를 찾을 때 쓰는 전역 클래스명(엔진 계약)이다. */
const JELLY_CONTENT_CLASS = "chat-content-wrapper";

/** 모바일 키보드 대응에 쓰는 visualViewport 측정값이다. */
interface VisualViewportMetrics {
  top: number;
  left: number;
  width: number;
  height: number;
  exitDistance: number;
}

/** 측정값을 CSS 커스텀 속성으로 넘길 때 쓰는 스타일 타입이다. */
type VisualViewportStyle = CSSProperties &
  Record<
    | "--chat-vv-top"
    | "--chat-vv-left"
    | "--chat-vv-width"
    | "--chat-vv-height"
    | "--chat-exit-distance",
    string
  >;

/**
 * 지금 보고 있는 화면이 빠른 시작 목적지 중 하나인지 알아낸다.
 *
 * 이미 도착한 곳으로 다시 가라는 버튼을 숨기는 데 쓴다. 경로와 앵커가 둘 다
 * 맞을 때만 인정하고, 아니면 null이다.
 */
function quickDestinationFromLocation(
  pathname: string,
  hash: string,
): ActionId | null {
  const normalizedPath = pathname.replace(/\/+$/u, "") || "/";
  const anchor = hash.replace(/^#/u, "");
  if (
    normalizedPath.endsWith("/about-me") &&
    anchor === "featured-projects"
  ) {
    return "project_overview";
  }
  if (
    normalizedPath.endsWith("/about-me/research") &&
    anchor === "research-optimization-overview"
  ) {
    return "research_optimization";
  }
  return null;
}

/**
 * 추천 질문을 "같은 질문인지" 비교하기 위한 키로 바꾼다.
 *
 * 정규화·공백 정리·끝의 물음표·마침표 제거·소문자화를 거치므로, 표기만 다른
 * 같은 질문은 하나로 취급된다. 이미 눌러 본 질문을 다시 보여 주지 않는 데 쓴다.
 */
function suggestedQuestionKey(question: string): string {
  return question
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[?？!！.。]+$/u, "")
    .toLowerCase();
}

/**
 * 지금이 모바일 취급 환경인지 구독한다.
 *
 * 서버 렌더에는 미디어쿼리가 없으므로 false로 시작해 마운트 뒤에 맞춘다.
 * 회전·창 크기 변경에도 계속 따라간다.
 */
function useMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobile;
}

/**
 * 오른쪽 고정 패널을 놓을 만큼 넓은 화면인지 구독한다.
 *
 * 설정에서 dock을 골랐어도 이 값이 false면 플로팅으로 그린다. 좁은 화면에서
 * 본문을 반쯤 가리는 패널을 만들지 않기 위해서다.
 */
function useWideDesktopViewport(): boolean {
  const [isWideDesktop, setIsWideDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(WIDE_DESKTOP_QUERY);
    const update = () => setIsWideDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isWideDesktop;
}

/**
 * 모바일 키보드가 화면을 줄여도 패널이 제자리에 있도록 CSS 변수를 만든다.
 *
 * visualViewport의 위치·크기를 rAF로 모아 읽어 잦은 이벤트에도 한 프레임에
 * 한 번만 반영한다. 값이 그대로면 같은 객체를 유지해 불필요한 리렌더를 막는다.
 * 퇴장 거리(--chat-exit-distance)는 한 번 커지면 줄이지 않는다. 키보드가
 * 접히는 도중 값이 작아지면 패널이 화면 밖으로 다 나가지 못하기 때문이다.
 *
 * `enabled`가 false면 아무것도 구독하지 않고 undefined를 돌려준다.
 */
function useVisualViewportStyle(
  enabled: boolean,
): VisualViewportStyle | undefined {
  const [metrics, setMetrics] = useState<VisualViewportMetrics | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let animationFrame = 0;
    let settleTimer = 0;
    const update = () => {
      const viewport = window.visualViewport;
      const top = Math.max(0, viewport?.offsetTop ?? 0);
      const left = Math.max(0, viewport?.offsetLeft ?? 0);
      const width = Math.max(1, viewport?.width ?? window.innerWidth);
      const height = Math.max(1, viewport?.height ?? window.innerHeight);
      const requiredExitDistance =
        Math.max(
          height + top,
          window.innerHeight,
          document.documentElement.clientHeight,
          window.screen?.height ?? 0,
        ) + 96;

      setMetrics((current) => {
        const next = {
          top,
          left,
          width,
          height,
          exitDistance: Math.max(
            current?.exitDistance ?? 0,
            requiredExitDistance,
          ),
        };
        return current &&
          current.top === next.top &&
          current.left === next.left &&
          current.width === next.width &&
          current.height === next.height &&
          current.exitDistance === next.exitDistance
          ? current
          : next;
      });
    };
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(update);
    };
    const updateAfterKeyboardTransition = () => {
      scheduleUpdate();
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(scheduleUpdate, 180);
    };

    scheduleUpdate();
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", scheduleUpdate);
    viewport?.addEventListener("scroll", scheduleUpdate);
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("orientationchange", updateAfterKeyboardTransition);
    document.addEventListener("focusin", updateAfterKeyboardTransition);
    document.addEventListener("focusout", updateAfterKeyboardTransition);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(settleTimer);
      viewport?.removeEventListener("resize", scheduleUpdate);
      viewport?.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener(
        "orientationchange",
        updateAfterKeyboardTransition,
      );
      document.removeEventListener("focusin", updateAfterKeyboardTransition);
      document.removeEventListener("focusout", updateAfterKeyboardTransition);
    };
  }, [enabled]);

  return useMemo(() => {
    if (!enabled || !metrics) return undefined;
    return {
      "--chat-vv-top": `${metrics.top}px`,
      "--chat-vv-left": `${metrics.left}px`,
      "--chat-vv-width": `${metrics.width}px`,
      "--chat-vv-height": `${metrics.height}px`,
      "--chat-exit-distance": `${metrics.exitDistance}px`,
    };
  }, [enabled, metrics]);
}

/**
 * 포트폴리오 챗봇 패널과 플로팅 버튼 전체를 그린다.
 *
 * 대화 상태는 모두 ChatProvider가 쥐고, 이 컴포넌트는 그 상태를 화면 배치와
 * 브라우저 환경에 맞춰 옮긴다. 맡는 일은 크게 네 가지다.
 * (1) 패널 열림·닫힘과 연출(슬라이드·젤리·모바일 전체 화면),
 * (2) 새 답변이 와도 바닥을 놓치지 않는 스크롤 고정,
 * (3) 응답 전후의 포커스 복원과 모바일 키보드 대응,
 * (4) 빠른 메뉴·둘러보기 카드와 패널의 공존 규칙.
 *
 * 렌더 자체에 부작용은 없고, 문서 루트의 data 속성(레이아웃 신호)만 effect로
 * 다룬 뒤 정리한다.
 */
export function ChatWidget() {
  const pathname = usePathname();
  const {
    fabMode,
    fabAnim,
    chatLayout,
    chatDockWidth,
    motion,
    mode,
    setMode,
    setChatDockWidth,
  } = useTheme();
  const {
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
    effectiveChatAnimation,
    effectiveStreamAnimation,
    guidedTour,
    guidedTourStep,
    guidedTourInviteVisible,
    focusInputOnOpen,
    open,
    close,
    completeCloseAnimation,
    selectAudience,
    selectTone,
    setReasoningEnabled,
    refreshAvailability,
    resetConversation,
    showSettingsWebMcpGuide,
    sendMessage,
    stopGenerating,
    retry,
    navigateAction,
    startGuidedTour,
    advanceGuidedTour,
    previousGuidedTourStep,
    skipGuidedTourInteraction,
    stopGuidedTour,
    dismissGuidedTourInvite,
    returnToGuidedTourStep,
  } = useChat();
  const [draft, setDraft] = useState("");
  const [usedSuggestedQuestionKeys, setUsedSuggestedQuestionKeys] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [activeQuickDestination, setActiveQuickDestination] =
    useState<ActionId | null>(null);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [quickMenuClosing, setQuickMenuClosing] = useState(false);
  const [tourCardReady, setTourCardReady] = useState(false);
  const [jellySurfaceReady, setJellySurfaceReady] = useState(false);
  /** 젤리 엔진 모듈을 불러오지 못했거나 초기화에 실패했는지다. */
  const [jellyUnavailable, setJellyUnavailable] = useState(false);
  const quickMenuEnabled = fabMode === "quick-menu";
  const isMobile = useMobileViewport();
  const isWideDesktop = useWideDesktopViewport();
  const isDocked = chatLayout === "dock" && isWideDesktop;
  const quickMenuCanCoexistWithChat = !isOpen || isDocked;
  const quickMenuExpanded =
    quickMenuEnabled && quickMenuOpen && quickMenuCanCoexistWithChat;
  const quickMenuRendered =
    quickMenuEnabled &&
    (quickMenuOpen || quickMenuClosing) &&
    quickMenuCanCoexistWithChat;
  const triggerControlsQuickMenu =
    quickMenuEnabled && quickMenuCanCoexistWithChat;
  const visualViewportStyle = useVisualViewportStyle(isMobile);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const externalTourRef = useRef<HTMLDivElement>(null);
  const externalTourChatButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wasDockedRef = useRef(isDocked);
  const wasLoadingRef = useRef(isLoading);
  const focusWasInsidePanelDuringLoadingRef = useRef(false);
  const messageListRef = useRef<HTMLDivElement>(null);
  const jellyRef = useRef<ElasticJellyPanel | null>(null);
  const wasOpenRef = useRef(false);
  const wasOpenForScrollRef = useRef(false);
  const isBottomPinnedRef = useRef(true);
  const preservePinUntilRef = useRef(0);
  const firstPinFrameRef = useRef(0);
  const secondPinFrameRef = useRef(0);
  const pinSettleTimerRef = useRef(0);
  const quickMenuCloseTimerRef = useRef(0);
  /** 위·아래 화살표로 되짚을 수 있는 내가 보낸 질문 목록이다. */
  const inputHistory = useMemo(
    () =>
      messages
        .filter((message) => message.role === "user")
        .map((message) => message.content),
    [messages],
  );
  const {
    changeValue: changeDraft,
    handleHistoryKeyDown,
    resetNavigation: resetInputHistoryNavigation,
  } = useChatInputHistory({
    entries: inputHistory,
    value: draft,
    inputRef,
    onValueChange: setDraft,
  });
  const showOnboarding =
    availability === "online" &&
    messages.length === 1 &&
    messages[0]?.kind === "greeting" &&
    guidedTour.status === "idle" &&
    !isLoading;
  const guidedTourAvailable = availability === "online";
  const guidedTourVisible =
    guidedTourAvailable &&
    (guidedTour.status === "active" || guidedTour.status === "completed");
  const responseInProgress =
    isLoading || guidedTour.interaction === "answering";
  const tourSuppressed =
    (responseInProgress && (isMobile || isDocked)) ||
    (isMobile && isOpen);
  const guidedTourInternal =
    guidedTourVisible && tourCardReady && !tourSuppressed && isOpen && isDocked;
  const guidedTourExternal =
    guidedTourVisible && tourCardReady && !tourSuppressed && !guidedTourInternal;
  const mobileTourDocked =
    isMobile &&
    !isOpen &&
    !isClosing &&
    guidedTourExternal;

  // 둘러보기 카드는 잠깐 뜸을 들였다가 나타난다. 페이지 전환과 동시에
  // 나타나면 이동 자체가 카드에 가려 보이지 않는다.
  useEffect(() => {
    if (!guidedTourVisible || tourSuppressed) {
      const hideTimer = window.setTimeout(
        () => setTourCardReady(false),
        0,
      );
      return () => window.clearTimeout(hideTimer);
    }

    const revealTimer = window.setTimeout(
      () => setTourCardReady(true),
      MOBILE_TOUR_REVEAL_DELAY_MS,
    );
    return () => window.clearTimeout(revealTimer);
  }, [guidedTourVisible, tourSuppressed]);

  // 패널 밖 둘러보기 카드의 높이를 CSS 변수로 알려, 본문이 카드에 가리지
  // 않게 한다. ResizeObserver가 없는 환경에서는 한 번만 재고 만다.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const guide = externalTourRef.current;
    if (!root || !guide || !guidedTourExternal) {
      root?.style.removeProperty("--guided-tour-external-height");
      return;
    }

    const updateHeight = (height: number) => {
      root.style.setProperty(
        "--guided-tour-external-height",
        `${Math.ceil(height)}px`,
      );
    };
    if (typeof ResizeObserver === "undefined") {
      const frame = window.requestAnimationFrame(() =>
        updateHeight(guide.getBoundingClientRect().height),
      );
      return () => {
        window.cancelAnimationFrame(frame);
        root.style.removeProperty("--guided-tour-external-height");
      };
    }

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const borderSize = entry.borderBoxSize[0]?.blockSize;
      updateHeight(borderSize ?? entry.contentRect.height);
    });
    observer.observe(guide);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--guided-tour-external-height");
    };
  }, [guidedTourExternal]);

  /**
   * 둘러보기 단계 전환을 실행한다.
   *
   * 모바일에서 패널이 열려 있으면 먼저 닫는다. 전체 화면을 덮은 패널 뒤에서
   * 페이지가 바뀌면 사용자가 이동 자체를 보지 못하기 때문이다. PC에서는
   * 패널과 카드가 함께 보이므로 그대로 전환한다.
   */
  const runTourTransition = useCallback(
    (transition: () => void) => {
      if (!isOpen) {
        transition();
        return;
      }
      if (!isMobile) {
        transition();
        return;
      }
      close();
      transition();
    },
    [close, isMobile, isOpen],
  );

  /** 초대 카드에서 둘러보기를 시작한다. PC에서는 채팅도 함께 연다. */
  const startGuidedTourFromInvite = useCallback(() => {
    startGuidedTour();
    if (!isMobile) open();
  }, [isMobile, open, startGuidedTour]);

  /** 온보딩에서 둘러보기를 시작한다. */
  const startGuidedTourFromChat = useCallback(() => {
    runTourTransition(startGuidedTour);
  }, [runTourTransition, startGuidedTour]);

  /**
   * 둘러보기를 마치고 설정·WebMCP 안내를 보여 준다.
   * 안내를 읽는 것이 목적이라 입력창에 포커스를 주지 않고 연다.
   */
  const showSettingsGuideAfterTour = useCallback(() => {
    setActiveQuickDestination(null);
    stopGuidedTour();
    showSettingsWebMcpGuide();
    open({ focusInput: false });
  }, [open, showSettingsWebMcpGuide, stopGuidedTour]);

  /** 온보딩에서 설정·WebMCP 안내를 바로 보여 준다. */
  const showSettingsGuideFromOnboarding = useCallback(() => {
    setActiveQuickDestination(null);
    showSettingsWebMcpGuide();
  }, [showSettingsWebMcpGuide]);

  /** 둘러보기 카드의 질문하기 버튼으로 채팅을 열고 닫는다. */
  const toggleChatFromGuidedTour = useCallback(() => {
    if (isOpen) close();
    else open();
  }, [close, isOpen, open]);

  /** 둘러보기를 처음부터 다시 시작한다. */
  const restartGuidedTour = useCallback(() => {
    runTourTransition(startGuidedTour);
  }, [runTourTransition, startGuidedTour]);

  /** 둘러보기의 다음 장소로 넘어간다. */
  const nextGuidedTourStep = useCallback(() => {
    runTourTransition(advanceGuidedTour);
  }, [advanceGuidedTour, runTourTransition]);

  /** 둘러보기의 이전 장소로 돌아간다. */
  const previousTourStep = useCallback(() => {
    runTourTransition(previousGuidedTourStep);
  }, [previousGuidedTourStep, runTourTransition]);

  /** 질문 체험을 건너뛰고 다음 장소로 넘어간다. */
  const skipTourInteraction = useCallback(() => {
    runTourTransition(skipGuidedTourInteraction);
  }, [runTourTransition, skipGuidedTourInteraction]);
  /** 사용자가 한 번이라도 질문했는지다. 오프라인 안내의 무게를 가른다. */
  const hasConversation = useMemo(
    () => messages.some((message) => message.role === "user"),
    [messages],
  );
  /**
   * 대화가 시작된 뒤에는 오프라인이어도 화면 전체를 안내로 갈아끼우지 않는다.
   * 상단 배너로 알리고 입력창은 그대로 두어 검색 기반 답변을 계속 받게 한다.
   */
  const showOfflineScreen = availability === "offline" && !hasConversation;
  const showOfflineBanner = availability === "offline" && hasConversation;
  const composerVisible = availability === "online" || showOfflineBanner;
  /** 마지막 답변이 실패한 경우에만 그 말풍선에서 재시도를 노출한다. */
  const retryTargetMessageId = useMemo(() => {
    const latestMessage = messages[messages.length - 1];
    return latestMessage?.role === "assistant" &&
      latestMessage.generationState === "failed"
      ? latestMessage.id
      : null;
  }, [messages]);
  /**
   * 마지막 답변이 검색 결과 기반이었는지다.
   * 인사말은 건너뛰고 뒤에서부터 처음 만나는 답변으로 판단한다. 입력창 아래
   * 안내 문구를 그 답변의 성격에 맞게 바꾸는 데 쓴다.
   */
  const lastAnswerIsFallback = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role !== "assistant" || message.kind === "greeting") continue;
      return message.kind === "retrieval_fallback";
    }
    return false;
  }, [messages]);
  /** 스트리밍 말풍선이 자란 길이다. 새 delta가 도착했는지 판단하는 신호로 쓴다. */
  const lastMessageLength =
    messages[messages.length - 1]?.content.length ?? 0;
  /** 스트리밍 말풍선이 자란 길이다. 새 delta가 도착했는지 판단하는 신호로 쓴다. */
  const streamingContentLength = useMemo(() => {
    const latestMessage = messages[messages.length - 1];
    return latestMessage?.generationState === "streaming"
      ? latestMessage.content.length
      : 0;
  }, [messages]);
  const [slowResponse, setSlowResponse] = useState(false);

  // 새 텍스트가 도착할 때마다 안내를 되돌리고 12초 타이머를 다시 건다.
  useEffect(() => {
    const reset = window.setTimeout(() => setSlowResponse(false), 0);
    if (!isLoading) return () => window.clearTimeout(reset);
    const notice = window.setTimeout(
      () => setSlowResponse(true),
      SLOW_RESPONSE_NOTICE_MS,
    );
    return () => {
      window.clearTimeout(reset);
      window.clearTimeout(notice);
    };
  }, [isLoading, streamingContentLength]);

  /**
   * 추천 질문을 보여 줄 말풍선의 id다.
   * 완료된 마지막 답변에만 붙인다. 응답 중이거나 이전 답변에 붙으면 대화가
   * 여러 갈래로 갈라진 것처럼 보인다.
   */
  const latestSuggestionMessageId = useMemo(() => {
    if (isLoading) return null;
    const latestMessage = messages[messages.length - 1];
    return latestMessage?.role === "assistant" &&
      latestMessage.generationState === "complete" &&
      latestMessage.suggestedQuestions?.length
      ? latestMessage.id
      : null;
  }, [isLoading, messages]);
  /** 보완 액션(짝이 되는 목적지)을 덧붙일 마지막 답변의 id다. */
  const latestActionMessageId = useMemo(() => {
    if (isLoading) return null;
    const latestMessage = messages[messages.length - 1];
    return latestMessage?.role === "assistant" &&
      latestMessage.generationState === "complete"
      ? latestMessage.id
      : null;
  }, [isLoading, messages]);
  /**
   * 아직 눌러 보지 않은 추천 질문만 남긴다.
   * 표기만 다른 같은 질문도 하나로 보고 중복을 걸러, 같은 질문이 계속 다시
   * 제안되지 않게 한다.
   */
  const visibleSuggestedQuestions = useMemo(() => {
    if (!latestSuggestionMessageId) return [];

    const latestMessage = messages.find(
      (message) => message.id === latestSuggestionMessageId,
    );
    const uniqueKeys = new Set<string>();

    return (latestMessage?.suggestedQuestions ?? []).filter((question) => {
      const key = suggestedQuestionKey(question);
      if (
        !key ||
        usedSuggestedQuestionKeys.has(key) ||
        uniqueKeys.has(key)
      ) {
        return false;
      }
      uniqueKeys.add(key);
      return true;
    });
  }, [latestSuggestionMessageId, messages, usedSuggestedQuestionKeys]);

  /**
   * 빠른 시작을 실행한다. 질문 전송과 콘텐츠 이동을 함께 시작한다.
   *
   * 이동은 다음 프레임으로 미룬다. 같은 프레임에 라우팅까지 밀어 넣으면
   * 방금 추가한 사용자 말풍선이 그려지기 전에 화면이 흔들리기 때문이다.
   */
  const startQuickAction = useCallback(
    (prompt: string, actionId: ActionId, audienceOverride: AudienceChoice) => {
      setActiveQuickDestination(actionId);
      void sendMessage(prompt, audienceOverride);
      window.requestAnimationFrame(() => navigateAction(actionId));
    },
    [navigateAction, sendMessage],
  );

  /** 온보딩에서 관점을 고르면 저장하고 그 관점의 첫 질문을 바로 보낸다. */
  const chooseAudience = useCallback(
    (choice: AudienceChoice, prompt: string) => {
      selectAudience(choice);
      void sendMessage(prompt, choice);
    },
    [selectAudience, sendMessage],
  );

  /** 연결 상태를 다시 확인한다(오프라인 안내의 "다시 확인"). */
  const checkAvailabilityAgain = useCallback(() => {
    void refreshAvailability();
  }, [refreshAvailability]);

  /**
   * 답변 아래 액션 버튼을 눌렀을 때의 동작이다.
   *
   * 빠른 시작 목적지면 온보딩과 똑같이 질문 전송과 이동을 함께 시작하고,
   * 그 밖의 액션은 이동만 한다. 이동만 하는 경우에는 현재 목적지 표시를
   * 비워 다음 답변에서 액션이 다시 노출되게 한다.
   */
  const activateResponseAction = useCallback(
    (actionId: ActionId) => {
      const quickStartOption = CHAT_QUICK_START_OPTION_BY_ACTION_ID.get(actionId);
      if (quickStartOption) {
        startQuickAction(
          quickStartOption.prompt,
          quickStartOption.actionId,
          quickStartOption.audience,
        );
        return;
      }
      setActiveQuickDestination(null);
      navigateAction(actionId);
    },
    [navigateAction, startQuickAction],
  );

  // 지금 위치가 빠른 시작 목적지 중 하나인지 경로와 해시로 계속 맞춘다.
  // 해시만 바뀌는 이동은 라우터가 알려 주지 않아 hashchange도 함께 듣는다.
  useEffect(() => {
    const syncQuickDestination = () => {
      setActiveQuickDestination(
        quickDestinationFromLocation(pathname, window.location.hash),
      );
    };
    syncQuickDestination();
    window.addEventListener("hashchange", syncQuickDestination);
    return () =>
      window.removeEventListener("hashchange", syncQuickDestination);
  }, [pathname]);

  /**
   * 추천 질문을 눌러 그대로 보낸다.
   * 같은 질문이 다시 제안되지 않도록 사용한 질문의 키를 기록해 둔다.
   */
  const askSuggestedQuestion = useCallback(
    (question: string) => {
      const key = suggestedQuestionKey(question);
      if (key) {
        setUsedSuggestedQuestionKeys((current) => {
          const next = new Set(current);
          next.add(key);
          return next;
        });
      }
      void sendMessage(question);
    },
    [sendMessage],
  );

  /** 실패한 답변을 다시 시도한다. */
  const handleRetry = useCallback(() => {
    void retry();
  }, [retry]);

  // 패널 배치 상태를 문서 루트의 data 속성으로 알린다. 본문 레이아웃(고정
  // 패널만큼 좁아지기 등)이 이 신호를 보고 스스로 자리를 내준다.
  useEffect(() => {
    const root = document.documentElement;

    if (
      isDocked &&
      ((isOpen && !isClosing) || guidedTourExternal)
    ) {
      root.dataset.chatDockOpen = "true";
    } else {
      delete root.dataset.chatDockOpen;
    }

    if (
      !isDocked &&
      isWideDesktop &&
      ((isOpen && !isClosing) || guidedTourExternal)
    ) {
      root.dataset.chatFloatingOpen = "true";
    } else {
      delete root.dataset.chatFloatingOpen;
    }

    if (mobileTourDocked) {
      root.dataset.guidedTourDockOpen = "true";
    } else {
      delete root.dataset.guidedTourDockOpen;
    }

    return () => {
      delete root.dataset.chatDockOpen;
      delete root.dataset.chatFloatingOpen;
      delete root.dataset.guidedTourDockOpen;
    };
  }, [
    guidedTourExternal,
    isClosing,
    isDocked,
    isOpen,
    isWideDesktop,
    mobileTourDocked,
  ]);

  /** 빠른 메뉴 퇴장 타이머를 정리한다. */
  const clearQuickMenuCloseTimer = useCallback(() => {
    window.clearTimeout(quickMenuCloseTimerRef.current);
    quickMenuCloseTimerRef.current = 0;
  }, []);

  /** 빠른 메뉴를 연출 없이 즉시 닫는다(다른 화면으로 넘어갈 때 쓴다). */
  const dismissQuickMenuImmediately = useCallback(() => {
    clearQuickMenuCloseTimer();
    setQuickMenuOpen(false);
    setQuickMenuClosing(false);
  }, [clearQuickMenuCloseTimer]);

  /** 빠른 메뉴를 연다. 닫히는 중이었다면 그 연출을 취소한다. */
  const openQuickMenu = useCallback(() => {
    clearQuickMenuCloseTimer();
    setQuickMenuClosing(false);
    setQuickMenuOpen(true);
  }, [clearQuickMenuCloseTimer]);

  /**
   * 빠른 메뉴를 닫는다.
   * 모션이 억제된 환경에서는 즉시 지우고, 그렇지 않으면 퇴장 연출이 끝날
   * 때까지 DOM을 남겼다가 타이머로 정리한다.
   */
  const closeQuickMenu = useCallback(() => {
    if (!quickMenuOpen) return;

    setQuickMenuOpen(false);
    clearQuickMenuCloseTimer();
    const reduceMotion =
      fabAnim === "none" ||
      motion === "off" ||
      (motion === "system" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (reduceMotion) {
      setQuickMenuClosing(false);
      return;
    }

    setQuickMenuClosing(true);
    quickMenuCloseTimerRef.current = window.setTimeout(() => {
      setQuickMenuClosing(false);
      quickMenuCloseTimerRef.current = 0;
    }, QUICK_MENU_EXIT_DURATION_MS);
  }, [clearQuickMenuCloseTimer, fabAnim, motion, quickMenuOpen]);

  // 언마운트 시 빠른 메뉴 퇴장 타이머를 정리한다.
  useEffect(
    () => () => {
      clearQuickMenuCloseTimer();
    },
    [clearQuickMenuCloseTimer],
  );

  // 빠른 메뉴가 열려 있는 동안 바깥 클릭과 Escape로 닫는다. Escape로 닫으면
  // 포커스를 버튼으로 돌려 키보드 흐름이 끊기지 않게 한다.
  useEffect(() => {
    if (!quickMenuExpanded) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeQuickMenu();
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeQuickMenu();
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeQuickMenu, quickMenuExpanded]);

  /** 예약된 바닥 고정 스크롤(프레임·타이머)을 모두 취소한다. */
  const cancelPinnedScroll = useCallback(() => {
    window.cancelAnimationFrame(firstPinFrameRef.current);
    window.cancelAnimationFrame(secondPinFrameRef.current);
    window.clearTimeout(pinSettleTimerRef.current);
    firstPinFrameRef.current = 0;
    secondPinFrameRef.current = 0;
    pinSettleTimerRef.current = 0;
  }, []);

  /**
   * 대화 목록이 바닥 근처인지 본다.
   * 목록이 아직 없으면 true로 본다. 첫 렌더에서 고정을 풀어 버리면 인사말부터
   * 스크롤이 어긋나기 때문이다.
   */
  const isMessageListNearBottom = useCallback(() => {
    const list = messageListRef.current;
    if (!list) return true;
    const distance = list.scrollHeight - list.scrollTop - list.clientHeight;
    return distance <= BOTTOM_PIN_THRESHOLD_PX;
  }, []);

  /**
   * 목록을 바닥에 붙인다. 한 번이 아니라 여러 프레임에 걸쳐 맞춘다.
   *
   * 답변이 자라고 마크다운이 그려지고 키보드가 접히는 일이 서로 다른 프레임에
   * 일어나서, 한 번만 맞추면 곧바로 어긋난다. 연속 두 프레임과 키보드 안정
   * 지연 뒤 한 번 더 맞춰 그 흔들림을 흡수한다.
   * 사용자가 위로 올려 둔 상태(고정 해제)면 아무 일도 하지 않는다.
   */
  const schedulePinnedScroll = useCallback(() => {
    cancelPinnedScroll();
    if (!isOpen || isClosing || !isBottomPinnedRef.current) return;

    const align = () => {
      const list = messageListRef.current;
      if (!list || !isBottomPinnedRef.current) return;
      list.scrollTop = list.scrollHeight;
    };
    const alignAcrossFrames = () => {
      align();
      firstPinFrameRef.current = window.requestAnimationFrame(() => {
        align();
        secondPinFrameRef.current = window.requestAnimationFrame(align);
      });
    };

    alignAcrossFrames();
    pinSettleTimerRef.current = window.setTimeout(
      alignAcrossFrames,
      KEYBOARD_SETTLE_DELAY_MS,
    );
  }, [cancelPinnedScroll, isClosing, isOpen]);

  /**
   * 목록 스크롤을 보고 바닥 고정 여부를 갱신한다.
   * 키보드 전환처럼 우리가 일으킨 스크롤 동안에는(보존 기간) 판단을 미룬다.
   * 그 사이의 좌표로 판단하면 사용자가 올린 것으로 잘못 읽는다.
   */
  const handleMessageScroll = useCallback(() => {
    if (
      isBottomPinnedRef.current &&
      Date.now() < preservePinUntilRef.current
    ) {
      return;
    }
    isBottomPinnedRef.current = isMessageListNearBottom();
    if (!isBottomPinnedRef.current) cancelPinnedScroll();
  }, [cancelPinnedScroll, isMessageListNearBottom]);

  /** 입력창에 포커스가 들어올 때, 키보드가 올라오기 전의 위치를 보존한다. */
  const handleInputFocus = useCallback(() => {
    // 키보드가 viewport를 줄이기 전에 사용자가 하단을 보고 있었는지 먼저 보존한다.
    isBottomPinnedRef.current = isMessageListNearBottom();
    if (isBottomPinnedRef.current) {
      preservePinUntilRef.current = Date.now() + 500;
      schedulePinnedScroll();
    }
  }, [isMessageListNearBottom, schedulePinnedScroll]);

  /**
   * 손가락·휠로 사용자가 직접 스크롤하면 고정 보존을 즉시 해제한다.
   * 사용자가 위를 읽고 있는데 자동 스크롤이 끌어내리는 일을 막는다.
   */
  const handleUserScrollIntent = useCallback(() => {
    preservePinUntilRef.current = 0;
    cancelPinnedScroll();
  }, [cancelPinnedScroll]);

  /** 키보드가 접히며 늘어난 영역만큼 다시 바닥으로 맞춘다. */
  const handleInputBlur = useCallback(() => {
    if (!isBottomPinnedRef.current) return;
    preservePinUntilRef.current = Date.now() + 500;
    schedulePinnedScroll();
  }, [schedulePinnedScroll]);

  /** 응답 중 패널 안에 포커스가 있었는지 기록한다(응답 후 복원 판단용). */
  const handlePanelFocusCapture = useCallback(() => {
    if (isLoading) focusWasInsidePanelDuringLoadingRef.current = true;
  }, [isLoading]);

  /**
   * 포커스가 패널 밖으로 나가면 복원 대상에서 제외한다.
   * 사용자가 다른 곳을 보러 나갔다면 응답이 끝났다고 끌어오지 않는다.
   */
  const handlePanelBlurCapture = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      if (!isLoading) return;
      const nextTarget = event.relatedTarget;
      if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
        focusWasInsidePanelDuringLoadingRef.current = false;
      }
    },
    [isLoading],
  );

  // 응답이 끝나면 입력창으로 포커스를 되돌린다. 다만 응답 중에 사용자가
  // 패널 밖으로 나갔다면 끌어오지 않는다. 읽던 자리를 뺏는 셈이 된다.
  useEffect(() => {
    const wasLoading = wasLoadingRef.current;
    const panel = panelRef.current;
    const activeElement = document.activeElement;

    if (!wasLoading && isLoading) {
      focusWasInsidePanelDuringLoadingRef.current = Boolean(
        panel && activeElement instanceof Node && panel.contains(activeElement),
      );
    }

    if (wasLoading && !isLoading) {
      const shouldRestoreInputFocus = Boolean(
        panel &&
          (focusWasInsidePanelDuringLoadingRef.current ||
            (activeElement instanceof Node && panel.contains(activeElement))),
      );
      focusWasInsidePanelDuringLoadingRef.current = false;

      if (
        shouldRestoreInputFocus &&
        isOpen &&
        !isClosing &&
        availability === "online"
      ) {
        window.requestAnimationFrame(() => {
          const currentPanel = panelRef.current;
          const currentInput = inputRef.current;
          const currentActiveElement = document.activeElement;
          const focusStayedInPanel = Boolean(
            currentPanel &&
              currentActiveElement instanceof Node &&
              currentPanel.contains(currentActiveElement),
          );
          const focusWasReleasedWithControl =
            currentActiveElement === document.body ||
            currentActiveElement === document.documentElement;

          if (currentInput && (focusStayedInPanel || focusWasReleasedWithControl)) {
            currentInput.focus({ preventScroll: true });
          }
        });
      }
    }

    wasLoadingRef.current = isLoading;
  }, [availability, isClosing, isLoading, isOpen]);

  // 도구가 화면을 옮긴 뒤 보내는 복원 신호를 받아 입력창을 다시 잡는다.
  useEffect(() => {
    const restoreChatInputFocus = () => {
      if (!isOpen || isClosing || availability !== "online") return;
      window.requestAnimationFrame(() => {
        inputRef.current?.focus({ preventScroll: true });
      });
    };
    window.addEventListener(
      CHAT_ACTION_RESTORE_CHAT_INPUT_EVENT,
      restoreChatInputFocus,
    );
    return () => {
      window.removeEventListener(
        CHAT_ACTION_RESTORE_CHAT_INPUT_EVENT,
        restoreChatInputFocus,
      );
    };
  }, [availability, isClosing, isOpen]);

  // 새 답변·오류가 생기거나 패널이 열릴 때 목록을 바닥에 붙인다.
  useLayoutEffect(() => {
    const justOpened = isOpen && !wasOpenForScrollRef.current;
    if (justOpened) isBottomPinnedRef.current = true;
    if (isOpen && isBottomPinnedRef.current) schedulePinnedScroll();
    wasOpenForScrollRef.current = isOpen;
    // 배열 자체가 아니라 길이와 마지막 말풍선의 길이만 본다. delta마다 새
    // 배열이 오지만 스크롤이 필요한 변화는 이 둘로 충분히 잡힌다.
  }, [
    error,
    isLoading,
    isOpen,
    messages.length,
    lastMessageLength,
    schedulePinnedScroll,
  ]);

  // 패널 안에 둘러보기 카드가 붙으면 그 카드가 보이도록 목록을 내린다.
  useEffect(() => {
    if (!guidedTourInternal || !isOpen || isClosing) return;

    const reduceMotion =
      motion === "off" ||
      (motion === "system" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    isBottomPinnedRef.current = true;
    preservePinUntilRef.current = Date.now() + 700;
    const frame = window.requestAnimationFrame(() => {
      const list = messageListRef.current;
      list?.scrollTo({
        top: list.scrollHeight,
        behavior: reduceMotion ? "auto" : "smooth",
      });
    });
    const settleTimer = window.setTimeout(() => {
      const list = messageListRef.current;
      if (list) list.scrollTop = list.scrollHeight;
    }, 480);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
    };
  }, [guidedTourInternal, isClosing, isOpen, motion]);

  // 패널 밖 카드가 붙어 패널이 줄어드는 동안, 줄어드는 속도에 맞춰 목록을
  // 따라 내린다. 한 번에 내리면 레이아웃이 바뀌는 도중이라 어긋난다.
  useEffect(() => {
    if (!guidedTourExternal || !isOpen || isClosing) return;

    const list = messageListRef.current;
    if (!list) return;
    const reduceMotion =
      motion === "off" ||
      (motion === "system" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    isBottomPinnedRef.current = true;
    preservePinUntilRef.current =
      Date.now() + TOUR_LAYOUT_TRANSITION_MS + 200;

    if (reduceMotion) {
      list.scrollTop = list.scrollHeight;
      return;
    }

    const initialScrollTop = list.scrollTop;
    const startedAt = window.performance.now();
    let frame = 0;
    const followShrinkingPanel = (now: number) => {
      const progress = Math.min(
        1,
        (now - startedAt) / TOUR_LAYOUT_TRANSITION_MS,
      );
      const eased = 1 - (1 - progress) ** 3;
      const maxScrollTop = Math.max(
        0,
        list.scrollHeight - list.clientHeight,
      );
      list.scrollTop =
        initialScrollTop + (maxScrollTop - initialScrollTop) * eased;
      if (progress < 1) {
        frame = window.requestAnimationFrame(followShrinkingPanel);
      }
    };
    frame = window.requestAnimationFrame(followShrinkingPanel);
    const settleTimer = window.setTimeout(() => {
      list.scrollTop = list.scrollHeight;
    }, TOUR_LAYOUT_TRANSITION_MS + 80);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
    };
  }, [guidedTourExternal, isClosing, isOpen, motion]);

  // 모바일에서 키보드가 오르내려 뷰포트가 바뀌어도 바닥 고정을 유지한다.
  useEffect(() => {
    if (!isMobile || !isOpen || isClosing) return;

    const keepPinnedDuringViewportChange = () => {
      if (!isBottomPinnedRef.current) return;
      preservePinUntilRef.current = Date.now() + 320;
      schedulePinnedScroll();
    };
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", keepPinnedDuringViewportChange);
    viewport?.addEventListener("scroll", keepPinnedDuringViewportChange);
    window.addEventListener("resize", keepPinnedDuringViewportChange);
    window.addEventListener(
      "orientationchange",
      keepPinnedDuringViewportChange,
    );

    return () => {
      viewport?.removeEventListener("resize", keepPinnedDuringViewportChange);
      viewport?.removeEventListener("scroll", keepPinnedDuringViewportChange);
      window.removeEventListener("resize", keepPinnedDuringViewportChange);
      window.removeEventListener(
        "orientationchange",
        keepPinnedDuringViewportChange,
      );
      cancelPinnedScroll();
    };
  }, [cancelPinnedScroll, isClosing, isMobile, isOpen, schedulePinnedScroll]);

  // 닫히기 시작하면 입력창 포커스를 놓아 모바일 키보드가 먼저 내려가게 한다.
  useEffect(() => {
    if (isClosing) inputRef.current?.blur();
  }, [isClosing]);

  // 열면 입력창으로, 닫으면 플로팅 버튼으로 포커스를 옮긴다. 모바일에서는
  // 요청한 경우에만 입력창을 잡는다. 여는 즉시 키보드가 올라오면 패널이 가려진다.
  useEffect(() => {
    if (
      isOpen &&
      !isClosing &&
      availability === "online" &&
      (!isMobile || focusInputOnOpen)
    ) {
      window.requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!isOpen && wasOpenRef.current) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
    wasOpenRef.current = isOpen;
  }, [availability, focusInputOnOpen, isClosing, isMobile, isOpen]);

  // 연출 옵션은 PC 패널에만 적용하고, 모바일은 기존 미디어쿼리 동작을 그대로 둔다.
  // 젤리 엔진은 지연 로딩이라, 불러오지 못하면 젤리 표현을 포기하고 평범한
  // 패널로 되돌린다(젤리 클래스만 남으면 내용이 투명한 채로 굳는다).
  const isJelly =
    !isMobile &&
    !isDocked &&
    effectiveChatAnimation === "jelly" &&
    !jellyUnavailable;
  const isSlide =
    !isMobile && !isDocked && effectiveChatAnimation === "slide";
  // 텍스트 연출은 모바일에도 적용하되, 스트리밍이 꺼져 있으면 재생할 대상이 없다.
  const streamAnimation = streamingEnabled ? effectiveStreamAnimation : "none";
  const revealCompletionControls = streamAnimation !== "none";

  // 젤리 연출을 시작한다. 고정 패널에서 플로팅으로 막 바뀐 경우에는 위치
  // 전환 애니메이션을 한 프레임 끄고 시작해 패널이 화면을 가로지르지 않게 한다.
  useLayoutEffect(() => {
    const transitionedFromDock = wasDockedRef.current && !isDocked && isOpen;
    wasDockedRef.current = isDocked;
    if (!isOpen || !isJelly) return;

    const panel = panelRef.current;
    const trigger = triggerRef.current ?? externalTourChatButtonRef.current;
    if (!panel || !trigger) return;

    let layoutTransitionResetFrame = 0;
    if (transitionedFromDock) {
      panel.style.transition = "none";
      void panel.offsetHeight;
      layoutTransitionResetFrame = window.requestAnimationFrame(() =>
        panel.style.removeProperty("transition"),
      );
    }

    // 젤리 엔진은 캔버스 물리 계산이라 무겁고 이 연출에서만 쓴다. 첫 화면
    // 번들에 싣지 않고 패널이 실제로 열릴 때 불러온다.
    let cancelled = false;
    let engine: ElasticJellyPanel | null = null;
    void import("../../lib/ElasticJellyPanel")
      .then(({ default: JellyPanel }) => {
        if (cancelled) return;
        try {
          engine = new JellyPanel(trigger, panel, {
            onSurfaceReadyChange: setJellySurfaceReady,
          });
          jellyRef.current = engine;
          engine.open({ animate: !transitionedFromDock });
        } catch (initError) {
          console.error("젤리 패널 애니메이션을 시작하지 못했습니다.", initError);
          engine?.destroy();
          engine = null;
          jellyRef.current = null;
          setJellyUnavailable(true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        console.error(
          "젤리 패널 애니메이션 모듈을 불러오지 못했습니다.",
          loadError,
        );
        setJellyUnavailable(true);
      });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(layoutTransitionResetFrame);
      panel.style.removeProperty("transition");
      engine?.destroy();
      jellyRef.current = null;
      // 엔진이 수축을 마치기 전에 정리되면 FAB에 남는 인라인 레이어 값을 되돌린다.
      trigger.style.zIndex = "";
    };
  }, [isDocked, isJelly, isOpen]);

  // 닫기가 시작되면 젤리 엔진에 수축을 지시한다.
  useEffect(() => {
    if (!isClosing) return;
    const engine = jellyRef.current;
    if (!engine) return;

    // 수축이 재생되는 동안 패널은 화면에 남지만 조작은 받지 않게 한다.
    engine.panel.style.pointerEvents = "none";
    const collapseTarget = guidedTourExternal
      ? externalTourChatButtonRef.current
      : triggerRef.current;
    engine.close(collapseTarget ?? undefined);
  }, [guidedTourExternal, isClosing]);

  /**
   * 입력창의 질문을 보낸다.
   * 공백만 있거나 응답 중이거나 온라인이 아니면 보내지 않는다. 입력값은 전송
   * 직전에 비워, 답변을 기다리는 동안 같은 질문을 다시 보내지 않게 한다.
   */
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || isLoading || availability !== "online") return;
    resetInputHistoryNavigation("");
    setDraft("");
    await sendMessage(message);
  };

  /**
   * 입력창 키 입력을 해석한다.
   * 히스토리 탐색(위·아래)이 먼저 처리하고, 남은 Enter는 전송으로 본다.
   * Shift+Enter는 줄바꿈이다.
   */
  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (handleHistoryKeyDown(event)) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  /**
   * 패널 전체의 키 입력을 처리한다.
   *
   * PC에서 Escape는 닫기다. 모바일에서는 패널이 화면을 덮는 모달이라 Tab이
   * 패널 밖으로 나가지 않도록 첫·마지막 요소를 이어 붙인다.
   */
  const handleDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && !isMobile) {
      event.preventDefault();
      close();
      return;
    }

    if (event.key !== "Tab" || !isMobile || !panelRef.current) return;
    const focusable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  /** 고정 패널 너비 조절을 시작한다. 마우스는 왼쪽 버튼만 받는다. */
  const handleDockResizePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    document.documentElement.dataset.chatDockResizing = "true";
  };

  /** 드래그하는 동안 화면 오른쪽 끝과의 거리로 패널 너비를 정한다. */
  const handleDockResizePointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setChatDockWidth(window.innerWidth - event.clientX);
  };

  /** 너비 조절을 끝내고 포인터 캡처와 조절 중 표시를 거둔다. */
  const finishDockResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    delete document.documentElement.dataset.chatDockResizing;
  };

  /**
   * 키보드로 고정 패널 너비를 조절한다.
   * 좌우 화살표로 조금씩(Shift는 크게), Home·End로 최소·최대까지 간다.
   * 마우스를 쓰지 않는 사용자도 같은 조절을 할 수 있게 하는 장치다.
   */
  const handleDockResizeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 40 : 12;
    let nextWidth: number | null = null;

    if (event.key === "ArrowLeft") nextWidth = chatDockWidth + step;
    if (event.key === "ArrowRight") nextWidth = chatDockWidth - step;
    if (event.key === "Home") nextWidth = CHAT_DOCK_MIN_WIDTH;
    if (event.key === "End") nextWidth = CHAT_DOCK_MAX_WIDTH;
    if (nextWidth === null) return;

    event.preventDefault();
    setChatDockWidth(nextWidth);
  };

  const backdropClassName = `${styles.backdrop} ${
    isClosing ? styles.backdropClosing : ""
  }`;
  const panelClassName = [
    styles.panel,
    isClosing ? styles.panelClosing : "",
    isDocked ? styles.panelDocked : "",
    guidedTourExternal && isOpen ? styles.panelTourExternal : "",
    isSlide ? styles.panelSlide : "",
    isJelly ? styles.panelJelly : "",
    isJelly && jellySurfaceReady ? styles.panelJellySettled : "",
  ]
    .filter(Boolean)
    .join(" ");
  const contentWrapperClassName = `${styles.contentWrapper}${
    isJelly ? ` ${JELLY_CONTENT_CLASS}` : ""
  }`;
  const rootClassName = `${styles.root} ${isOpen ? styles.rootOpen : ""}`;
  const nextThemeMode = mode === "light" ? "dark" : "light";
  const modeLabel = {
    system: "시스템",
    light: "라이트",
    dark: "다크",
  }[mode];
  const nextModeLabel = {
    system: "시스템",
    light: "라이트",
    dark: "다크",
  }[nextThemeMode];

  /** 빠른 메뉴에서 채팅을 연다. 메뉴는 연출 없이 즉시 닫는다. */
  const openChatFromQuickMenu = () => {
    dismissQuickMenuImmediately();
    open();
  };

  /** 빠른 메뉴에서 라이트·다크를 전환하고 포커스를 버튼으로 되돌린다. */
  const cycleThemeMode = () => {
    setMode(nextThemeMode);
    closeQuickMenu();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  /**
   * 플로팅 버튼을 눌렀을 때의 동작이다.
   * 빠른 메뉴 모드면 메뉴를 열고 닫고, 채팅 모드면 패널을 열고 닫는다.
   */
  const handleTriggerClick = () => {
    if (triggerControlsQuickMenu) {
      if (quickMenuExpanded) {
        closeQuickMenu();
      } else {
        openQuickMenu();
      }
      return;
    }
    if (isOpen) {
      close();
      return;
    }
    dismissQuickMenuImmediately();
    open();
  };

  return (
    <div ref={rootRef} className={rootClassName} style={visualViewportStyle}>
      {isOpen && (
        <>
          <button
            className={backdropClassName}
            type="button"
            aria-label="채팅 닫기"
            onClick={close}
          />
          <section
            id="portfolio-chat-dialog"
            ref={panelRef}
            className={panelClassName}
            role="dialog"
            aria-modal={isMobile}
            aria-labelledby="portfolio-chat-title"
            onKeyDown={handleDialogKeyDown}
            onFocusCapture={handlePanelFocusCapture}
            onBlurCapture={handlePanelBlurCapture}
            onAnimationEnd={(event) => {
              if (isClosing && event.target === event.currentTarget) {
                completeCloseAnimation();
              }
            }}
          >
            {isDocked && (
              <div
                className={styles.dockResizeHandle}
                role="separator"
                aria-label="채팅 고정 패널 너비 조절"
                aria-orientation="vertical"
                aria-valuemin={CHAT_DOCK_MIN_WIDTH}
                aria-valuemax={CHAT_DOCK_MAX_WIDTH}
                aria-valuenow={chatDockWidth}
                tabIndex={0}
                title="좌우로 드래그해 너비 조절 · 두 번 클릭해 기본값 복원"
                onPointerDown={handleDockResizePointerDown}
                onPointerMove={handleDockResizePointerMove}
                onPointerUp={finishDockResize}
                onPointerCancel={finishDockResize}
                onLostPointerCapture={() => {
                  delete document.documentElement.dataset.chatDockResizing;
                }}
                onDoubleClick={() =>
                  setChatDockWidth(CHAT_DOCK_DEFAULT_WIDTH)
                }
                onKeyDown={handleDockResizeKeyDown}
              />
            )}
            {/* 젤리 캔버스가 패널 밖까지 그려지도록 콘텐츠 클리핑은 이 래퍼가 맡는다. */}
            <div className={contentWrapperClassName}>
              <header className={styles.header}>
                <div>
                  <span className={styles.eyebrow}>PORTFOLIO AI</span>
                  <h2 id="portfolio-chat-title">포트폴리오 챗봇</h2>
                </div>
                <div className={styles.headerControls}>
                  {availability === "online" && (
                    <label>
                      <span className={styles.visuallyHidden}>말투 선택</span>
                      <select
                        value={tone}
                        onChange={(event) =>
                          selectTone(
                            event.currentTarget.value as
                              | "official"
                              | "manager"
                              | "mascot",
                          )
                        }
                        aria-label="챗봇 말투"
                      >
                        {TONE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button
                    className={styles.resetConversation}
                    type="button"
                    disabled={
                      messages.length === 1 &&
                      messages[0]?.kind === "greeting" &&
                      audience === null &&
                      error === null
                    }
                    onClick={() => {
                      resetInputHistoryNavigation("");
                      setDraft("");
                      setUsedSuggestedQuestionKeys(new Set());
                      resetConversation();
                    }}
                    aria-label="새 대화 시작"
                    title="새 대화 시작"
                  >
                    ↻
                  </button>
                  <button
                    className={styles.close}
                    type="button"
                    onClick={close}
                    aria-label="채팅 닫기"
                  >
                    ×
                  </button>
                </div>
              </header>

              <div
                ref={messageListRef}
                className={styles.body}
                aria-live="polite"
                aria-busy={isLoading || availability === "checking"}
                onScroll={handleMessageScroll}
                onTouchStart={handleUserScrollIntent}
                onWheel={handleUserScrollIntent}
              >
                {availability === "idle" || availability === "checking" ? (
                  <ChatAvailabilityCheckingScreen />
                ) : showOfflineScreen ? (
                  <ChatOfflineScreen onRetry={checkAvailabilityAgain} />
                ) : (
                  <div className={styles.messages}>
                  {showOfflineBanner && (
                    <ChatOfflineBanner onRetry={checkAvailabilityAgain} />
                  )}
                  {messages.map((message) => (
                    <Fragment key={message.id}>
                      <MessageItem
                        message={message}
                        activeQuickDestination={activeQuickDestination}
                        streamAnimation={streamAnimation}
                        includeComplement={message.id === latestActionMessageId}
                        suggestedQuestions={
                          message.id === latestSuggestionMessageId
                            ? visibleSuggestedQuestions
                            : EMPTY_SUGGESTED_QUESTIONS
                        }
                        revealCompletionControls={revealCompletionControls}
                        slowResponse={slowResponse}
                        canRetry={message.id === retryTargetMessageId}
                        retryWaitSeconds={
                          message.id === retryTargetMessageId
                            ? retryWaitSeconds
                            : 0
                        }
                        onActivateAction={activateResponseAction}
                        onAskSuggestedQuestion={askSuggestedQuestion}
                        onRetry={handleRetry}
                      />
                      {message.kind === "greeting" && showOnboarding && (
                        <ChatOnboarding
                          audience={audience}
                          onStartGuidedTour={startGuidedTourFromChat}
                          onShowSettingsGuide={showSettingsGuideFromOnboarding}
                          onStartQuickAction={startQuickAction}
                          onSelectAudience={chooseAudience}
                        />
                      )}
                    </Fragment>
                  ))}
                  {isLoading && (
                    <p className={styles.loading} role="status">
                      {slowResponse
                        ? "평소보다 오래 걸리고 있어요. 기다리거나 중단할 수 있어요"
                        : "공개 자료에서 답변을 찾고 있어요…"}
                    </p>
                  )}
                  {error && !retryTargetMessageId && (
                    <div className={styles.error} role="alert">
                      <p>{error}</p>
                      <button
                        type="button"
                        disabled={retryWaitSeconds > 0}
                        onClick={handleRetry}
                      >
                        {retryWaitSeconds > 0
                          ? `${retryWaitSeconds}초 후 다시 시도`
                          : "다시 시도"}
                      </button>
                    </div>
                  )}
                  </div>
                )}
                {guidedTourInternal && (
                  <GuidedTourCard
                    state={guidedTour}
                    step={guidedTourStep}
                    placement="panel"
                    animateEntrance
                    aiAvailable={availability === "online"}
                    onPrevious={previousTourStep}
                    onNext={nextGuidedTourStep}
                    onSkip={skipTourInteraction}
                    onStop={stopGuidedTour}
                    onReturnToCurrentStep={returnToGuidedTourStep}
                    onRestart={restartGuidedTour}
                    onShowSettingsGuide={showSettingsGuideAfterTour}
                  />
                )}
              </div>

              {composerVisible && (
                <>
                  {REASONING_QUICK_TOGGLE_ENABLED && (
                    <div
                      className={styles.composerOptions}
                      aria-label="챗봇 응답 옵션"
                    >
                      <button
                        type="button"
                        className={styles.reasoningToggle}
                        aria-pressed={reasoningEnabled}
                        aria-label={`사고모드 ${reasoningEnabled ? "끄기" : "켜기"}`}
                        disabled={isLoading}
                        onClick={() => setReasoningEnabled(!reasoningEnabled)}
                      >
                        <span>사고모드</span>
                        <strong>{reasoningEnabled ? "ON" : "OFF"}</strong>
                      </button>
                      <span className={styles.reasoningHint}>
                        {reasoningEnabled
                          ? "깊이 검토 · 응답이 느릴 수 있음"
                          : "빠른 일반 응답"}
                      </span>
                    </div>
                  )}
                  <form className={styles.composer} onSubmit={submit}>
                    <label
                      className={styles.visuallyHidden}
                      htmlFor="chat-message"
                    >
                      포트폴리오 질문
                    </label>
                    <textarea
                      id="chat-message"
                      ref={inputRef}
                      rows={2}
                      maxLength={2_000}
                      value={draft}
                      onChange={(event) =>
                        changeDraft(event.currentTarget.value)
                      }
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      onKeyDown={handleInputKeyDown}
                      aria-keyshortcuts="ArrowUp ArrowDown"
                      placeholder="경력, 기술, 프로젝트를 질문해 보세요"
                    />
                    {isLoading ? (
                      <button
                        type="button"
                        className={styles.stopButton}
                        onClick={stopGenerating}
                        aria-label="챗봇 응답 생성 중단"
                      >
                        중단
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={draft.trim().length === 0}
                      >
                        전송
                      </button>
                    )}
                  </form>
                  <p className={styles.disclaimer}>
                    {lastAnswerIsFallback ? (
                      <span>
                        이 답변은 공개 문서에서 직접 찾은 내용이에요.
                      </span>
                    ) : (
                      <span>
                        챗봇은 실수할 수 있습니다.
                        <br />
                        중요한 내용은 포트폴리오·공개 연락처로 확인해 주세요.
                      </span>
                    )}
                  </p>
                </>
              )}
            </div>
          </section>
        </>
      )}

      {!isOpen &&
        !isClosing &&
        guidedTourAvailable &&
        guidedTourInviteVisible && (
        <GuidedTourInvite
          onStart={startGuidedTourFromInvite}
          onDismiss={dismissGuidedTourInvite}
        />
      )}

      {guidedTourExternal && (
        <div ref={externalTourRef} className={styles.externalTourHost}>
          <GuidedTourCard
            state={guidedTour}
            step={guidedTourStep}
            placement="external"
            animateEntrance
            externalChatOpen={isOpen}
            externalChatButtonRef={externalTourChatButtonRef}
            aiAvailable={availability === "online"}
            onPrevious={previousTourStep}
            onNext={nextGuidedTourStep}
            onSkip={skipTourInteraction}
            onStop={stopGuidedTour}
            onReturnToCurrentStep={returnToGuidedTourStep}
            onRestart={restartGuidedTour}
            onShowSettingsGuide={showSettingsGuideAfterTour}
            onToggleExternalChat={toggleChatFromGuidedTour}
          />
        </div>
      )}

      {quickMenuRendered && !guidedTourExternal && (
        <nav
          id="portfolio-quick-menu"
          className={styles.quickMenu}
          aria-label="빠른 실행"
          data-fab={quickMenuClosing ? "closing" : "open"}
          data-anim={fabAnim}
        >
          <Link
            href="/settings"
            className={styles.quickMenuAction}
            data-fab-item
            onClick={dismissQuickMenuImmediately}
          >
            <span className={styles.quickMenuIcon} aria-hidden="true">
              ⚙
            </span>
            <span className={styles.quickMenuCopy}>
              <strong>설정</strong>
              <small>사이트 옵션 열기</small>
            </span>
          </Link>
          <a
            href="mailto:sworksong@gmail.com"
            className={styles.quickMenuAction}
            data-fab-item
            onClick={dismissQuickMenuImmediately}
          >
            <span className={styles.quickMenuIcon} aria-hidden="true">
              @
            </span>
            <span className={styles.quickMenuCopy}>
              <strong>메일 보내기</strong>
              <small>sworksong@gmail.com</small>
            </span>
          </a>
          <button
            type="button"
            className={styles.quickMenuAction}
            data-fab-item
            onClick={cycleThemeMode}
            aria-label={`테마 변경: ${modeLabel}에서 ${nextModeLabel} 모드로`}
          >
            <span className={styles.quickMenuIcon} aria-hidden="true">
              ◐
            </span>
            <span className={styles.quickMenuCopy}>
              <strong>테마 변경</strong>
              <small>
                {modeLabel} → {nextModeLabel}
              </small>
            </span>
          </button>
          <button
            type="button"
            className={styles.quickMenuAction}
            data-fab-item
            onClick={openChatFromQuickMenu}
          >
            <span className={styles.quickMenuIcon} aria-hidden="true">
              AI
            </span>
            <span className={styles.quickMenuCopy}>
              <strong>채팅</strong>
              <small>포트폴리오에 질문하기</small>
            </span>
          </button>
        </nav>
      )}

      {!guidedTourExternal && (
        <button
          ref={triggerRef}
          className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ""} ${
            quickMenuExpanded ? styles.triggerMenuOpen : ""
          }`}
          type="button"
          onClick={handleTriggerClick}
          aria-expanded={
            triggerControlsQuickMenu ? quickMenuExpanded : isOpen
          }
          aria-controls={
            triggerControlsQuickMenu
              ? "portfolio-quick-menu"
              : "portfolio-chat-dialog"
          }
          aria-label={
            triggerControlsQuickMenu
              ? quickMenuExpanded
                ? "빠른 메뉴 닫기"
                : "빠른 메뉴 열기"
              : isOpen
                ? "채팅 닫기"
                : "포트폴리오 챗봇 열기"
          }
        >
          <span aria-hidden="true">
            {quickMenuEnabled ? (quickMenuExpanded ? "×" : "•••") : "AI"}
          </span>
          <span>
            {quickMenuEnabled
              ? quickMenuExpanded
                ? "메뉴 닫기"
                : "빠른 메뉴"
              : "질문하기"}
          </span>
        </button>
      )}
    </div>
  );
}
