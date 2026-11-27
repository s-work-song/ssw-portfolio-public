export type ParticlePlane = 'front' | 'back';

type ParticlePlaneState = { plane: ParticlePlane; frontShare: number };
const FADE_TO_BACK_SECONDS = 0.35;

/** 앞에 있던 입자만 뒤로 옮길 때 페이드한다. 해제하면 새 입자만 앞으로 보낸다. */
export function changeParticlePlane(behindCards: boolean, particles: ParticlePlaneState[]): ParticlePlane {
  if (!behindCards) return 'front';
  for (const particle of particles) {
    if (particle.plane === 'front') {
      particle.plane = 'back';
      particle.frontShare = 1;
    }
  }
  return 'back';
}

export function advanceParticleFrontShare(share: number, seconds: number): number {
  return Math.max(0, share - seconds / FADE_TO_BACK_SECONDS);
}

/** 앞쪽 잔상이 흐려지는 만큼 뒤쪽을 그려, 카드가 없는 곳에서 겹쳐 밝아지는 것을 막는다. */
export function splitParticleAlpha(alpha: number, frontShare: number): { front: number; back: number } {
  const front = alpha * frontShare * frontShare * (3 - 2 * frontShare);
  const back = front === 1 ? 0 : (alpha - front) / (1 - front);
  return { front, back };
}
