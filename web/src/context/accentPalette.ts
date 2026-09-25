/**
 * 첫 페인트 전에 필요한 테마 토큰과, 그 토큰을 문서 루트에 미리 바르는
 * 부트 스크립트를 함께 쥔 순수 모듈이다.
 *
 * `ThemeContext`는 "use client" 모듈이라 서버 컴포넌트인 `app/layout`이 값을
 * 가져다 쓸 수 없다. 표를 런타임 의존이 없는 이 모듈로 내려 두면, 마운트 뒤에
 * 적용하는 Provider와 하이드레이션 전에 적용하는 인라인 스크립트가 표 하나를
 * 공유한다. 두 곳이 표를 따로 들면 저장된 값이 잠깐 다른 값으로 보이는
 * 깜빡임이 그대로 남는다.
 *
 * 허용 목록은 도구 스키마(`portfolio-tools/schema`)에서 파생하고 `satisfies`로
 * 못 박는다. 목록에 값을 더하고 이 표를 빠뜨리면 컴파일에서 걸린다.
 */
import type {
  PortfolioAccent,
  PortfolioChatFont,
  PortfolioChatFontSize,
  PortfolioChatLayout,
} from "../features/portfolio-tools/schema";

/** 포트폴리오 전용 테마 설정이 담기는 localStorage 키다. */
export const THEME_STORAGE_KEY = "swork-theme-custom";

/** 사이트 연출 정책의 허용값이다. `ThemeContext`의 MotionPreference가 여기서 파생한다. */
export const MOTION_PREFERENCES = ["system", "on", "off"] as const;

/** 페이지 전환 연출의 허용값이다. */
export const PAGE_TRANSITIONS = ["none", "slide", "fade", "lift"] as const;

/** 플로팅 버튼 동작의 허용값이다. */
export const FAB_MODES = ["chat", "quick-menu"] as const;

/** 빠른 메뉴 등장 연출의 허용값이다. */
export const FAB_ANIMS = ["none", "rise", "slide", "pop", "blur"] as const;

/** 켬/끔 설정을 data 속성에 실을 때 쓰는 문자열이다. */
export const BOOLEAN_VALUES = ["true", "false"] as const;

/**
 * 저장값이 없거나 못 믿을 때 쓰는 기본값이다.
 *
 * `ThemeContext`의 useState 초깃값과 부트 스크립트가 같은 상수를 보게 해서,
 * 한쪽만 바뀌어 첫 페인트와 복원 결과가 어긋나는 일을 막는다.
 */
export const DEFAULT_ACCENT: PortfolioAccent = "indigo";
export const DEFAULT_MOTION: (typeof MOTION_PREFERENCES)[number] = "on";
export const DEFAULT_CHAT_FONT: PortfolioChatFont = "pretendard";
export const DEFAULT_CHAT_FONT_SIZE: PortfolioChatFontSize = "medium";
export const DEFAULT_PAGE_TRANSITION: (typeof PAGE_TRANSITIONS)[number] = "fade";
export const DEFAULT_FAB_MODE: (typeof FAB_MODES)[number] = "chat";
export const DEFAULT_FAB_ANIM: (typeof FAB_ANIMS)[number] = "slide";
export const DEFAULT_CHAT_LAYOUT: PortfolioChatLayout = "floating";
export const DEFAULT_GLOW = true;

/** 포인트 색상 하나가 공급하는 CSS 변수값과 표시 이름이다. */
export interface AccentPalette {
  color: string;
  color2: string;
  soft: string;
  contrast: string;
  label: string;
}

/**
 * 포인트 색상별 실제 색값과 표시 이름이다.
 *
 * indigo는 저장값이 없을 때의 기본색이라 `globals.css`의 `:root` 기본 변수와
 * 값이 같아야 한다. 한쪽만 고치면 저장값이 없는 첫 방문에서 색이 어긋난다.
 */
export const ACCENTS = {
  indigo: { color: "#6366f1", color2: "#818cf8", soft: "rgba(99,102,241,0.14)", contrast: "#ffffff", label: "인디고" },
  emerald: { color: "#059669", color2: "#34d399", soft: "rgba(16,185,129,0.14)", contrast: "#ffffff", label: "에메랄드" },
  amber: { color: "#d97706", color2: "#fbbf24", soft: "rgba(217,119,6,0.15)", contrast: "#2a1602", label: "앰버" },
  rose: { color: "#e11d48", color2: "#fb7185", soft: "rgba(225,29,72,0.14)", contrast: "#ffffff", label: "로즈" },
  violet: { color: "#7c3aed", color2: "#a78bfa", soft: "rgba(124,58,237,0.14)", contrast: "#ffffff", label: "바이올렛" },
} satisfies Record<PortfolioAccent, AccentPalette>;

/** 고정 패널 너비의 하한·상한·기본값이다(px). */
export const CHAT_DOCK_MIN_WIDTH = 340;
export const CHAT_DOCK_MAX_WIDTH = 640;
export const CHAT_DOCK_DEFAULT_WIDTH = 440;

/**
 * 고정 패널 너비를 허용 범위 안의 정수로 맞춘다.
 *
 * 드래그·키보드 조절과 저장소에서 읽은 값이 모두 이 함수를 지나므로,
 * 화면 밖으로 나가거나 NaN이 된 너비가 CSS 변수로 새지 않는다.
 * 부트 스크립트도 같은 계산을 인라인으로 재현한다.
 */
export function normalizeChatDockWidth(width: number): number {
  if (!Number.isFinite(width)) return CHAT_DOCK_DEFAULT_WIDTH;
  return Math.round(
    Math.min(CHAT_DOCK_MAX_WIDTH, Math.max(CHAT_DOCK_MIN_WIDTH, width)),
  );
}

/** 채팅 글꼴 선택값에서 실제 font-family 문자열로 가는 표다. */
export const CHAT_FONT_FAMILIES = {
  pretendard: "'Pretendard', system-ui, -apple-system, sans-serif",
  "noto-sans-kr":
    "var(--font-noto-sans-kr), 'Noto Sans KR', system-ui, -apple-system, sans-serif",
  system: "system-ui, -apple-system, 'Segoe UI', sans-serif",
} satisfies Record<PortfolioChatFont, string>;

/** 글자 크기 선택값에서 본문·컨트롤 폰트 크기로 가는 표다. */
export const CHAT_FONT_SIZES = {
  small: { body: "13px", control: "11px" },
  medium: { body: "14px", control: "12px" },
  large: { body: "16px", control: "14px" },
  xlarge: { body: "18px", control: "16px" },
} satisfies Record<PortfolioChatFontSize, { body: string; control: string }>;
