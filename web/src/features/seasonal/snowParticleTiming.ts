import type { ParticleDensityTiming } from './particles/particleDensityTransition';

/** 눈의 낙하 속도에 맞춘 시작 간격이다. 다른 계절 효과는 자기 속도에 맞춰 별도로 정한다. */
export const SNOW_PARTICLE_TIMING = {
  startupRampSeconds: (viewportHeight) => Math.max(4, Math.min(12, viewportHeight / 75)),
  increaseSeconds: 1.2,
  fadeOutSeconds: 0.7,
} satisfies ParticleDensityTiming;
