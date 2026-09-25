/**
 * 채팅의 콘텐츠 이동 액션과 About 셸이 직접 결합되지 않도록 사용하는
 * 브라우저 이벤트 계약이다. 셸이 이벤트를 처리하면 preventDefault로
 * 처리 여부를 돌려주고, 처리하지 못한 화면에서는 ChatProvider가 라우팅한다.
 */
/**
 * 이동 요청을 알리는 이벤트다. cancelable이라 About 셸이 preventDefault로
 * "내가 처리했다"고 답하고, 아무도 막지 않으면 ChatProvider가 직접 라우팅한다.
 */
export const CHAT_ACTION_NAVIGATE_EVENT =
  "portfolio:chat-action-navigate";
/** 목적지 페이지가 실제로 그려졌음을 알린다. 이 신호가 와야 앵커 스크롤을 시작한다. */
export const CHAT_ACTION_PAGE_ENTERED_EVENT =
  "portfolio:chat-action-page-entered";
/** 앵커 요소까지 도착해 스크롤이 끝났음을 알린다. */
export const CHAT_ACTION_TARGET_ARRIVED_EVENT =
  "portfolio:chat-action-target-arrived";
/** 이동 연출이 끝난 뒤 채팅 입력창에 다시 초점을 돌려 달라는 신호다. 전달할 값이 없어 일반 Event로 보낸다. */
export const CHAT_ACTION_RESTORE_CHAT_INPUT_EVENT =
  "portfolio:chat-action-restore-input";

/**
 * 이동 요청에 실어 보내는 값이다.
 *
 * route는 해시까지 포함한 목적지이고, attractTab은 탭이 바뀌는 이동이라
 * 탭 전환 연출을 함께 재생해야 하는지를 알린다.
 */
export interface ChatActionNavigateDetail {
  route: string;
  attractTab: boolean;
}

/** 방금 들어온 페이지 경로다. 기다리던 경로와 같을 때만 앵커 스크롤로 넘어간다. */
export interface ChatActionPageEnteredDetail {
  path: string;
}

/** 도착한 앵커 요소의 id다. */
export interface ChatActionTargetArrivedDetail {
  anchor: string;
}

/**
 * 경로 끝의 슬래시를 떼어 비교 가능한 형태로 맞춘다.
 *
 * 링크와 라우터가 돌려주는 경로에 끝 슬래시가 붙기도 해 그대로 비교하면
 * 같은 위치를 다른 곳으로 본다. 루트("/")는 길이가 1이라 그대로 남긴다.
 */
export function normalizeNavigationPath(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/u, "") : path;
}

/**
 * 해시를 떼어 낸 경로만 돌려준다. 결과는 normalizeNavigationPath까지 거친 값이다.
 *
 * 해시가 없으면 경로 전체를 그대로 정규화한다.
 */
export function pathWithoutHash(route: string): string {
  const hashIndex = route.indexOf("#");
  return normalizeNavigationPath(
    hashIndex >= 0 ? route.slice(0, hashIndex) : route,
  );
}

/**
 * 현재 경로가 속한 About 대분류 탭을 반환한다.
 *
 * 하위 경로까지 그 탭에 속하는 것으로 보므로 `/about-me/log/view`는
 * `/about-me/log`를 돌려준다. 출발지와 목적지의 탭이 다를 때만 탭 전환 연출을
 * 재생하려고 쓰는 값이다. About 영역 밖이면 null이고, 이때는 연출 없이 이동한다.
 * 검사 순서상 하위 탭을 먼저 보고 마지막에 `/about-me` 자신을 확인한다.
 */
export function aboutTabPathFromPath(path: string): string | null {
  const normalizedPath = normalizeNavigationPath(path);
  const belongsTo = (tabPath: string) =>
    normalizedPath === tabPath || normalizedPath.startsWith(`${tabPath}/`);
  if (belongsTo("/about-me/resume")) {
    return "/about-me/resume";
  }
  if (belongsTo("/about-me/cover-letter")) {
    return "/about-me/cover-letter";
  }
  if (belongsTo("/about-me/research")) {
    return "/about-me/research";
  }
  if (belongsTo("/about-me/log")) {
    return "/about-me/log";
  }
  if (normalizedPath === "/about-me") return "/about-me";
  return null;
}
