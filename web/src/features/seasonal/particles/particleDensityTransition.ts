export type ParticleDensityTiming = {
  startupRampSeconds: (viewportHeight: number) => number;
  increaseSeconds: number;
  fadeOutSeconds: number;
};

type FadingParticle = { visibility: number };

/** 새 입자는 나눠 보내고, 줄일 몫은 움직이는 동안 투명하게 만든다. */
export function createParticleDensityTransition(initialCount: number, timing: ParticleDensityTiming, random = Math.random) {
  let targetCount = initialCount;
  let spawnRate = 0;
  let spawnCredit = 0;
  let nextSpawnCredit = 1;
  let spreadStartup = false;

  return {
    setTarget(count: number, currentCount: number, viewportHeight: number) {
      if (count === targetCount) return;
      spreadStartup = count > 0 && (targetCount === 0 || (spreadStartup && currentCount < targetCount));
      targetCount = count;
      spawnRate = spreadStartup
        ? Math.max(0, count - currentCount) / timing.startupRampSeconds(viewportHeight)
        : Math.max(4, (count - currentCount) / timing.increaseSeconds);
      spawnCredit = 0;
      // 첫 입자는 오래 기다리지 않게 하고, 이후 간격은 조금씩 달리한다.
      nextSpawnCredit = spreadStartup ? Math.min(1, spawnRate * 0.12) : 1;
    },
    isRetiring(index: number) {
      return index >= targetCount;
    },
    hasWork(currentCount: number) {
      return targetCount > 0 || currentCount > 0;
    },
    step<T extends FadingParticle>(particles: T[], seconds: number, spawn: () => T) {
      const fadeStep = seconds / timing.fadeOutSeconds;
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        particle.visibility = index >= targetCount
          ? Math.max(0, particle.visibility - fadeStep)
          : Math.min(1, particle.visibility + fadeStep);
      }
      while (particles.length > targetCount && particles.at(-1)?.visibility === 0) particles.pop();

      if (particles.length < targetCount) {
        spawnCredit += seconds * spawnRate;
        while (particles.length < targetCount && spawnCredit >= nextSpawnCredit) {
          particles.push(spawn());
          spawnCredit -= nextSpawnCredit;
          nextSpawnCredit = spreadStartup ? 0.65 + random() * 0.7 : 1;
        }
      }
    },
  };
}
