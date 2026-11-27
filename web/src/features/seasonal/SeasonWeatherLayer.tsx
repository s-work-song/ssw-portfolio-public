'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { SEASON_CHANGE_EVENT } from './SeasonController';
import { rootMotionAllowed, subscribeSeasonMotion } from './seasonMotion';
import { isSeasonWeatherEnabled, SEASON_WEATHER_IDS, type SeasonWeatherId } from './seasonWeatherPolicy';
import { ParticleCanvases } from './particles/ParticleCanvases';
import { runSeasonParticles } from './particles/runSeasonParticles';

const serverMotion = () => false;

function WeatherCanvases({ effect }: { effect: SeasonWeatherId }) {
  const frontRef = useRef<HTMLCanvasElement>(null);
  const backRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    let renderer: ReturnType<typeof runSeasonParticles> = null;

    const update = () => {
      const enabled = isSeasonWeatherEnabled(effect, root.dataset);
      if (enabled && !renderer) renderer = runSeasonParticles(root, frontRef.current, backRef.current, effect, 'viewport');
      renderer?.update(enabled, root.dataset.seasonSnowBehindCards === 'true', root.dataset.seasonSnowAmount);
    };

    update();
    window.addEventListener(SEASON_CHANGE_EVENT, update);
    return () => {
      window.removeEventListener(SEASON_CHANGE_EVENT, update);
      renderer?.destroy();
    };
  }, [effect]);

  return <ParticleCanvases effect={effect} frontRef={frontRef} backRef={backRef} />;
}

export default function SeasonWeatherLayer() {
  const motionAllowed = useSyncExternalStore(subscribeSeasonMotion, rootMotionAllowed, serverMotion);
  // 한 효과를 끄거나 테마를 바꿔도 그 효과의 마지막 입자는 페이드가 끝날 때까지 그린다.
  return motionAllowed ? SEASON_WEATHER_IDS.map((effect) => <WeatherCanvases key={effect} effect={effect} />) : null;
}
