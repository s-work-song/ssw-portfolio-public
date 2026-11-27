'use client';

/**
 * 화면 위로 눈 결정을 내리는 레이어다. 아래 조건이 모두 맞을 때만 새 눈을 내린다.
 * - 지금 테마가 눈이 있는 테마다(`data-season`이 SNOW_THEME_IDS 안).
 * - 설정의 눈 내리기가 켜져 있다(`data-season-snow="true"`).
 * - 사이트 모션 설정이 움직임을 허용한다. 사이트의 다른 연출과 같은 규칙이다:
 *   "항상 끔"이면 멈추고, "시스템 따름"이면 운영체제의 모션 줄이기를 따르며,
 *   "항상 켬"(기본)이면 내린다. 눈은 설정의 눈 내리기로 따로 끌 수 있다.
 *   모션 판정과 구독은 썰매 레이어와 같이 쓴다(`seasonMotion`).
 *
 * 클릭·스크롤·키보드를 막지 않도록 pointer-events를 끄고, 스크린 리더에서 뺀다.
 * 눈송이 수는 화면 넓이로 정한 최대 수에 설정의 눈 양(적게 25%·보통 50%·많이 100%, seasonSnowFactor)을
 * 곱해 정한다. 카드 뒤로 숨기면 카드에 가려지는 몫을 감안해 두 배로 내린다.
 * 첫 방문과 새로고침에도 다른 시작과 마찬가지로 화면 위에서부터 새 눈을 보낸다.
 * 눈이 없던 상태에서 시작할 때는 짧게 몰리지 않도록 화면 높이에 맞춘 간격으로 내린다.
 * 양이 줄거나 눈을 끄면 기존 눈을 떨어지는 도중 서서히 흐리게 한다.
 * 모션을 끄면 즉시 멈춘다. 눈이 다 사라지면 프레임을 더 요청하지 않는다.
 * 카드 뒤 모드를 켜면 앞에 있던 눈만 뒤쪽으로 페이드한다. 뒤에 있는 동안은 카드가 자연스럽게 가린다.
 * 모드를 끄면 뒤에서 내리던 눈은 그대로 두고 새 눈송이부터 앞에 그린다.
 *
 * 스크롤: 캔버스는 화면에 고정이지만 눈송이는 페이지에 붙어 있는 것처럼 스크롤한 만큼 반대로 옮긴다.
 * 화면 밖으로 밀려난 눈송이는 반대쪽 끝으로 돌려 보내 수를 그대로 둔다. 그래서 스크롤해도 눈이
 * 화면을 따라오지 않고, 내려가면 위쪽 눈은 위로 지나가고 아래에서 새 눈이 보인다.
 * 낙엽·벚꽃·비와 같은 처리(`particleScrollShift`)를 쓴다.
 *
 * 결정 모양은 크기별로 한 번만 그려 둔 그림(스프라이트)을 돌리고 옮겨 찍는다.
 * 매 프레임 선을 다시 긋지 않으므로 결정이 커져도 그리는 비용이 크게 늘지 않는다.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { SEASON_CHANGE_EVENT } from './SeasonController';
import { SNOW_THEME_IDS, seasonSnowflakeCount } from './seasonPolicy';
import { rootMotionAllowed, subscribeSeasonMotion } from './seasonMotion';
import { advanceParticleFrontShare, changeParticlePlane, splitParticleAlpha, type ParticlePlane } from './particles/particlePlaneTransition';
import { createParticleDensityTransition } from './particles/particleDensityTransition';
import { createParticleSurface, paintParticleSprite, ParticleCanvases, prepareParticleSurface } from './particles/ParticleCanvases';
import { shiftParticleY, trackParticleScroll } from './particles/particleScrollShift';
import { SNOW_PARTICLE_TIMING } from './snowParticleTiming';
import { makeSnowCrystalSprite, makeSnowFlake, SNOW_CRYSTAL_SIZES, type SnowFlake } from './snowParticles';

const serverSnapshot = () => false;

function SnowCanvas() {
  const frontRef = useRef<HTMLCanvasElement>(null);
  const backRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const front = createParticleSurface(frontRef.current);
    const back = createParticleSurface(backRef.current);
    if (!front || !back) return;
    const surfaces = { front, back };

    let width = 0;
    let height = 0;
    let ratio = 1;
    const flakes: SnowFlake[] = [];
    let color = 'rgba(255,255,255,0.9)';
    let sprites: HTMLCanvasElement[] = [];
    let frame: number | null = null;
    let last: number | null = null;
    let spawnPlane: ParticlePlane = 'front';

    const currentCount = () => {
      const { season, seasonSnow, seasonSnowAmount } = document.documentElement.dataset;
      if (seasonSnow !== 'true' || !SNOW_THEME_IDS.includes(season ?? '')) return 0;
      return seasonSnowflakeCount(width, height, seasonSnowAmount, spawnPlane === 'back');
    };
    const density = createParticleDensityTransition(0, SNOW_PARTICLE_TIMING);

    const updateDensity = () => {
      const nextBehindCards = document.documentElement.dataset.seasonSnowBehindCards === 'true';
      if (nextBehindCards !== (spawnPlane === 'back')) {
        spawnPlane = changeParticlePlane(nextBehindCards, flakes);
      }
      density.setTarget(currentCount(), flakes.length, height);
    };

    const buildSprites = () => {
      sprites = SNOW_CRYSTAL_SIZES.map((radius) => makeSnowCrystalSprite(radius, color, ratio));
    };

    const readColor = () => {
      color = getComputedStyle(document.documentElement).getPropertyValue('--season-snow').trim() || color;
      buildSprites();
    };

    const resize = () => {
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      updateDensity();
      buildSprites();
    };

    const draw = (now: number) => {
      frame = null;
      // 탭을 오래 가렸다 돌아오면 큰 한 걸음으로 튀지 않게 자른다.
      const dt = last === null ? 0 : Math.min((now - last) / 1000, 0.05);
      last = now;
      density.step(flakes, dt, () => makeSnowFlake(width, spawnPlane));
      const shift = scroll.take();
      const pixelWidth = Math.round(width * ratio);
      const pixelHeight = Math.round(height * ratio);
      prepareParticleSurface(front, flakes.some((flake) => flake.plane === 'front' || flake.frontShare > 0), pixelWidth, pixelHeight);
      prepareParticleSurface(back, flakes.some((flake) => flake.plane === 'back'), pixelWidth, pixelHeight);
      for (let i = 0; i < flakes.length; i += 1) {
        const flake = flakes[i];
        const radius = SNOW_CRYSTAL_SIZES[flake.size];
        flake.y = shiftParticleY(flake.y, shift, radius, height);
        flake.y += flake.speed * dt;
        flake.phase += dt * 0.8;
        flake.angle += flake.spin * dt;
        if (flake.frontShare > 0) flake.frontShare = advanceParticleFrontShare(flake.frontShare, dt);
        if (flake.y - radius > height) {
          if (!density.isRetiring(i)) {
            const next = makeSnowFlake(width, spawnPlane);
            next.visibility = flake.visibility;
            flakes[i] = next;
          }
          continue;
        }
        if (flake.visibility === 0 || flake.y < -radius) continue;
        const sprite = sprites[flake.size];
        const x = flake.x + Math.sin(flake.phase) * flake.sway;
        const cos = Math.cos(flake.angle) * ratio;
        const sin = Math.sin(flake.angle) * ratio;
        const alpha = flake.alpha * flake.visibility * flake.visibility * (3 - 2 * flake.visibility);
        if (flake.frontShare > 0) {
          const blend = splitParticleAlpha(alpha, flake.frontShare);
          paintParticleSprite(front.context, sprite, blend.front, cos, sin, x, flake.y, ratio);
          paintParticleSprite(back.context, sprite, blend.back, cos, sin, x, flake.y, ratio);
        } else {
          paintParticleSprite(surfaces[flake.plane].context, sprite, alpha, cos, sin, x, flake.y, ratio);
        }
      }
      requestDraw();
      if (frame === null) last = null;
    };

    const requestDraw = () => {
      if (frame === null && density.hasWork(flakes.length)) frame = window.requestAnimationFrame(draw);
    };

    const onSeasonChange = () => {
      updateDensity();
      requestDraw();
    };

    const onResize = () => {
      resize();
      requestDraw();
    };

    // 라이트·다크가 바뀌면 눈 색을 다시 읽고 결정 그림을 다시 만든다.
    const themeObserver = new MutationObserver(readColor);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    resize();
    readColor();
    const scroll = trackParticleScroll(() => flakes.length > 0);
    window.addEventListener('resize', onResize);
    window.addEventListener(SEASON_CHANGE_EVENT, onSeasonChange);
    requestDraw();

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      scroll.destroy();
      window.removeEventListener(SEASON_CHANGE_EVENT, onSeasonChange);
      themeObserver.disconnect();
      prepareParticleSurface(front, false, 0, 0);
      prepareParticleSurface(back, false, 0, 0);
    };
  }, []);

  return <ParticleCanvases effect="snow" frontRef={frontRef} backRef={backRef} />;
}

export default function SnowLayer() {
  // 시즌·눈 설정이 바뀌어도 캔버스는 페이드가 끝날 때까지 유지한다. 모션 끄기는 즉시 적용한다.
  const motionAllowed = useSyncExternalStore(subscribeSeasonMotion, rootMotionAllowed, serverSnapshot);
  return motionAllowed ? <SnowCanvas /> : null;
}
