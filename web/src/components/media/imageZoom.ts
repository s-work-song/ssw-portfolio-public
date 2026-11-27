export const MIN_IMAGE_ZOOM = 1;
export const MAX_IMAGE_ZOOM = 8;
export const FIT_IMAGE_TRANSFORM = { scale: 1, x: 0, y: 0 } as const;

export interface ImageGeometry {
  viewportWidth: number;
  viewportHeight: number;
  fittedWidth: number;
  fittedHeight: number;
}

export interface ImageTransform { scale: number; x: number; y: number }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;

export function fittedImageGeometry(width: number, height: number, naturalWidth: number, naturalHeight: number): ImageGeometry {
  const viewportWidth = Math.max(0, finite(width));
  const viewportHeight = Math.max(0, finite(height));
  const fit = naturalWidth > 0 && naturalHeight > 0
    ? Math.min(viewportWidth / naturalWidth, viewportHeight / naturalHeight) : 0;
  return { viewportWidth, viewportHeight, fittedWidth: naturalWidth * fit || 0, fittedHeight: naturalHeight * fit || 0 };
}

export function clampImageTransform(transform: ImageTransform, geometry: ImageGeometry): ImageTransform {
  const scale = clamp(finite(transform.scale, 1), MIN_IMAGE_ZOOM, MAX_IMAGE_ZOOM);
  if (scale === 1) return { ...FIT_IMAGE_TRANSFORM };
  const maxX = Math.max(0, (geometry.fittedWidth * scale - geometry.viewportWidth) / 2);
  const maxY = Math.max(0, (geometry.fittedHeight * scale - geometry.viewportHeight) / 2);
  return { scale, x: clamp(finite(transform.x), -maxX, maxX), y: clamp(finite(transform.y), -maxY, maxY) };
}

/** point는 뷰포트 중심 기준 좌표다. 가능한 범위 안에서 커서 아래의 이미지 지점을 유지한다. */
export function zoomImageAt(transform: ImageTransform, nextScale: number, point: { x: number; y: number }, geometry: ImageGeometry): ImageTransform {
  const scale = clamp(finite(nextScale, 1), MIN_IMAGE_ZOOM, MAX_IMAGE_ZOOM);
  const ratio = scale / transform.scale;
  return clampImageTransform({ scale, x: point.x - (point.x - transform.x) * ratio, y: point.y - (point.y - transform.y) * ratio }, geometry);
}

export function wheelImageZoom(scale: number, delta: number, deltaMode: number, viewportHeight: number): number {
  const pixels = finite(delta) * (deltaMode === 1 ? 16 : deltaMode === 2 ? viewportHeight : 1);
  return clamp(finite(scale, 1) * Math.exp(-clamp(pixels, -180, 180) * .002), MIN_IMAGE_ZOOM, MAX_IMAGE_ZOOM);
}
