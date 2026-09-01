'use client';

import type {
  Accent,
  ChatFont,
  ChatFontSize,
  ChatLayout,
  Mode,
} from '@/context/ThemeContext';
import type {
  ChatStreamAnimation,
  ChatToolExecution,
  ChatUiSettings,
} from '@/features/chat/types';
import { CHAT_STREAM_ANIMATIONS } from '@/features/chat/constants';
import {
  isPortfolioResearchYear,
  isPortfolioViewAction,
  portfolioViewActionRequiresYear,
  readPortfolioViewState,
  runPortfolioViewAction,
} from '@/features/webmcp/portfolioView';

export const PORTFOLIO_UI_TOOL_NAMES = [
  'get-portfolio-ui-settings',
  'set-portfolio-theme',
  'set-portfolio-accent',
  'set-portfolio-chat-layout',
  'set-portfolio-chat-font',
  'set-portfolio-chat-font-size',
  'set-portfolio-stream-animation',
  'get-portfolio-view-state',
  'control-portfolio-view',
  'open-portfolio-settings',
] as const;

export type PortfolioUiToolName = (typeof PORTFOLIO_UI_TOOL_NAMES)[number];

export interface PortfolioUiToolCommand {
  name: PortfolioUiToolName;
  input: Record<string, unknown>;
}

export type PortfolioUiToolResult = Record<string, unknown>;

export type PortfolioUiToolExecutor = (
  command: PortfolioUiToolCommand,
) => PortfolioUiToolResult;

export interface PortfolioUiToolRuntime {
  getSettings: () => ChatUiSettings;
  setMode: (mode: Mode) => void;
  setAccent: (accent: Accent) => void;
  setChatLayout: (layout: ChatLayout) => void;
  setChatFont: (font: ChatFont) => void;
  setChatFontSize: (size: ChatFontSize) => void;
  setStreamAnimation: (animation: ChatStreamAnimation) => void;
  navigateRoute: (route: string) => void;
}

const THEMES = ['light', 'dark'] as const;
const ACCENTS = ['indigo', 'emerald', 'amber', 'rose', 'violet'] as const;
const CHAT_LAYOUTS = ['floating', 'dock'] as const;
const CHAT_FONTS = ['pretendard', 'noto-sans-kr', 'system'] as const;
const CHAT_FONT_SIZES = ['small', 'medium', 'large', 'xlarge'] as const;

function assertInputObject(input: unknown): asserts input is Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('도구 인자는 객체여야 합니다.');
  }
}

function assertOnlyKeys(
  input: Record<string, unknown>,
  allowedKeys: readonly string[],
): void {
  if (Object.keys(input).some((key) => !allowedKeys.includes(key))) {
    throw new TypeError('도구 인자에 지원하지 않는 항목이 포함돼 있습니다.');
  }
}

function emptyInput(input: Record<string, unknown>, label: string): void {
  assertOnlyKeys(input, []);
  if (Object.keys(input).length > 0) {
    throw new TypeError(`${label} 도구에는 인자가 필요하지 않습니다.`);
  }
}

function enumInput<const T extends readonly string[]>(
  input: Record<string, unknown>,
  key: string,
  values: T,
  label: string,
): T[number] {
  assertOnlyKeys(input, [key]);
  const value = input[key];
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
    throw new TypeError(`${label} 도구 인자가 올바르지 않습니다.`);
  }
  return value as T[number];
}

export function executePortfolioUiTool(
  command: PortfolioUiToolCommand,
  runtime: PortfolioUiToolRuntime,
): PortfolioUiToolResult {
  assertInputObject(command.input);
  const { input } = command;

  switch (command.name) {
    case 'get-portfolio-ui-settings': {
      emptyInput(input, '현재 UI 설정 조회');
      return { ok: true, uiSettings: runtime.getSettings() };
    }
    case 'set-portfolio-theme': {
      const theme = enumInput(input, 'theme', THEMES, '화면 모드');
      runtime.setMode(theme);
      return { ok: true, theme, message: `화면 모드를 ${theme}(으)로 변경했습니다.` };
    }
    case 'set-portfolio-accent': {
      const accent = enumInput(input, 'accent', ACCENTS, '포인트 색상');
      runtime.setAccent(accent);
      return { ok: true, accent, message: `포인트 색상을 ${accent}(으)로 변경했습니다.` };
    }
    case 'set-portfolio-chat-layout': {
      const layout = enumInput(input, 'layout', CHAT_LAYOUTS, '채팅 레이아웃');
      runtime.setChatLayout(layout);
      return { ok: true, layout, message: `채팅 레이아웃을 ${layout}(으)로 변경했습니다.` };
    }
    case 'set-portfolio-chat-font': {
      const font = enumInput(input, 'font', CHAT_FONTS, '채팅 글꼴');
      runtime.setChatFont(font);
      return { ok: true, font, message: `채팅 글꼴을 ${font}(으)로 변경했습니다.` };
    }
    case 'set-portfolio-chat-font-size': {
      const size = enumInput(input, 'size', CHAT_FONT_SIZES, '채팅 글자 크기');
      runtime.setChatFontSize(size);
      return { ok: true, size, message: `채팅 글자 크기를 ${size}(으)로 변경했습니다.` };
    }
    case 'set-portfolio-stream-animation': {
      const animation = enumInput(
        input,
        'animation',
        CHAT_STREAM_ANIMATIONS,
        '스트리밍 연출',
      );
      runtime.setStreamAnimation(animation);
      return {
        ok: true,
        animation,
        message: `채팅 스트리밍 연출을 ${animation}(으)로 변경했습니다.`,
      };
    }
    case 'get-portfolio-view-state': {
      emptyInput(input, '현재 화면 상태 조회');
      return {
        ok: true,
        viewState: readPortfolioViewState(window.location.pathname),
      };
    }
    case 'control-portfolio-view': {
      assertOnlyKeys(input, ['action', 'year']);
      if (!isPortfolioViewAction(input.action)) {
        throw new TypeError('지원하지 않는 포트폴리오 화면 제어 동작입니다.');
      }
      const requiresYear = portfolioViewActionRequiresYear(input.action);
      const year = isPortfolioResearchYear(input.year) ? input.year : undefined;
      if ((requiresYear && !year) || (!requiresYear && input.year !== undefined)) {
        throw new TypeError('연도별 연구 상세 제어의 연도 인자가 올바르지 않습니다.');
      }
      const target = runPortfolioViewAction(
        input.action,
        runtime.navigateRoute,
        year,
      );
      return {
        ok: true,
        action: target.action,
        route: target.route,
        message: target.message,
        ...(target.researchYear ? { year: target.researchYear } : {}),
      };
    }
    case 'open-portfolio-settings': {
      emptyInput(input, '설정 페이지 열기');
      runtime.navigateRoute('/settings');
      return {
        ok: true,
        route: '/settings',
        message: '포트폴리오 설정 페이지로 이동을 시작했습니다.',
      };
    }
  }
}

export function portfolioUiCommandFromChatExecution(
  execution: ChatToolExecution,
): PortfolioUiToolCommand | null {
  switch (execution.type) {
    case 'set_portfolio_theme':
      return { name: execution.toolName, input: { theme: execution.theme } };
    case 'set_portfolio_accent':
      return { name: execution.toolName, input: { accent: execution.accent } };
    case 'set_portfolio_chat_layout':
      return { name: execution.toolName, input: { layout: execution.layout } };
    case 'set_portfolio_chat_font':
      return { name: execution.toolName, input: { font: execution.font } };
    case 'set_portfolio_chat_font_size':
      return { name: execution.toolName, input: { size: execution.size } };
    case 'set_portfolio_stream_animation':
      return {
        name: execution.toolName,
        input: { animation: execution.animation },
      };
    case 'control_portfolio_view':
      return {
        name: execution.toolName,
        input: {
          action: execution.action,
          ...(execution.year ? { year: execution.year } : {}),
        },
      };
    case 'open_portfolio_settings':
      return { name: execution.toolName, input: {} };
    default:
      return null;
  }
}
