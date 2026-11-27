/**
 * 전체 화면 입자의 스크롤 처리다. 캔버스는 화면에 고정이지만 입자는 페이지에 붙어 있는 것처럼
 * 스크롤한 만큼 반대로 옮긴다. 화면 밖으로 밀려난 입자는 반대쪽 끝으로 돌려 보내 수를 그대로 둔다.
 */

/** 스크롤 이벤트 사이에 움직인 거리(px)를 모아 두었다가 다음 프레임에서 한 번에 꺼낸다. */
export function trackParticleScroll(hasParticles: () => boolean) {
  let last = window.scrollY;
  let pending = 0;
  const onScroll = () => {
    const scroll = window.scrollY;
    if (hasParticles()) pending += scroll - last;
    last = scroll;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  return {
    take() {
      const shift = pending;
      pending = 0;
      return shift;
    },
    destroy() {
      window.removeEventListener('scroll', onScroll);
    },
  };
}

/** 아직 화면 위에서 들어오지 않은 입자는 그대로 두고, 나머지는 위아래 여유 2r씩을 두고 감아 돌린다. */
export function shiftParticleY(y: number, shift: number, radius: number, height: number): number {
  if (shift === 0 || y < -radius) return y;
  const span = height + radius * 4;
  return ((((y - shift + radius * 2) % span) + span) % span) - radius * 2;
}
