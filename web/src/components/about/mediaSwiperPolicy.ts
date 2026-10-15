/** 사이트 모션 설정을 Swiper의 실제 전환 시간에도 적용합니다. */
export function mediaSwiperSpeed(motion: 'system' | 'on' | 'off', systemReduced: boolean): number {
  return motion === 'off' || (motion !== 'on' && systemReduced) ? 0 : 380;
}

/** 복제/트랙 위치가 아닌 라이브러리의 원본 realIndex만 외부 데이터에 연결합니다. */
export function mediaSlideIndex(index: number, count: number): number | null {
  return Number.isInteger(index) && index >= 0 && index < count ? index : null;
}
