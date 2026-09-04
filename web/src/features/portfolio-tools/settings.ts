import {
  ToolDefinition,
  emptyInputDefinition,
  enumInputDefinition,
} from './contract.ts';

/** 도구로 바꿀 수 있는 화면 모드다. `system`은 사용자만 고를 수 있다. */
export const THEMES = ['light', 'dark'] as const;
/** 설정 화면과 챗봇 요청에 실리는 화면 모드 전체다. */
export const THEME_MODES = ['light', 'dark', 'system'] as const;
/** 지원하는 포인트 색상이다. `ThemeContext`의 ACCENTS 맵 키와 같아야 한다. */
export const ACCENTS = ['indigo', 'emerald', 'amber', 'rose', 'violet'] as const;
/** PC 채팅 패널 배치다. 좁은 화면에서는 dock을 골라도 플로팅으로 그린다. */
export const CHAT_LAYOUTS = ['floating', 'dock'] as const;
/** 채팅 영역 글꼴이다. */
export const CHAT_FONTS = ['pretendard', 'noto-sans-kr', 'system'] as const;
/** 채팅 영역 글자 크기다. */
export const CHAT_FONT_SIZES = ['small', 'medium', 'large', 'xlarge'] as const;
/** 채팅 답변의 스트리밍 연출이다. */
export const CHAT_STREAM_ANIMATIONS = [
  'none', 'typewriter', 'word-fade', 'token-chunks', 'blur-focus', 'slide-up',
  'skeleton', 'mask-wipe', 'scramble', 'letter-drop', 'highlight-trail',
] as const;

export type PortfolioTheme = (typeof THEMES)[number];
export type PortfolioThemeMode = (typeof THEME_MODES)[number];
export type PortfolioAccent = (typeof ACCENTS)[number];
export type PortfolioChatLayout = (typeof CHAT_LAYOUTS)[number];
export type PortfolioChatFont = (typeof CHAT_FONTS)[number];
export type PortfolioChatFontSize = (typeof CHAT_FONT_SIZES)[number];
export type PortfolioStreamAnimation = (typeof CHAT_STREAM_ANIMATIONS)[number];

/** 설정을 읽거나 바꾸는 UI 도구 정의다. */
export const PORTFOLIO_SETTINGS_TOOL_DEFINITIONS = [
  new ToolDefinition('get_portfolio_ui_settings', emptyInputDefinition('현재 UI 설정 조회')),
  new ToolDefinition('set_portfolio_theme', enumInputDefinition('theme', THEMES, 'light 또는 dark 중 하나', '화면 모드')),
  new ToolDefinition('set_portfolio_accent', enumInputDefinition('accent', ACCENTS, '지원하는 포인트 색상', '포인트 색상')),
  new ToolDefinition('set_portfolio_chat_layout', enumInputDefinition('layout', CHAT_LAYOUTS, 'floating 또는 dock 중 하나', '채팅 레이아웃')),
  new ToolDefinition('set_portfolio_chat_font', enumInputDefinition('font', CHAT_FONTS, '지원하는 채팅 글꼴', '채팅 글꼴')),
  new ToolDefinition('set_portfolio_chat_font_size', enumInputDefinition('size', CHAT_FONT_SIZES, 'small, medium, large, xlarge 중 하나', '채팅 글자 크기')),
  new ToolDefinition('set_portfolio_stream_animation', enumInputDefinition(
    'animation',
    CHAT_STREAM_ANIMATIONS,
    'none, typewriter, word-fade, token-chunks, blur-focus, slide-up, skeleton, mask-wipe, scramble, letter-drop, highlight-trail 중 하나',
    '스트리밍 연출',
  )),
] as const;
