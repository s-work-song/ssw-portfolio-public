"use client";

/**
 * 색상 모드와 포트폴리오 전용 테마 옵션을 전역에 공급하는 컨텍스트 모듈이다.
 *
 * next-themes에는 light/dark/system 적용을 위임하고, 포인트 컬러·모션 정책·
 * 페이지 전환·플로팅 버튼 모드·채팅 글꼴과 글자 크기·패널 배치와 너비·글로우는
 * 이 Provider가 영속화한다. 소비자는 저장소나 DOM 구현을 몰라도 되는 Provider
 * 패턴이며, ThemeContextType이 읽기/변경 계약을 한곳에 고정한다(DIP).
 *
 * 도구로 바꿀 수 있는 값의 허용 목록은 `features/portfolio-tools/schema`가
 * 단일 소스로 쥐고, 여기서는 타입만 파생해 쓴다.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";
import type {
  PortfolioAccent,
  PortfolioChatFont,
  PortfolioChatFontSize,
  PortfolioChatLayout,
  PortfolioThemeMode,
} from "../features/portfolio-tools/schema";
import {
  ACCENTS,
  CHAT_DOCK_DEFAULT_WIDTH,
  CHAT_FONT_FAMILIES,
  CHAT_FONT_SIZES,
  DEFAULT_ACCENT,
  DEFAULT_CHAT_FONT,
  DEFAULT_CHAT_FONT_SIZE,
  DEFAULT_MOTION,
  MOTION_PREFERENCES,
  THEME_STORAGE_KEY,
  normalizeChatDockWidth,
} from "./accentPalette";
import { themeSettingsDataset } from "./settingsDataset";

/**
 * 테마 토큰 표는 서버 컴포넌트인 `app/layout`도 읽어야 해서 순수 모듈로
 * 내렸다(하이드레이션 전 부트 스크립트가 같은 값을 쓴다). 설정 화면·채팅
 * 패널 같은 기존 소비자가 경로를 바꾸지 않아도 되도록 여기서 다시 내보낸다.
 */
export {
  ACCENTS,
  CHAT_DOCK_DEFAULT_WIDTH,
  CHAT_DOCK_MAX_WIDTH,
  CHAT_DOCK_MIN_WIDTH,
} from "./accentPalette";
export type { AccentPalette } from "./accentPalette";

/**
 * 도구가 바꿀 수 있는 설정값은 `portfolio-tools/schema`의 허용 목록에서
 * 파생한다. 여기서 union을 따로 적으면 도구 스키마와 조용히 어긋난다.
 */
export type Mode = PortfolioThemeMode;
export type Accent = PortfolioAccent;
export type ChatLayout = PortfolioChatLayout;
export type ChatFont = PortfolioChatFont;
export type ChatFontSize = PortfolioChatFontSize;
/** 플로팅 버튼이 채팅을 여는지, 빠른 메뉴를 여는지다. 도구 대상이 아니다. */
export type FabMode = "chat" | "quick-menu";
/** 빠른 메뉴 항목이 나타나는 연출이다. */
export type FabAnim = "none" | "rise" | "slide" | "pop" | "blur";
/** 사이트 연출 정책이다. `system`은 OS의 모션 줄이기 설정을 따른다. */
export type MotionPreference = (typeof MOTION_PREFERENCES)[number];
/** 페이지 전환 연출이다. */
export type PageTransition = "none" | "slide" | "fade" | "lift";

/** 테마 컨텍스트가 소비자에게 노출하는 읽기·변경 계약이다. */
export interface ThemeContextType {
  mode: Mode;
  accent: Accent;
  motion: MotionPreference;
  pageTransition: PageTransition;
  fabMode: FabMode;
  fabAnim: FabAnim;
  chatLayout: ChatLayout;
  chatFont: ChatFont;
  chatFontSize: ChatFontSize;
  chatDockWidth: number;
  glow: boolean;
  setMode: (m: Mode) => void;
  setAccent: (a: Accent) => void;
  setMotion: (m: MotionPreference) => void;
  setPageTransition: (transition: PageTransition) => void;
  setFabMode: (mode: FabMode) => void;
  setFabAnim: (animation: FabAnim) => void;
  setChatLayout: (layout: ChatLayout) => void;
  setChatFont: (font: ChatFont) => void;
  setChatFontSize: (size: ChatFontSize) => void;
  setChatDockWidth: (width: number) => void;
  setGlow: (g: boolean) => void;
  resetTheme: () => void;
}

/** 저장소에서 읽은 값이 실제 포인트 색인지 확인한다. 이 값은 매 요청 백엔드로도 나간다. */
function isAccent(value: unknown): value is Accent {
  return typeof value === "string" && Object.hasOwn(ACCENTS, value);
}

/**
 * 브라우저에서는 useLayoutEffect, 서버에서는 useEffect다.
 *
 * 저장값 복원은 첫 페인트보다 앞서야 한다. useEffect로 복원하면 하이드레이션이
 * 그린 기본값이 한 번 화면에 나갔다가 바뀌어, 설정 화면의 선택 표시처럼 React
 * 상태로만 그리는 UI가 새로고침마다 깜빡인다. useLayoutEffect는 커밋 직후
 * 페인트 전에 돌아 그 틈을 없앤다.
 *
 * 다만 useLayoutEffect는 서버 렌더에서 아무 일도 하지 않아 React가 경고를
 * 낸다. 정적 export는 빌드 때 이 모듈을 Node에서 프리렌더하므로, 그쪽에서는
 * useEffect로 갈아 끼워 경고를 피한다.
 */
export const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * 포트폴리오 전용 테마 옵션을 쥐고 DOM과 저장소에 반영하는 Provider다.
 *
 * next-themes에는 light/dark/system 적용만 맡기고, 포인트 색상·모션 정책·
 * 페이지 전환·플로팅 버튼·채팅 글꼴과 배치는 여기서 관리한다. 저장소에서
 * 읽은 값은 스키마 버전(v)으로 걸러 복원한다. 버전 없는 옛 블롭은 기본값이
 * 달랐던 시절의 자동 저장이라 사용자의 명시적 선택으로 보지 않는다.
 *
 * 첫 렌더는 항상 기본값으로 그린다. 서버가 만든 HTML과 어긋나지 않게 하기
 * 위함이고, 복원은 하이드레이션 직후 첫 페인트 전에 레이아웃 이펙트로 한다.
 *
 * CSS 변수로만 나가는 포인트 색은 그보다도 앞서, `context/accentPalette`의
 * 부트 스크립트가 <head>에서 미리 바른다. 이 Provider의 복원은 React 상태로
 * 그리는 UI(설정 화면의 선택 표시 등)를 위한 것이다.
 */
function CustomThemeProvider({ children }: { children: React.ReactNode }) {
  const { setTheme } = useNextTheme();
  const [mode, setModeState] = useState<Mode>("system");
  const [accent, setAccentState] = useState<Accent>(DEFAULT_ACCENT);
  // 기본값 "항상 켬": OS 모션 줄이기와 무관하게 사이트 연출을 보여주고,
  // 원치 않는 방문자가 설정에서 시스템 따름/끔을 선택한다 (2026-07-27 결정).
  const [motion, setMotionState] = useState<MotionPreference>(DEFAULT_MOTION);
  const [pageTransition, setPageTransitionState] =
    useState<PageTransition>("fade");
  const [fabMode, setFabModeState] = useState<FabMode>("chat");
  const [fabAnim, setFabAnimState] = useState<FabAnim>("slide");
  const [chatLayout, setChatLayoutState] =
    useState<ChatLayout>("floating");
  const [chatFont, setChatFontState] = useState<ChatFont>(DEFAULT_CHAT_FONT);
  const [chatFontSize, setChatFontSizeState] =
    useState<ChatFontSize>(DEFAULT_CHAT_FONT_SIZE);
  const [chatDockWidth, setChatDockWidthState] = useState(
    CHAT_DOCK_DEFAULT_WIDTH,
  );
  const [glow, setGlowState] = useState<boolean>(true);
  const [mounted, setMounted] = useState(false);

  // 브라우저에 저장된 설정을 하이드레이션 직후 첫 페인트 전에 복원한다.
  // 스키마 버전으로 걸러 읽고, 저장소를 쓸 수 없으면 기본값 그대로 계속 동작한다.
  // 저장소에서 React 상태를 맞추는 것이 이 effect의 목적이라 안의 setState는
  // 의도된 것이다.
  useIsomorphicLayoutEffect(() => {
    try {
      const s = localStorage.getItem(THEME_STORAGE_KEY);
      const storedMode = localStorage.getItem("theme");
      if (storedMode === "light" || storedMode === "dark" || storedMode === "system") {
        setModeState(storedMode);
      }
      if (s) {
        const parsed = JSON.parse(s);
        if (isAccent(parsed.accent)) setAccentState(parsed.accent);
        // motion은 v2 스키마부터 신뢰한다. 버전 없는 블롭은 기본값이 "시스템 따름"이던
        // 구 사이트의 자동 저장이라 사용자의 명시적 선택으로 보지 않고, 새 기본값
        // "항상 켬"을 유지한 채 마이그레이션한다 (2026-07-27 결정).
        if (
          (parsed.v === 2 ||
            parsed.v === 3 ||
            parsed.v === 4 ||
            parsed.v === 5 ||
            parsed.v === 6 ||
            parsed.v === 7 ||
            parsed.v === 8) &&
          (parsed.motion === "system" || parsed.motion === "on" || parsed.motion === "off")
        ) {
          setMotionState(parsed.motion);
        }
        if (
          (parsed.v === 3 ||
            parsed.v === 4 ||
            parsed.v === 5 ||
            parsed.v === 6 ||
            parsed.v === 7 ||
            parsed.v === 8) &&
          (parsed.fabMode === "chat" || parsed.fabMode === "quick-menu")
        ) {
          setFabModeState(parsed.fabMode);
        }
        // v2에서 미리보기 전용이었던 선택값도 실제 빠른 메뉴 연출로 승격해 복원한다.
        if (
          (parsed.v === 2 ||
            parsed.v === 4 ||
            parsed.v === 5 ||
            parsed.v === 6 ||
            parsed.v === 7 ||
            parsed.v === 8) &&
          (parsed.fabAnim === "none" ||
            parsed.fabAnim === "rise" ||
            parsed.fabAnim === "slide" ||
            parsed.fabAnim === "pop" ||
            parsed.fabAnim === "blur" ||
            parsed.fabAnim === "fade")
        ) {
          setFabAnimState(parsed.fabAnim === "fade" ? "blur" : parsed.fabAnim);
        }
        if (
          (parsed.v === 5 ||
            parsed.v === 6 ||
            parsed.v === 7 ||
            parsed.v === 8) &&
          (parsed.pageTransition === "none" ||
            parsed.pageTransition === "slide" ||
            parsed.pageTransition === "fade" ||
            parsed.pageTransition === "lift")
        ) {
          setPageTransitionState(parsed.pageTransition);
        }
        if (
          (parsed.v === 6 || parsed.v === 7 || parsed.v === 8) &&
          (parsed.chatLayout === "floating" || parsed.chatLayout === "dock")
        ) {
          setChatLayoutState(parsed.chatLayout);
        }
        if (
          (parsed.v === 7 || parsed.v === 8) &&
          typeof parsed.chatDockWidth === "number"
        ) {
          setChatDockWidthState(
            normalizeChatDockWidth(parsed.chatDockWidth),
          );
        }
        if (
          parsed.v === 8 &&
          (parsed.chatFont === "pretendard" ||
            parsed.chatFont === "noto-sans-kr" ||
            parsed.chatFont === "system")
        ) {
          setChatFontState(parsed.chatFont);
        }
        if (
          parsed.v === 8 &&
          (parsed.chatFontSize === "small" ||
            parsed.chatFontSize === "medium" ||
            parsed.chatFontSize === "large" ||
            parsed.chatFontSize === "xlarge")
        ) {
          setChatFontSizeState(parsed.chatFontSize);
        }
        if (typeof parsed.glow === "boolean") setGlowState(parsed.glow);
      }
    } catch (e) {
      console.error("Failed to load custom theme from localStorage", e);
    }
    setMounted(true);
  }, []);

  /**
   * 포인트 색상을 문서 루트의 CSS 변수로 적용한다.
   * 알 수 없는 색이면 기본 인디고로 되돌린다. 서버에서는 아무 일도 하지 않는다.
   */
  const applyCustomTheme = (a: Accent) => {
    if (typeof window === "undefined") return;
    const r = document.documentElement.style;
    const aColors = ACCENTS[a] || ACCENTS.indigo;

    r.setProperty("--accent", aColors.color);
    r.setProperty("--accent-2", aColors.color2);
    r.setProperty("--accent-soft", aColors.soft);
    r.setProperty("--accent-contrast", aColors.contrast);
  };

  // 설정이 바뀔 때마다 문서 루트의 CSS 변수·data 속성을 맞춘다. 첫 페인트
  // 전에 끝나야 해서 레이아웃 이펙트를 쓴다. 저장소 기록은 화면과 무관하니
  // 아래 패시브 effect로 미뤄 페인트를 막지 않는다.
  // 복원이 끝나기 전(mounted=false)에는 아무것도 쓰지 않는다. 그러지 않으면
  // 기본값이 사용자의 저장값을 덮어쓴다.
  useIsomorphicLayoutEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    applyCustomTheme(accent);
    root.style.setProperty("--chat-dock-width", `${chatDockWidth}px`);
    root.style.setProperty("--chat-font-family", CHAT_FONT_FAMILIES[chatFont]);
    root.style.setProperty(
      "--chat-body-font-size",
      CHAT_FONT_SIZES[chatFontSize].body,
    );
    root.style.setProperty(
      "--chat-control-font-size",
      CHAT_FONT_SIZES[chatFontSize].control,
    );
    // 설정 화면의 "선택됨" 표시를 그리는 data 속성이다. 부트 스크립트가 심는
    // 것과 같은 키·같은 값이라, 여기서 덮어써도 화면은 변하지 않는다.
    Object.assign(
      root.dataset,
      themeSettingsDataset({
        mode,
        accent,
        motion,
        pageTransition,
        fabMode,
        fabAnim,
        chatLayout,
        chatFont,
        chatFontSize,
        glow,
      }),
    );
  }, [
    accent,
    chatDockWidth,
    chatFont,
    chatFontSize,
    chatLayout,
    fabAnim,
    fabMode,
    glow,
    mode,
    motion,
    mounted,
    pageTransition,
  ]);

  // 저장소 기록이다. 화면에 보이지 않으니 페인트 뒤에 해도 된다.
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(
        THEME_STORAGE_KEY,
        JSON.stringify({
          v: 8,
          accent,
          motion,
          pageTransition,
          fabMode,
          fabAnim,
          chatLayout,
          chatFont,
          chatFontSize,
          chatDockWidth,
          glow,
        })
      );
    } catch (e) {
      console.error("Failed to save custom theme to localStorage", e);
    }
  }, [
    accent,
    motion,
    pageTransition,
    fabMode,
    fabAnim,
    chatLayout,
    chatFont,
    chatFontSize,
    chatDockWidth,
    glow,
    mounted,
  ]);

  // 소비자가 테마 값 하나 때문에 통째로 리렌더되지 않도록 setter 아이덴티티를 고정한다.
  const setMode = useCallback(
    (m: Mode) => {
      setModeState(m);
      setTheme(m);
    },
    [setTheme],
  );
  /** 포인트 색상을 바꾼다. */
  const setAccent = useCallback((a: Accent) => setAccentState(a), []);
  /** 모션 정책을 바꾼다(시스템 따름·항상 켬·끔). */
  const setMotion = useCallback(
    (m: MotionPreference) => setMotionState(m),
    [],
  );
  /** 페이지 전환 연출을 바꾼다. */
  const setPageTransition = useCallback(
    (transition: PageTransition) => setPageTransitionState(transition),
    [],
  );
  /** 플로팅 버튼이 채팅을 열지, 빠른 메뉴를 열지 바꾼다. */
  const setFabMode = useCallback(
    (nextMode: FabMode) => setFabModeState(nextMode),
    [],
  );
  /** 빠른 메뉴 항목의 등장 연출을 바꾼다. */
  const setFabAnim = useCallback(
    (animation: FabAnim) => setFabAnimState(animation),
    [],
  );
  /** 채팅 패널 배치를 바꾼다(플로팅·오른쪽 고정). */
  const setChatLayout = useCallback(
    (layout: ChatLayout) => setChatLayoutState(layout),
    [],
  );
  /** 채팅 영역 글꼴을 바꾼다. */
  const setChatFont = useCallback((font: ChatFont) => setChatFontState(font), []);
  /** 채팅 영역 글자 크기를 바꾼다. */
  const setChatFontSize = useCallback(
    (size: ChatFontSize) => setChatFontSizeState(size),
    [],
  );
  /** 고정 패널 너비를 바꾼다. 허용 범위를 벗어난 값은 잘라서 저장한다. */
  const setChatDockWidth = useCallback(
    (width: number) => setChatDockWidthState(normalizeChatDockWidth(width)),
    [],
  );
  /** 글로우 효과 사용 여부를 바꾼다. */
  const setGlow = useCallback((g: boolean) => setGlowState(g), []);

  /**
   * 모든 테마 옵션을 기본값으로 되돌린다.
   * 저장소 기록은 값이 바뀌면서 동기화 effect가 알아서 덮어쓴다.
   */
  const resetTheme = useCallback(() => {
    setModeState("system");
    setTheme("system");
    setAccentState(DEFAULT_ACCENT);
    setMotionState(DEFAULT_MOTION);
    setPageTransitionState("fade");
    setFabModeState("chat");
    setFabAnimState("slide");
    setChatLayoutState("floating");
    setChatFontState(DEFAULT_CHAT_FONT);
    setChatFontSizeState(DEFAULT_CHAT_FONT_SIZE);
    setChatDockWidthState(CHAT_DOCK_DEFAULT_WIDTH);
    setGlowState(true);
  }, [setTheme]);

  const value = useMemo<ThemeContextType>(
    () => ({
      mode,
      accent,
      motion,
      pageTransition,
      fabMode,
      fabAnim,
      chatLayout,
      chatFont,
      chatFontSize,
      chatDockWidth,
      glow,
      setMode,
      setAccent,
      setMotion,
      setPageTransition,
      setFabMode,
      setFabAnim,
      setChatLayout,
      setChatFont,
      setChatFontSize,
      setChatDockWidth,
      setGlow,
      resetTheme,
    }),
    [
      accent,
      chatDockWidth,
      chatFont,
      chatFontSize,
      chatLayout,
      fabAnim,
      fabMode,
      glow,
      mode,
      motion,
      pageTransition,
      resetTheme,
      setAccent,
      setChatDockWidth,
      setChatFont,
      setChatFontSize,
      setChatLayout,
      setFabAnim,
      setFabMode,
      setGlow,
      setMode,
      setMotion,
      setPageTransition,
    ],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/**
 * next-themes 위에 포트폴리오 테마 컨텍스트를 얹는 최상위 Provider다.
 * 색상 모드는 data-theme 속성으로 붙고, 시스템 설정을 기본값으로 따른다.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider defaultTheme="system" enableSystem attribute="data-theme">
      <CustomThemeProvider>{children}</CustomThemeProvider>
    </NextThemesProvider>
  );
}

/**
 * 테마 컨텍스트를 읽는다.
 * Provider 밖에서 부르면 오류를 던진다. 조용히 기본값을 돌려주면 설정이
 * 반영되지 않는 이유를 찾기 어려워지기 때문이다.
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
