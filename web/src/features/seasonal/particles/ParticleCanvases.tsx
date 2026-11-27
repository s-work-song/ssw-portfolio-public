import type { RefObject } from 'react';
import styles from './ParticleCanvases.module.css';

type CanvasRef = RefObject<HTMLCanvasElement | null>;

export function ParticleCanvases({ effect, frontRef, backRef, scope = 'viewport' }: {
  effect: string; frontRef: CanvasRef; backRef: CanvasRef; scope?: 'viewport' | 'container';
}) {
  return (
    <>
      <canvas ref={frontRef} className={styles.canvas} data-season-particle={effect} data-season-particle-plane="front" data-season-particle-scope={scope} width={0} height={0} aria-hidden="true" />
      <canvas ref={backRef} className={styles.canvas} data-season-particle={effect} data-season-particle-plane="back" data-season-particle-scope={scope} width={0} height={0} aria-hidden="true" />
    </>
  );
}

type ParticleSurface = { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; active: boolean };

export function createParticleSurface(canvas: HTMLCanvasElement | null): ParticleSurface | null {
  const context = canvas?.getContext('2d');
  return canvas && context ? { canvas, context, active: false } : null;
}

/** 두 층을 모두 쓰는 전환 중에만 두 번째 캔버스에도 실제 픽셀을 할당한다. */
export function prepareParticleSurface(surface: ParticleSurface, active: boolean, width: number, height: number) {
  const { canvas, context } = surface;
  if (surface.active !== active) {
    surface.active = active;
    canvas.toggleAttribute('data-active', active);
    if (!active) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
  if (!active) return;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
}

export function paintParticleSprite(context: CanvasRenderingContext2D, sprite: HTMLCanvasElement, alpha: number,
  cos: number, sin: number, x: number, y: number, ratio: number) {
  if (alpha === 0) return;
  context.setTransform(cos, sin, -sin, cos, x * ratio, y * ratio);
  context.globalAlpha = alpha;
  context.drawImage(sprite, -sprite.width / 2 / ratio, -sprite.height / 2 / ratio, sprite.width / ratio, sprite.height / ratio);
}
