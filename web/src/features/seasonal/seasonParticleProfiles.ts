import { makeSnowCrystalSprite, makeSnowFlake, SNOW_CRYSTAL_SIZES, type SnowFlake } from './snowParticles.ts';
import { seasonSnowFactor, seasonSnowflakeCount } from './seasonPolicy.ts';
import { SEASON_WEATHER_EFFECTS } from './seasonWeatherPolicy.ts';
import { SNOW_PARTICLE_TIMING } from './snowParticleTiming.ts';
import type { ParticleDensityTiming } from '@/features/seasonal/particles/particleDensityTransition';
import type { ParticlePlane } from '@/features/seasonal/particles/particlePlaneTransition';

export const PARTICLE_PREVIEWS = [
  { id: 'snow', label: '눈', season: 'winter', description: '실제 사이트와 같은 여섯 갈래 눈송이가 천천히 내려옵니다.' },
  { id: 'leaves', label: '낙엽', season: SEASON_WEATHER_EFFECTS.leaves.season, description: '붉은 단풍잎과 금빛 잎이 바람에 밀려 돌면서 내려옵니다.' },
  { id: 'petals', label: '벚꽃', season: SEASON_WEATHER_EFFECTS.petals.season, description: '분홍 꽃잎이 작은 폭으로 흔들리며 가볍게 흩날립니다.' },
  { id: 'rain', label: '비', season: SEASON_WEATHER_EFFECTS.rain.season, description: '푸른 빗줄기가 바람을 타고 가느다란 사선으로 빠르게 내립니다.' },
] as const;

export type ParticlePreviewId = typeof PARTICLE_PREVIEWS[number]['id'];
export type PreviewParticle = SnowFlake & { drift: number };

const TIMINGS: Record<ParticlePreviewId, ParticleDensityTiming> = {
  snow: { startupRampSeconds: (height) => Math.max(2.4, height / 85), increaseSeconds: 1.2, fadeOutSeconds: 0.7 },
  leaves: { startupRampSeconds: () => 2.8, increaseSeconds: 1.1, fadeOutSeconds: 0.65 },
  petals: { startupRampSeconds: () => 2.6, increaseSeconds: 0.9, fadeOutSeconds: 0.55 },
  rain: { startupRampSeconds: () => 1.25, increaseSeconds: 0.7, fadeOutSeconds: 0.35 },
};

const SIZES: Record<ParticlePreviewId, readonly number[]> = {
  snow: SNOW_CRYSTAL_SIZES, leaves: [11, 13, 16, 15, 12, 17], petals: [6, 8, 9, 7, 10, 8], rain: [10, 13, 16, 19, 23],
};

export const particlePreviewTiming = (effect: ParticlePreviewId) => TIMINGS[effect];
const FIELD_TIMINGS: Record<ParticlePreviewId, ParticleDensityTiming> = {
  snow: SNOW_PARTICLE_TIMING,
  leaves: { ...TIMINGS.leaves, startupRampSeconds: (height) => Math.max(3, Math.min(12, height / 80)) },
  petals: { ...TIMINGS.petals, startupRampSeconds: (height) => Math.max(3, Math.min(13, height / 65)) },
  rain: { ...TIMINGS.rain, startupRampSeconds: (height) => Math.max(1.25, Math.min(4, height / 380)) },
};
export const seasonParticleTiming = (effect: ParticlePreviewId) => FIELD_TIMINGS[effect];
export const particlePreviewRadius = (effect: ParticlePreviewId, size: number) => SIZES[effect][size];

export function particlePreviewCount(effect: ParticlePreviewId, width: number, height: number, behind: boolean): number {
  const unitArea = { snow: 10000, leaves: 16000, petals: 9800, rain: 4700 }[effect];
  const minimum = { snow: 13, leaves: 10, petals: 14, rain: 28 }[effect];
  return Math.min(115, Math.max(minimum, Math.round(width * height / unitArea)) * (behind ? 2 : 1));
}

/** 전체 화면에서는 견본보다 밀도를 낮추고, DPR과 무관한 CSS 픽셀 넓이로 수를 정한다. */
export function seasonParticleCount(effect: ParticlePreviewId, width: number, height: number, amount: unknown, behind: boolean): number {
  if (effect === 'snow') return seasonSnowflakeCount(width, height, amount, behind);
  const profile = {
    leaves: { area: 23500, min: 7, max: 52 },
    petals: { area: 18000, min: 10, max: 66 },
    rain: { area: 12400, min: 13, max: 100 },
  }[effect];
  const maximum = Math.min(profile.max, Math.max(profile.min, width * height / profile.area) * 2);
  return Math.round(maximum * seasonSnowFactor(amount)) * (behind ? 2 : 1);
}

export function spawnPreviewParticle(effect: ParticlePreviewId, width: number, plane: ParticlePlane): PreviewParticle {
  if (effect === 'snow') return { ...makeSnowFlake(width, plane), drift: 0 };
  const size = Math.floor(Math.random() * SIZES[effect].length);
  const radius = SIZES[effect][size];
  const rain = effect === 'rain';
  const leaves = effect === 'leaves';
  const speed = rain ? 270 + Math.random() * 155 : (leaves ? 51 : 35) + Math.random() * 23;
  const drift = rain ? 55 + Math.random() * 52 : (leaves ? 17 : 6) + Math.random() * 22;
  return {
    x: Math.random() * width, y: -radius * 1.25, size, speed, drift,
    sway: rain ? 0 : (leaves ? 15 : 9) + Math.random() * 24,
    phase: Math.random() * Math.PI * 2,
    angle: rain ? Math.atan2(-drift, speed) : Math.random() * Math.PI * 2,
    spin: rain ? 0 : (Math.random() < 0.5 ? -1 : 1) * (0.55 + Math.random() * (leaves ? 1.4 : 0.8)),
    alpha: rain ? 0.45 + Math.random() * 0.42 : 0.65 + Math.random() * 0.29,
    visibility: 1, plane, frontShare: 0,
  };
}

const MAPLE = 'M 0 -1 L .21 -.61 .37 -.65 .31 -.31 .68 -.54 .68 -.35 .98 -.38 .81 -.02 .94 .09 .56 .36 .63 .51 .11 .45 .06 .84 -.07 .88 -.05 .44 -.61 .52 -.52 .35 -.94 .13 -.81 -.01 -.97 -.36 -.64 -.34 -.65 -.54 -.3 -.3 -.38 -.62 -.2 -.57 Z';
const OVAL_LEAF = 'M -.08 -1 C .47 -.8 .86 -.45 .65 .1 C .44 .61 .17 .66 -.07 .72 L -.13 .96 -.25 .94 -.18 .7 C -.59 .56 -.83 .22 -.65 -.23 C -.54 -.57 -.28 -.8 -.08 -1 Z';
const PETAL = 'M -.08 -.65 C .04 -.91 .44 -.96 .67 -.7 C .91 -.28 .59 .33 .03 .74 C -.44 .54 -.71 .11 -.69 -.33 C -.66 -.69 -.45 -.87 -.21 -.78 Z';

/** 스프라이트를 미리 그려 프레임마다 꽃잎·잎맥·빗줄기 경로를 다시 계산하지 않는다. */
export function buildPreviewSprites(effect: ParticlePreviewId, colors: CSSStyleDeclaration, ratio: number): HTMLCanvasElement[] {
  const token = (key: string, fallback: string) => colors.getPropertyValue(key).trim() || fallback;
  if (effect === 'snow') {
    return SNOW_CRYSTAL_SIZES.map((radius) => makeSnowCrystalSprite(radius, token('--season-snow', '#b8cce2'), ratio));
  }

  const mapleColors = [token('--season-maple-red', '#c8412f'), token('--season-maple-orange', '#e07b26'), token('--season-maple-yellow', '#e0aa2b')];
  const springPink = token('--season-blossom', '#f2a7bd');
  const springDeep = token('--season-blossom-deep', '#d66d8e');
  const rainBlue = token('--season-sea', '#2f7fb5');
  return SIZES[effect].map((radius, index) => {
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = Math.ceil((radius + 2) * 2 * ratio);
    const ctx = sprite.getContext('2d');
    if (!ctx) return sprite;
    ctx.translate(sprite.width / 2, sprite.height / 2);
    ctx.scale(radius * ratio, radius * ratio);
    ctx.lineCap = 'round';
    const wash = ctx.createLinearGradient(-0.4, -0.9, 0.2, 0.7);

    if (effect === 'rain') {
      wash.addColorStop(0, 'transparent');
      wash.addColorStop(1, rainBlue);
      ctx.strokeStyle = wash;
      ctx.lineWidth = index % 2 === 0 ? 0.092 : 0.065;
      ctx.beginPath();
      ctx.moveTo(0, -0.92);
      ctx.lineTo(0, 0.62);
      ctx.stroke();
    } else if (effect === 'leaves') {
      wash.addColorStop(0, mapleColors[index % 3]);
      wash.addColorStop(1, mapleColors[(index + 1) % 3]);
      ctx.fillStyle = wash;
      ctx.fill(new Path2D(index % 2 ? OVAL_LEAF : MAPLE));
      ctx.strokeStyle = 'rgba(81,39,23,0.42)';
      ctx.lineWidth = 0.055;
      ctx.stroke(new Path2D('M -.05 .6 L .02 -.64 M .0 .24 L -.42 -.2 M .0 .24 L .49 -.18'));
    } else {
      wash.addColorStop(0, index % 3 ? springPink : '#ffe1eb');
      wash.addColorStop(1, springDeep);
      ctx.fillStyle = wash;
      ctx.fill(new Path2D(PETAL));
      ctx.strokeStyle = 'rgba(255,236,245,0.52)';
      ctx.lineWidth = 0.07;
      ctx.stroke(new Path2D('M .03 .56 Q -.3 .12 -.26 -.28'));
    }
    return sprite;
  });
}
