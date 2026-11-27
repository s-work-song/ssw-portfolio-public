/**
 * 움직이는 시즌 레이어(눈 내리기 `SnowLayer`, 썰매 `SleighLayer`)가 함께 쓰는 판정 도우미다.
 *
 * 두 레이어는 같은 모션 규칙을 따라야 한다. 사이트의 다른 연출과 같은 규칙이다:
 * 모션 설정이 "항상 끔"이면 멈추고, "시스템 따름"이면 운영체제의 모션 줄이기를 따르며,
 * "항상 켬"(기본)이면 움직인다. 규칙을 한곳에 두어 레이어마다 어긋나지 않게 한다.
 *
 * 값의 출처는 부트 스크립트와 SeasonController가 심는 `<html>`의 data 속성이다.
 * 레이어는 `useSyncExternalStore(subscribeSeasonMotion, 판정)`으로 구독하고,
 * 판정 함수에서 테마 조건과 `rootMotionAllowed()`를 함께 본다.
 */

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** 모션 설정 값과 운영체제의 모션 줄이기 여부로 움직여도 되는지 정한다. */
export function motionAllowed(motion: string | undefined, prefersReducedMotion: boolean): boolean {
  return motion !== 'off' && !(motion === 'system' && prefersReducedMotion);
}

/** 문서 루트의 지금 모션 설정과 운영체제 설정으로 판정한다. 브라우저에서만 부른다. */
export function rootMotionAllowed(): boolean {
  return motionAllowed(document.documentElement.dataset.motion, window.matchMedia(REDUCED_MOTION_QUERY).matches);
}

/**
 * 시즌 레이어 판정에 쓰는 루트 속성(테마·눈 내리기·모션)과 모션 줄이기 설정의 변화를 구독한다.
 * 레이어마다 보는 속성이 조금 달라도 한 구독을 같이 쓴다. 판정 값이 그대로면 React가 다시 그리지 않는다.
 */
export function subscribeSeasonMotion(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-season', 'data-season-snow', 'data-motion'],
  });
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener('change', onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener('change', onChange);
  };
}
