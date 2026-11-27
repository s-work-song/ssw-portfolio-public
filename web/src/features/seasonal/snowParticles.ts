import type { ParticlePlane } from './particles/particlePlaneTransition';

export const SNOW_CRYSTAL_SIZES = [5, 7, 9, 12, 15];
const CRYSTAL_WEIGHTS = [0.3, 0.27, 0.2, 0.15, 0.08];

export interface SnowFlake {
  x: number;
  y: number;
  size: number;
  speed: number;
  sway: number;
  phase: number;
  angle: number;
  spin: number;
  alpha: number;
  visibility: number;
  plane: ParticlePlane;
  frontShare: number;
}

function pickSize(): number {
  let roll = Math.random();
  for (let i = 0; i < SNOW_CRYSTAL_SIZES.length; i += 1) {
    roll -= CRYSTAL_WEIGHTS[i];
    if (roll <= 0) return i;
  }
  return 0;
}

export function makeSnowFlake(width: number, plane: ParticlePlane): SnowFlake {
  const size = pickSize();
  const radius = SNOW_CRYSTAL_SIZES[size];
  return {
    x: Math.random() * width,
    y: -radius * 2,
    size,
    speed: 22 + radius * 3.2 + Math.random() * 14,
    sway: 8 + Math.random() * 18,
    phase: Math.random() * Math.PI * 2,
    angle: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 0.9,
    alpha: 0.4 + Math.random() * 0.4,
    visibility: 1,
    plane,
    frontShare: 0,
  };
}

/** 사이트와 스타일 가이드에서 같은 여섯 갈래 눈 결정을 한 번만 그려 재사용한다. */
export function makeSnowCrystalSprite(radius: number, color: string, ratio: number): HTMLCanvasElement {
  const pad = 2;
  const side = Math.ceil((radius + pad) * 2 * ratio);
  const sprite = document.createElement('canvas');
  sprite.width = side;
  sprite.height = side;
  const context = sprite.getContext('2d');
  if (!context) return sprite;
  context.scale(ratio, ratio);
  context.translate(radius + pad, radius + pad);
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineCap = 'round';
  context.lineWidth = Math.max(1, radius / 7);
  for (let arm = 0; arm < 6; arm += 1) {
    context.save();
    context.rotate((Math.PI / 3) * arm);
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(0, -radius);
    for (const [at, length] of [[0.45, 0.3], [0.72, 0.22]] as const) {
      const y = -radius * at;
      const branch = radius * length;
      context.moveTo(0, y);
      context.lineTo(-branch * 0.8, y - branch * 0.75);
      context.moveTo(0, y);
      context.lineTo(branch * 0.8, y - branch * 0.75);
    }
    context.stroke();
    context.restore();
  }
  context.beginPath();
  for (let corner = 0; corner < 6; corner += 1) {
    const theta = (Math.PI / 3) * corner + Math.PI / 6;
    const r = radius * 0.16;
    if (corner === 0) context.moveTo(Math.cos(theta) * r, Math.sin(theta) * r);
    else context.lineTo(Math.cos(theta) * r, Math.sin(theta) * r);
  }
  context.closePath();
  context.fill();
  return sprite;
}
