import {
  ToolDefinition,
  assertOnlyKeys,
  emptyInputDefinition,
  enumInputDefinition,
  enumObjectSchema,
  isAllowed,
  type InputDefinition,
} from './contract.ts';
import { SEASON_SNOW_AMOUNT_VALUES, SEASON_THEME_PREFERENCES, SNOW_THEME_IDS } from '../seasonal/seasonPolicy.ts';
import { SEASON_WEATHER_EFFECTS, SEASON_WEATHER_IDS } from '../seasonal/seasonWeatherPolicy.ts';

/** 도구로 바꿀 수 있는 화면 모드다. 되돌리기에서 system 복원도 허용한다. */
export const THEMES = ['light', 'dark', 'system'] as const;
/** 설정 화면과 챗봇 요청에 실리는 화면 모드 전체다. */
export const THEME_MODES = ['light', 'dark', 'system'] as const;
/** 지원하는 포인트 색상이다. `ThemeContext`의 ACCENTS 맵 키와 같아야 한다. */
export const ACCENTS = ['blue', 'indigo', 'emerald', 'amber', 'rose', 'violet'] as const;
/** PC 채팅 패널 배치다. 좁은 화면에서는 dock을 골라도 플로팅으로 그린다. */
export const CHAT_LAYOUTS = ['floating', 'dock'] as const;
/**
 * 오른쪽 고정 패널(dock)을 실제로 그리는 최소 화면 너비(px)다.
 * globals.css·ChatWidget.module.css의 미디어 쿼리와 설정 페이지 안내 문구도 같은 값을 쓴다.
 */
export const CHAT_DOCK_MIN_VIEWPORT_WIDTH = 1100;
/** 고정 패널을 그릴 수 있는 화면인지 판별하는 미디어 쿼리다. */
export const CHAT_DOCK_VIEWPORT_QUERY = `(min-width: ${CHAT_DOCK_MIN_VIEWPORT_WIDTH}px)`;
/** 좁은 화면에서 dock을 저장했을 때 실제 모습을 알리는 도구 결과 문장이다. 작업 세션 모델이 읽는다. */
export const CHAT_DOCK_NARROW_NOTICE =
  `화면 너비가 ${CHAT_DOCK_MIN_VIEWPORT_WIDTH}px보다 좁아 지금은 플로팅 창으로 보입니다. 넓은 화면에서는 오른쪽 고정 패널로 표시됩니다.`;

/** 지금 화면이 고정 패널을 그릴 만큼 넓은지 본다. 창이 없는 환경(테스트·서버 렌더)에서는 넓다고 본다. */
export function chatDockFitsViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia(CHAT_DOCK_VIEWPORT_QUERY).matches;
}
/** 채팅 영역 글꼴이다. */
export const CHAT_FONTS = ['pretendard', 'noto-sans-kr', 'system'] as const;
/** 채팅 영역 글자 크기다. */
export const CHAT_FONT_SIZES = ['small', 'medium', 'large', 'xlarge'] as const;
/** 채팅 답변의 스트리밍 연출이다. */
export const CHAT_STREAM_ANIMATIONS = [
  'none', 'typewriter', 'word-fade', 'token-chunks', 'blur-focus', 'slide-up',
  'skeleton', 'mask-wipe', 'scramble', 'letter-drop', 'highlight-trail',
] as const;

/** 시즌 테마 선택이다. 자동은 날짜로 고르고, 끔은 장식과 계절 효과를 모두 숨긴다. */
export const SEASON_THEME_CHOICES = SEASON_THEME_PREFERENCES;
/** 켜고 끌 수 있는 계절 효과다. 눈은 겨울·크리스마스, 나머지는 각자 한 계절 테마에서만 보인다. */
export const SEASON_EFFECTS = ['snow', ...SEASON_WEATHER_IDS] as const;
/** 계절 효과 켜기·끄기 값이다. 화면 설정(ChatUiSettings)도 같은 문자열로 싣는다. */
export const SWITCH_STATES = ['on', 'off'] as const;
/** 계절 효과 공통 양이다(눈 설정에서 이어진 저장값). */
export const SEASON_EFFECT_AMOUNTS = SEASON_SNOW_AMOUNT_VALUES;
/** 계절 효과를 카드 앞(front)에 그릴지 카드 뒤(behind)로 숨길지다. */
export const SEASON_EFFECT_LAYERS = ['front', 'behind'] as const;

export type PortfolioTheme = (typeof THEMES)[number];
export type PortfolioThemeMode = (typeof THEME_MODES)[number];
export type PortfolioAccent = (typeof ACCENTS)[number];
export type PortfolioChatLayout = (typeof CHAT_LAYOUTS)[number];
export type PortfolioChatFont = (typeof CHAT_FONTS)[number];
export type PortfolioChatFontSize = (typeof CHAT_FONT_SIZES)[number];
export type PortfolioStreamAnimation = (typeof CHAT_STREAM_ANIMATIONS)[number];
export type PortfolioSeasonTheme = (typeof SEASON_THEME_CHOICES)[number];
export type PortfolioSeasonEffect = (typeof SEASON_EFFECTS)[number];
export type PortfolioSwitchState = (typeof SWITCH_STATES)[number];
export type PortfolioSeasonEffectAmount = (typeof SEASON_EFFECT_AMOUNTS)[number];
export type PortfolioSeasonEffectLayer = (typeof SEASON_EFFECT_LAYERS)[number];

/** 계절 효과별 켜기·끄기가 실리는 화면 설정(ChatUiSettings)의 키다. */
export const SEASON_EFFECT_SETTING_KEYS = {
  snow: 'seasonSnow',
  leaves: 'seasonLeaves',
  petals: 'seasonPetals',
  rain: 'seasonRain',
} as const satisfies Record<PortfolioSeasonEffect, string>;

/** 계절 효과가 실제로 보이는 시즌 테마다. 켜 두어도 이 테마가 아니면 나타나지 않는다. */
export const SEASON_EFFECT_THEMES: Readonly<Record<PortfolioSeasonEffect, readonly string[]>> = {
  snow: SNOW_THEME_IDS,
  leaves: [SEASON_WEATHER_EFFECTS.leaves.season],
  petals: [SEASON_WEATHER_EFFECTS.petals.season],
  rain: [SEASON_WEATHER_EFFECTS.rain.season],
};

/** 계절 효과 하나를 켜거나 끄는 입력이다. 대상과 상태를 함께 받는다. */
export const seasonEffectInput: InputDefinition<{ effect: PortfolioSeasonEffect; state: PortfolioSwitchState }> = {
  schema: enumObjectSchema({
    effect: { values: SEASON_EFFECTS, description: 'snow는 눈, petals는 벚꽃, rain은 비, leaves는 낙엽' },
    state: { values: SWITCH_STATES, description: 'on은 켜기, off는 끄기' },
  }, ['effect', 'state']),
  parse(input) {
    assertOnlyKeys(input, ['effect', 'state']);
    if (!isAllowed(input.effect, SEASON_EFFECTS) || !isAllowed(input.state, SWITCH_STATES)) {
      throw new TypeError('계절 효과 도구의 대상 또는 상태가 올바르지 않습니다.');
    }
    return { effect: input.effect, state: input.state };
  },
};

/** 선택지 도구로 방문자에게 고르게 할 수 있는 설정이다. 각각 아래 set_ 도구 하나로 적용한다. */
export const CHOICE_SETTINGS = [
  'theme', 'accent', 'chat_layout', 'chat_font', 'chat_font_size', 'stream_animation', 'season_theme', 'season_effect_amount',
] as const;
export type PortfolioChoiceSetting = (typeof CHOICE_SETTINGS)[number];

/** 선택지 설정별로 적용에 쓰는 설정 도구·인자 이름과, 화면 설정(ChatUiSettings)의 키다. */
export const CHOICE_SETTING_TARGETS = {
  theme: { tool: 'set_portfolio_theme', argument: 'theme', settingsKey: 'theme' },
  accent: { tool: 'set_portfolio_accent', argument: 'accent', settingsKey: 'accent' },
  chat_layout: { tool: 'set_portfolio_chat_layout', argument: 'layout', settingsKey: 'chatLayout' },
  chat_font: { tool: 'set_portfolio_chat_font', argument: 'font', settingsKey: 'chatFont' },
  chat_font_size: { tool: 'set_portfolio_chat_font_size', argument: 'size', settingsKey: 'chatFontSize' },
  stream_animation: { tool: 'set_portfolio_stream_animation', argument: 'animation', settingsKey: 'streamAnimation' },
  season_theme: { tool: 'set_portfolio_season_theme', argument: 'theme', settingsKey: 'seasonTheme' },
  season_effect_amount: { tool: 'set_portfolio_season_effect_amount', argument: 'amount', settingsKey: 'seasonEffectAmount' },
} as const satisfies Record<PortfolioChoiceSetting, { tool: string; argument: string; settingsKey: string }>;

/** 설정을 읽거나 바꾸는 UI 도구 정의다. */
export const PORTFOLIO_SETTINGS_TOOL_DEFINITIONS = [
  new ToolDefinition('get_portfolio_ui_settings', emptyInputDefinition('현재 UI 설정 조회')),
  new ToolDefinition('set_portfolio_theme', enumInputDefinition('theme', THEMES, 'light, dark, system 중 하나', '화면 모드')),
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
  new ToolDefinition('set_portfolio_season_theme', enumInputDefinition(
    'theme', SEASON_THEME_CHOICES, 'auto(날짜에 맞춤), off(끄기), christmas, spring, summer, autumn, winter 중 하나', '시즌 테마',
  )),
  new ToolDefinition('set_portfolio_season_effect', seasonEffectInput),
  new ToolDefinition('set_portfolio_season_effect_amount', enumInputDefinition(
    'amount', SEASON_EFFECT_AMOUNTS, 'light(적게), normal(보통), heavy(많이) 중 하나', '계절 효과 양',
  )),
  new ToolDefinition('set_portfolio_season_effect_layer', enumInputDefinition(
    'layer', SEASON_EFFECT_LAYERS, 'front(카드 앞) 또는 behind(카드 뒤에 숨기기)', '계절 효과 위치',
  )),
  new ToolDefinition('reset_portfolio_settings', emptyInputDefinition('설정 초기화')),
] as const;

/**
 * 채팅 작업 세션만 쓰는 선택지 도구다.
 *
 * 답변 말풍선에 설정 버튼을 띄우고 바로 끝난다. 버튼은 대화 턴 없이 설정을 바꾸므로,
 * 채팅 화면이 없는 WebMCP에는 내놓지 않는다.
 */
export const PORTFOLIO_CHOICE_TOOL_DEFINITIONS = [
  new ToolDefinition('choose_portfolio_setting', enumInputDefinition(
    'setting', CHOICE_SETTINGS,
    'theme, accent, chat_layout, chat_font, chat_font_size, stream_animation, season_theme, season_effect_amount 중 하나', '설정 선택지',
  )),
] as const;
