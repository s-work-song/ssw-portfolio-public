/**
 * 사이트 설정 하나하나를 `<html>`의 data 속성으로 내보내는 계약을 쥔 순수 모듈이다.
 *
 * 설정 화면의 "선택됨" 표시는 React 상태가 아니라 이 data 속성을 보는 CSS가
 * 그린다. 정적 HTML은 빌드 시점 기본값으로 그려지고 하이드레이션은 첫 페인트
 * 뒤에야 끝나므로, React 상태로 칠하면 새로고침마다 기본값이 한 번 스쳐 간다.
 * `<head>`의 부트 스크립트가 파싱 도중 이 속성들을 먼저 심으면 첫 페인트부터
 * 저장값이 반영된다.
 *
 * 그래서 이 표가 세 곳의 단일 소스다.
 *  1. `THEME_BOOT_SCRIPT` — 하이드레이션 전에 저장소를 읽어 속성을 심는다.
 *  2. `themeSettingsDataset` / `chatSettingsDataset` — Provider가 상태가 바뀔
 *     때마다 같은 속성을 갱신한다.
 *  3. `app/settings/page.module.css` — 속성값별 선택자로 선택 표시를 그린다.
 *     선택자 목록은 이 표를 기계적으로 펼친 것이라, 값이 늘면 함께 늘려야 한다.
 *
 * 셋 중 하나만 바뀌면 조용히 어긋나므로, 값을 더할 때는 항상 이 파일부터 고친다.
 */
import {
  ACCENTS,
  BOOLEAN_VALUES,
  CHAT_DOCK_DEFAULT_WIDTH,
  CHAT_DOCK_MAX_WIDTH,
  CHAT_DOCK_MIN_WIDTH,
  CHAT_FONT_FAMILIES,
  CHAT_FONT_SIZES,
  DEFAULT_ACCENT,
  DEFAULT_CHAT_FONT,
  DEFAULT_CHAT_FONT_SIZE,
  DEFAULT_CHAT_LAYOUT,
  DEFAULT_FAB_ANIM,
  DEFAULT_FAB_MODE,
  DEFAULT_GLOW,
  DEFAULT_MOTION,
  DEFAULT_PAGE_TRANSITION,
  FAB_ANIMS,
  FAB_MODES,
  MOTION_PREFERENCES,
  PAGE_TRANSITIONS,
  THEME_STORAGE_KEY,
} from "./accentPalette";
import {
  ACCENTS as ACCENT_KEYS,
  CHAT_FONTS,
  CHAT_FONT_SIZES as CHAT_FONT_SIZE_KEYS,
  CHAT_LAYOUTS,
  CHAT_STREAM_ANIMATIONS,
  THEME_MODES,
} from "../features/portfolio-tools/schema";
import {
  CHAT_ANIMATIONS,
  CHAT_ANIMATION_STORAGE_KEY,
  DEFAULT_CHAT_ANIMATION,
  DEFAULT_CHAT_STREAM_ANIMATION,
  STREAMING_STORAGE_KEY,
  STREAM_ANIMATION_STORAGE_KEY,
  TONES,
  TONE_STORAGE_KEY,
} from "../features/chat/constants";

/** next-themes가 화면 모드를 담아 두는 localStorage 키다. */
export const THEME_MODE_STORAGE_KEY = "theme";

/** 저장된 말투가 없을 때의 기본값이다(ChatProvider의 useState 초깃값과 같다). */
const DEFAULT_TONE = "official";
/** 저장된 스트리밍 사용 여부가 없을 때의 기본값이다. */
const DEFAULT_STREAMING = true;

/** data 속성 하나의 이름·허용 목록·기본값이다. */
interface SettingsDatasetEntry {
  /** `document.documentElement.dataset`에 쓰는 camelCase 키다. */
  readonly key: string;
  /** CSS 선택자에 쓰는 실제 속성 이름이다. */
  readonly attribute: string;
  /** 이 목록 밖의 값은 기본값으로 접는다. */
  readonly values: readonly string[];
  /** 저장값이 없거나 목록 밖일 때 심는 값이다. */
  readonly fallback: string;
}

/**
 * `<html>`에 실리는 설정 data 속성 전체다.
 *
 * `attribute`는 설정 화면 버튼의 `data-option` 값과 짝을 이룬다.
 * 예: `data-page-transition` ↔ `data-option="page-transition"`.
 */
export const SETTINGS_DATASET = {
  themeMode: {
    key: "themeMode",
    attribute: "data-theme-mode",
    values: THEME_MODES,
    fallback: "system",
  },
  accent: {
    key: "accent",
    attribute: "data-accent",
    values: ACCENT_KEYS,
    fallback: DEFAULT_ACCENT,
  },
  motion: {
    key: "motion",
    attribute: "data-motion",
    values: MOTION_PREFERENCES,
    fallback: DEFAULT_MOTION,
  },
  pageTransition: {
    key: "pageTransition",
    attribute: "data-page-transition",
    values: PAGE_TRANSITIONS,
    fallback: DEFAULT_PAGE_TRANSITION,
  },
  fabMode: {
    key: "fabMode",
    attribute: "data-fab-mode",
    values: FAB_MODES,
    fallback: DEFAULT_FAB_MODE,
  },
  quickMenuAnimation: {
    key: "quickMenuAnimation",
    attribute: "data-quick-menu-animation",
    values: FAB_ANIMS,
    fallback: DEFAULT_FAB_ANIM,
  },
  chatLayout: {
    key: "chatLayout",
    attribute: "data-chat-layout",
    values: CHAT_LAYOUTS,
    fallback: DEFAULT_CHAT_LAYOUT,
  },
  glow: {
    key: "glow",
    attribute: "data-glow",
    values: BOOLEAN_VALUES,
    fallback: String(DEFAULT_GLOW),
  },
  chatFont: {
    key: "chatFont",
    attribute: "data-chat-font",
    values: CHAT_FONTS,
    fallback: DEFAULT_CHAT_FONT,
  },
  chatFontSize: {
    key: "chatFontSize",
    attribute: "data-chat-font-size",
    values: CHAT_FONT_SIZE_KEYS,
    fallback: DEFAULT_CHAT_FONT_SIZE,
  },
  chatTone: {
    key: "chatTone",
    attribute: "data-chat-tone",
    values: TONES,
    fallback: DEFAULT_TONE,
  },
  chatStreaming: {
    key: "chatStreaming",
    attribute: "data-chat-streaming",
    values: BOOLEAN_VALUES,
    fallback: String(DEFAULT_STREAMING),
  },
  chatTextAnimation: {
    key: "chatTextAnimation",
    attribute: "data-chat-text-animation",
    values: CHAT_STREAM_ANIMATIONS,
    fallback: DEFAULT_CHAT_STREAM_ANIMATION,
  },
  chatPanelAnimation: {
    key: "chatPanelAnimation",
    attribute: "data-chat-panel-animation",
    values: CHAT_ANIMATIONS,
    fallback: DEFAULT_CHAT_ANIMATION,
  },
} as const satisfies Record<string, SettingsDatasetEntry>;

/** 설정 화면 CSS 생성과 검증에 쓰는 순회용 목록이다. */
export const SETTINGS_DATASET_ENTRIES: readonly SettingsDatasetEntry[] =
  Object.values(SETTINGS_DATASET);

/** ThemeContext가 쥔 설정 중 data 속성으로 나가는 값이다. */
export interface ThemeDatasetState {
  mode: string;
  accent: string;
  motion: string;
  pageTransition: string;
  fabMode: string;
  fabAnim: string;
  chatLayout: string;
  chatFont: string;
  chatFontSize: string;
  glow: boolean;
}

/** ChatProvider가 쥔 설정 중 data 속성으로 나가는 값이다. */
export interface ChatDatasetState {
  tone: string;
  streamingEnabled: boolean;
  streamAnimation: string;
  chatAnimation: string;
}

/**
 * ThemeContext 상태를 `<html>` data 속성 값으로 옮긴다.
 * 부트 스크립트가 심는 것과 같은 키·같은 값이라, 나중에 덮어써도 화면은 그대로다.
 */
export function themeSettingsDataset(
  state: ThemeDatasetState,
): Record<string, string> {
  return {
    [SETTINGS_DATASET.themeMode.key]: state.mode,
    [SETTINGS_DATASET.accent.key]: state.accent,
    [SETTINGS_DATASET.motion.key]: state.motion,
    [SETTINGS_DATASET.pageTransition.key]: state.pageTransition,
    [SETTINGS_DATASET.fabMode.key]: state.fabMode,
    [SETTINGS_DATASET.quickMenuAnimation.key]: state.fabAnim,
    [SETTINGS_DATASET.chatLayout.key]: state.chatLayout,
    [SETTINGS_DATASET.glow.key]: String(state.glow),
    [SETTINGS_DATASET.chatFont.key]: state.chatFont,
    [SETTINGS_DATASET.chatFontSize.key]: state.chatFontSize,
  };
}

/** ChatProvider 상태를 `<html>` data 속성 값으로 옮긴다. */
export function chatSettingsDataset(
  state: ChatDatasetState,
): Record<string, string> {
  return {
    [SETTINGS_DATASET.chatTone.key]: state.tone,
    [SETTINGS_DATASET.chatStreaming.key]: String(state.streamingEnabled),
    [SETTINGS_DATASET.chatTextAnimation.key]: state.streamAnimation,
    [SETTINGS_DATASET.chatPanelAnimation.key]: state.chatAnimation,
  };
}

/**
 * 각 값의 복원을 신뢰하는 스키마 버전이다.
 *
 * `ThemeContext` 복원 effect의 버전 조건과 반드시 같아야 한다. 어긋나면 부트
 * 스크립트가 넣은 값을 effect가 다른 값으로 덮어써서, 없애려던 깜빡임을
 * 오히려 만든다. fabAnim에서 v3이 빠진 것도 원본 조건 그대로다.
 */
const MOTION_VERSIONS = [2, 3, 4, 5, 6, 7, 8];
const FAB_MODE_VERSIONS = [3, 4, 5, 6, 7, 8];
const FAB_ANIM_VERSIONS = [2, 4, 5, 6, 7, 8];
const PAGE_TRANSITION_VERSIONS = [5, 6, 7, 8];
const CHAT_LAYOUT_VERSIONS = [6, 7, 8];
const CHAT_DOCK_WIDTH_VERSIONS = [7, 8];
const CHAT_FONT_VERSIONS = [8];

/**
 * 인라인 스크립트 안에 값을 박아 넣는다.
 * `<`를 이스케이프해, 값에 `</script>`가 섞여 스크립트가 조기에 닫히는 사고를
 * 원천 차단한다(지금 값에는 없지만 표는 앞으로도 늘어난다).
 */
function inlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** 부트 스크립트가 쓰는 색값만 남긴 표다. 표시 이름은 화면과 무관해 뺀다. */
const BOOT_ACCENTS = Object.fromEntries(
  Object.entries(ACCENTS).map(([key, { color, color2, soft, contrast }]) => [
    key,
    { color, color2, soft, contrast },
  ]),
);

/** 부트 스크립트가 값 검증에 쓰는 축약 표다(허용 목록 a, 기본값 f). */
const BOOT_DATASET = Object.fromEntries(
  SETTINGS_DATASET_ENTRIES.map((entry) => [
    entry.key,
    { a: entry.values, f: entry.fallback },
  ]),
);

const K = SETTINGS_DATASET;

/**
 * 하이드레이션 전에 저장된 설정을 문서 루트에 바르는 인라인 스크립트다.
 *
 * HTML 파싱 중 동기로 실행되므로 첫 페인트보다 앞선다. 저장값이 없거나
 * 깨졌거나 localStorage를 쓸 수 없으면 각 항목의 기본값을 심는다. 속성이 늘
 * 하나씩 있어야 설정 화면 CSS가 언제나 정확히 하나를 선택하기 때문이다.
 *
 * 값 판정은 `SETTINGS_DATASET`의 허용 목록과 `ThemeContext` 복원 effect의
 * 스키마 버전 조건을 그대로 따라간다. 배열 `indexOf`로만 판정하므로
 * `__proto__` 같은 키가 표를 뚫지 못한다.
 */
export const THEME_BOOT_SCRIPT = [
  "(function(){try{",
  `var r=document.documentElement,d=r.dataset,S=${inlineJson(BOOT_DATASET)};`,
  "function get(k){try{return localStorage.getItem(k);}catch(e){return null;}}",
  'function put(k,v){d[k]=(typeof v==="string"&&S[k].a.indexOf(v)!==-1)?v:S[k].f;}',
  `put(${inlineJson(K.themeMode.key)},get(${inlineJson(THEME_MODE_STORAGE_KEY)}));`,
  `put(${inlineJson(K.chatTone.key)},get(${inlineJson(TONE_STORAGE_KEY)}));`,
  `put(${inlineJson(K.chatStreaming.key)},get(${inlineJson(STREAMING_STORAGE_KEY)}));`,
  `put(${inlineJson(K.chatTextAnimation.key)},get(${inlineJson(STREAM_ANIMATION_STORAGE_KEY)}));`,
  `put(${inlineJson(K.chatPanelAnimation.key)},get(${inlineJson(CHAT_ANIMATION_STORAGE_KEY)}));`,
  "var s=null;",
  `try{var raw=get(${inlineJson(THEME_STORAGE_KEY)});if(raw){var p=JSON.parse(raw);if(p&&typeof p==="object")s=p;}}catch(e){}`,
  "var v=s?s.v:null;",
  "function ver(list){return list.indexOf(v)!==-1;}",
  "function val(list,name){return(s&&ver(list))?s[name]:null;}",
  `put(${inlineJson(K.accent.key)},s?s.accent:null);`,
  `put(${inlineJson(K.motion.key)},val(${inlineJson(MOTION_VERSIONS)},"motion"));`,
  `put(${inlineJson(K.pageTransition.key)},val(${inlineJson(PAGE_TRANSITION_VERSIONS)},"pageTransition"));`,
  `put(${inlineJson(K.fabMode.key)},val(${inlineJson(FAB_MODE_VERSIONS)},"fabMode"));`,
  `var fa=val(${inlineJson(FAB_ANIM_VERSIONS)},"fabAnim");`,
  `put(${inlineJson(K.quickMenuAnimation.key)},fa==="fade"?"blur":fa);`,
  `put(${inlineJson(K.chatLayout.key)},val(${inlineJson(CHAT_LAYOUT_VERSIONS)},"chatLayout"));`,
  `put(${inlineJson(K.glow.key)},(s&&typeof s.glow==="boolean")?String(s.glow):null);`,
  `put(${inlineJson(K.chatFont.key)},val(${inlineJson(CHAT_FONT_VERSIONS)},"chatFont"));`,
  `put(${inlineJson(K.chatFontSize.key)},val(${inlineJson(CHAT_FONT_VERSIONS)},"chatFontSize"));`,
  `var a=${inlineJson(BOOT_ACCENTS)}[d.${K.accent.key}];`,
  'r.style.setProperty("--accent",a.color);',
  'r.style.setProperty("--accent-2",a.color2);',
  'r.style.setProperty("--accent-soft",a.soft);',
  'r.style.setProperty("--accent-contrast",a.contrast);',
  `var w=${CHAT_DOCK_DEFAULT_WIDTH};`,
  `if(s&&ver(${inlineJson(CHAT_DOCK_WIDTH_VERSIONS)})&&typeof s.chatDockWidth==="number"&&isFinite(s.chatDockWidth))w=Math.round(Math.min(${CHAT_DOCK_MAX_WIDTH},Math.max(${CHAT_DOCK_MIN_WIDTH},s.chatDockWidth)));`,
  'r.style.setProperty("--chat-dock-width",w+"px");',
  `r.style.setProperty("--chat-font-family",${inlineJson(CHAT_FONT_FAMILIES)}[d.${K.chatFont.key}]);`,
  `var z=${inlineJson(CHAT_FONT_SIZES)}[d.${K.chatFontSize.key}];`,
  'r.style.setProperty("--chat-body-font-size",z.body);',
  'r.style.setProperty("--chat-control-font-size",z.control);',
  "}catch(e){}})();",
].join("\n");
