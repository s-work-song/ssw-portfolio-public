'use client';

/**
 * 포트폴리오 UI 도구를 실제로 실행하는 단일 진입점이다.
 *
 * 챗봇 응답의 도구 지시와 WebMCP 도구 호출은 출발지가 다르지만, 여기로
 * 모여 같은 검증과 같은 부작용을 거친다. 두 경로가 각자 화면을 만지면
 * "챗봇으로는 되는데 WebMCP로는 안 되는" 종류의 어긋남이 생기기 때문이다.
 *
 * 실행에 필요한 setter는 런타임 객체로 주입받는다(DIP). 덕분에 이 모듈은
 * React 컨텍스트를 알지 않아도 되고, ChatProvider가 최신 setter를 쥔
 * 런타임만 갈아 끼우면 된다.
 */
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
import {
  PORTFOLIO_UI_TOOLS,
  PORTFOLIO_UI_TOOL_NAMES,
  assertInputObject,
  type PortfolioUiToolName,
} from './schema';
import {
  readPortfolioViewState,
  runPortfolioViewAction,
} from '@/features/webmcp/portfolioView';

export { PORTFOLIO_UI_TOOL_NAMES };
export type { PortfolioUiToolName };

/** 실행기가 받는 도구 호출 하나다. 입력은 아직 검증되지 않은 원본이다. */
export interface PortfolioUiToolCommand {
  name: PortfolioUiToolName;
  input: Record<string, unknown>;
}

/** 도구 실행 결과다. WebMCP는 이 객체를 그대로 JSON으로 돌려준다. */
export type PortfolioUiToolResult = Record<string, unknown>;

/** 명령 하나를 실행하는 함수 타입이다. 컨텍스트가 이 형태로 노출한다. */
export type PortfolioUiToolExecutor = (
  command: PortfolioUiToolCommand,
) => PortfolioUiToolResult;

/**
 * 도구가 화면을 바꾸기 위해 필요한 최소 능력 집합이다.
 *
 * 실행기는 이 인터페이스만 알고 React·next-themes·라우터를 직접 알지 않는다.
 */
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

/**
 * 검증을 통과한 도구 명령을 실행하고 호출자에게 돌려줄 결과를 만든다.
 *
 * 입력은 먼저 객체인지 확인한 뒤 도구별 `parse`(schema)가 허용값까지
 * 좁힌다. 어긋나면 TypeError를 던지고, 호출한 쪽(WebMCP 어댑터나
 * ChatProvider의 도구 큐)이 그 실패를 오류 응답이나 경고로 감싼다.
 *
 * 반환 객체의 `message`는 모델에게 결과를 설명하는 문장이라 사람이 읽는
 * 안내 문구와 같은 톤을 유지한다. 부작용(테마 변경·라우팅)은 런타임을 통해
 * 일어나며 이 함수는 그 결과를 기다리지 않는다.
 */
export function executePortfolioUiTool(
  command: PortfolioUiToolCommand,
  runtime: PortfolioUiToolRuntime,
): PortfolioUiToolResult {
  assertInputObject(command.input);
  const { input } = command;

  switch (command.name) {
    case 'get-portfolio-ui-settings': {
      PORTFOLIO_UI_TOOLS['get-portfolio-ui-settings'].parse(input);
      return { ok: true, uiSettings: runtime.getSettings() };
    }
    case 'set-portfolio-theme': {
      const { theme } = PORTFOLIO_UI_TOOLS['set-portfolio-theme'].parse(input);
      runtime.setMode(theme);
      return { ok: true, theme, message: `화면 모드를 ${theme}(으)로 변경했습니다.` };
    }
    case 'set-portfolio-accent': {
      const { accent } = PORTFOLIO_UI_TOOLS['set-portfolio-accent'].parse(input);
      runtime.setAccent(accent);
      return { ok: true, accent, message: `포인트 색상을 ${accent}(으)로 변경했습니다.` };
    }
    case 'set-portfolio-chat-layout': {
      const { layout } =
        PORTFOLIO_UI_TOOLS['set-portfolio-chat-layout'].parse(input);
      runtime.setChatLayout(layout);
      return { ok: true, layout, message: `채팅 레이아웃을 ${layout}(으)로 변경했습니다.` };
    }
    case 'set-portfolio-chat-font': {
      const { font } =
        PORTFOLIO_UI_TOOLS['set-portfolio-chat-font'].parse(input);
      runtime.setChatFont(font);
      return { ok: true, font, message: `채팅 글꼴을 ${font}(으)로 변경했습니다.` };
    }
    case 'set-portfolio-chat-font-size': {
      const { size } =
        PORTFOLIO_UI_TOOLS['set-portfolio-chat-font-size'].parse(input);
      runtime.setChatFontSize(size);
      return { ok: true, size, message: `채팅 글자 크기를 ${size}(으)로 변경했습니다.` };
    }
    case 'set-portfolio-stream-animation': {
      const { animation } =
        PORTFOLIO_UI_TOOLS['set-portfolio-stream-animation'].parse(input);
      runtime.setStreamAnimation(animation);
      return {
        ok: true,
        animation,
        message: `채팅 스트리밍 연출을 ${animation}(으)로 변경했습니다.`,
      };
    }
    case 'get-portfolio-view-state': {
      PORTFOLIO_UI_TOOLS['get-portfolio-view-state'].parse(input);
      return {
        ok: true,
        viewState: readPortfolioViewState(window.location.pathname),
      };
    }
    case 'control-portfolio-view': {
      const { action, year } =
        PORTFOLIO_UI_TOOLS['control-portfolio-view'].parse(input);
      const target = runPortfolioViewAction(action, runtime.navigateRoute, year);
      return {
        ok: true,
        action: target.action,
        route: target.route,
        label: target.label,
        message: target.message,
        ...(target.researchYear ? { year: target.researchYear } : {}),
      };
    }
    case 'open-portfolio-settings': {
      PORTFOLIO_UI_TOOLS['open-portfolio-settings'].parse(input);
      runtime.navigateRoute('/settings');
      return {
        ok: true,
        route: '/settings',
        label: '포트폴리오 설정 페이지',
        message: '포트폴리오 설정 페이지로 이동을 시작했습니다.',
      };
    }
  }
}

/**
 * 챗봇 응답의 도구 실행을 UI 도구 명령으로 옮긴다.
 *
 * 서버가 보낸 실행 지시(`ChatToolExecution`)와 WebMCP 도구 호출은 필드
 * 이름이 다르다. 이 어댑터가 그 차이를 흡수해 두 경로가 같은 실행기에
 * 도달하게 한다. UI 도구가 아닌 지시(기록 검색 결과 표시, 읽기 전용 보고,
 * 색상 순회 연출)는 null을 돌려 호출한 쪽이 따로 처리하게 한다.
 */
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
