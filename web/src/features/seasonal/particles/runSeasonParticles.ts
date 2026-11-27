import { createParticleDensityTransition } from '@/features/seasonal/particles/particleDensityTransition';
import { advanceParticleFrontShare, changeParticlePlane, splitParticleAlpha, type ParticlePlane } from '@/features/seasonal/particles/particlePlaneTransition';
import { createParticleSurface, paintParticleSprite, prepareParticleSurface } from '@/features/seasonal/particles/ParticleCanvases';
import { shiftParticleY, trackParticleScroll } from '@/features/seasonal/particles/particleScrollShift';
import { buildPreviewSprites, particlePreviewCount, particlePreviewRadius, particlePreviewTiming, seasonParticleCount, seasonParticleTiming, spawnPreviewParticle, type ParticlePreviewId, type PreviewParticle } from '../seasonParticleProfiles';

/** 요소 안의 견본과 전체 화면이 같은 입자 모양·수명·앞뒤 전환을 쓴다. */
export function runSeasonParticles(stage: HTMLElement, frontCanvas: HTMLCanvasElement | null, backCanvas: HTMLCanvasElement | null,
  effect: ParticlePreviewId, scope: 'container' | 'viewport' = 'container') {
  const front = createParticleSurface(frontCanvas);
  const back = createParticleSurface(backCanvas);
  if (!front || !back) return null;

  const surfaces = { front, back };
  const particles: PreviewParticle[] = [];
  const density = createParticleDensityTransition(0, scope === 'viewport' ? seasonParticleTiming(effect) : particlePreviewTiming(effect));
  let plane: ParticlePlane = 'front';
  let playing = false;
  let amount: unknown;
  let width = 0;
  let height = 0;
  let ratio = 1;
  let frame: number | null = null;
  let last: number | null = null;
  let sprites: HTMLCanvasElement[] = [];

  const rebuildSprites = () => { sprites = buildPreviewSprites(effect, getComputedStyle(stage), ratio); };

  function schedule() {
    if (frame === null && density.hasWork(particles.length)) frame = requestAnimationFrame(draw);
  }

  function updateCount() {
    const count = scope === 'viewport'
      ? seasonParticleCount(effect, width, height, amount, plane === 'back')
      : particlePreviewCount(effect, width, height, plane === 'back');
    density.setTarget(playing && width > 0 && height > 0 ? count : 0, particles.length, height);
    schedule();
  }

  function resize() {
    width = scope === 'viewport' ? window.innerWidth : stage.clientWidth;
    height = scope === 'viewport' ? window.innerHeight : stage.clientHeight;
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    rebuildSprites();
    updateCount();
  }

  function draw(now: number) {
    frame = null;
    const dt = last === null ? 0 : Math.min((now - last) / 1000, 0.05);
    last = now;
    density.step(particles, dt, () => spawnPreviewParticle(effect, width, plane));
    const shift = scroll ? scroll.take() : 0;
    const pixelsWide = Math.round(width * ratio);
    const pixelsHigh = Math.round(height * ratio);
    prepareParticleSurface(surfaces.front, particles.some((item) => item.plane === 'front' || item.frontShare > 0), pixelsWide, pixelsHigh);
    prepareParticleSurface(surfaces.back, particles.some((item) => item.plane === 'back'), pixelsWide, pixelsHigh);

    for (let index = 0; index < particles.length; index += 1) {
      const item = particles[index];
      const radius = particlePreviewRadius(effect, item.size);
      item.y = shiftParticleY(item.y, shift, radius, height);
      item.y += item.speed * dt;
      item.x += item.drift * dt;
      if (item.x > width + radius) item.x = -radius;
      item.phase += dt * 0.8;
      item.angle += item.spin * dt;
      if (item.frontShare > 0) item.frontShare = advanceParticleFrontShare(item.frontShare, dt);
      if (item.y - radius > height) {
        if (!density.isRetiring(index)) {
          const replacement = spawnPreviewParticle(effect, width, plane);
          replacement.visibility = item.visibility;
          particles[index] = replacement;
        }
        continue;
      }
      if (item.visibility === 0 || item.y < -radius) continue;

      const x = item.x + Math.sin(item.phase) * item.sway;
      const cos = Math.cos(item.angle) * ratio;
      const sin = Math.sin(item.angle) * ratio;
      const alpha = item.alpha * item.visibility * item.visibility * (3 - 2 * item.visibility);
      const sprite = sprites[item.size];
      if (item.frontShare > 0) {
        const blend = splitParticleAlpha(alpha, item.frontShare);
        paintParticleSprite(surfaces.front.context, sprite, blend.front, cos, sin, x, item.y, ratio);
        paintParticleSprite(surfaces.back.context, sprite, blend.back, cos, sin, x, item.y, ratio);
      } else {
        paintParticleSprite(surfaces[item.plane].context, sprite, alpha, cos, sin, x, item.y, ratio);
      }
    }

    schedule();
    if (frame === null) last = null;
  }

  resize();
  // 전체 화면 입자는 눈과 같이 페이지에 붙어 있는 것처럼 스크롤 반대로 옮긴다. 견본 상자는 요소와 함께 움직이므로 필요 없다.
  const scroll = scope === 'viewport' ? trackParticleScroll(() => particles.length > 0) : null;
  const sizeObserver = scope === 'container' ? new ResizeObserver(resize) : null;
  if (sizeObserver) sizeObserver.observe(stage);
  else window.addEventListener('resize', resize);
  const themeObserver = new MutationObserver(rebuildSprites);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  return {
    update(show: boolean, behind: boolean, nextAmount?: unknown) {
      playing = show;
      amount = nextAmount;
      if (behind !== (plane === 'back')) plane = changeParticlePlane(behind, particles);
      updateCount();
    },
    destroy() {
      if (frame !== null) cancelAnimationFrame(frame);
      scroll?.destroy();
      if (sizeObserver) sizeObserver.disconnect();
      else window.removeEventListener('resize', resize);
      themeObserver.disconnect();
      prepareParticleSurface(front, false, 0, 0);
      prepareParticleSurface(back, false, 0, 0);
    },
  };
}
