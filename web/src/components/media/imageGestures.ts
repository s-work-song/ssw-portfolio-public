import { clampImageTransform, MAX_IMAGE_ZOOM, MIN_IMAGE_ZOOM, type ImageGeometry, type ImageTransform } from './imageZoom.ts';

interface Point { x: number; y: number }
type SwipeDirection = -1 | 1;
interface SingleGesture {
  origin: Point;
  transform: ImageTransform;
  canPrevious: boolean;
  canNext: boolean;
  mode: 'pending' | 'pan' | 'previous' | 'next';
  maxVerticalTravel: number;
}
interface PinchGesture { center: Point; distance: number; transform: ImageTransform }

const EDGE_TOLERANCE = 2;
const INTENT_DISTANCE = 8;
const SWIPE_DISTANCE = 48;
const HORIZONTAL_RATIO = 1.35;

/** DOM과 독립적인 제스처 상태. 한 번의 접촉에서 pan → slide 전환은 하지 않는다. */
export class ImageGestureController {
  private pointers = new Map<number, Point>();
  private single: SingleGesture | null = null;
  private pinch: PinchGesture | null = null;
  private hadMultiplePointers = false;

  get active() { return this.pointers.size > 0; }

  private pinchPoints() {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return null;
    return { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(b.x - a.x, b.y - a.y) };
  }

  private startPinch(transform: ImageTransform) {
    const points = this.pinchPoints();
    this.pinch = points && points.distance >= INTENT_DISTANCE ? { ...points, transform: { ...transform } } : null;
  }

  down(id: number, point: Point, transform: ImageTransform, geometry: ImageGeometry) {
    this.pointers.set(id, point);
    if (this.pointers.size > 1) {
      this.hadMultiplePointers = true;
      this.single = null;
      this.startPinch(transform);
      return;
    }
    if (this.hadMultiplePointers) return;
    const safe = clampImageTransform(transform, geometry);
    const maxX = Math.max(0, (geometry.fittedWidth * safe.scale - geometry.viewportWidth) / 2);
    // 경계 판정은 pointerdown 시점의 이미지 위치로 고정한다.
    this.single = {
      origin: point, transform: safe, mode: 'pending', maxVerticalTravel: 0,
      canPrevious: maxX - safe.x <= EDGE_TOLERANCE,
      canNext: maxX + safe.x <= EDGE_TOLERANCE,
    };
  }

  move(id: number, point: Point, current: ImageTransform, geometry: ImageGeometry): ImageTransform {
    if (!this.pointers.has(id)) return current;
    this.pointers.set(id, point);
    if (this.pointers.size > 1) {
      const points = this.pinchPoints();
      if (!points) return current;
      if (!this.pinch) { this.startPinch(current); return current; }
      const start = this.pinch;
      const scale = Math.min(MAX_IMAGE_ZOOM, Math.max(MIN_IMAGE_ZOOM, start.transform.scale * points.distance / start.distance));
      const ratio = scale / start.transform.scale;
      // 두 손가락 사이의 이미지 지점을 유지하면서 중심 이동도 함께 반영한다.
      return clampImageTransform({
        scale,
        x: points.center.x - (start.center.x - start.transform.x) * ratio,
        y: points.center.y - (start.center.y - start.transform.y) * ratio,
      }, geometry);
    }
    // 핀치 뒤 손가락 하나가 남아도 새 스와이프로 해석하지 않는다.
    if (this.hadMultiplePointers || !this.single) return current;
    const gesture = this.single;
    const dx = point.x - gesture.origin.x;
    const dy = point.y - gesture.origin.y;
    gesture.maxVerticalTravel = Math.max(gesture.maxVerticalTravel, Math.abs(dy));
    if (gesture.mode === 'pending' && Math.hypot(dx, dy) >= INTENT_DISTANCE) {
      const horizontal = Math.abs(dx) >= Math.abs(dy) * HORIZONTAL_RATIO;
      gesture.mode = horizontal && dx < 0 && gesture.canNext ? 'next'
        : horizontal && dx > 0 && gesture.canPrevious ? 'previous' : 'pan';
    }
    if (gesture.mode !== 'pan') return current;
    return clampImageTransform({ ...gesture.transform, x: gesture.transform.x + dx, y: gesture.transform.y + dy }, geometry);
  }

  up(id: number, point: Point, current: ImageTransform, geometry: ImageGeometry, cancelled = false): { transform: ImageTransform; navigate: SwipeDirection | null } {
    if (!this.pointers.has(id)) return { transform: current, navigate: null };
    const transform = cancelled ? current : this.move(id, point, current, geometry);
    let navigate: SwipeDirection | null = null;
    if (!cancelled && !this.hadMultiplePointers && this.single) {
      const dx = point.x - this.single.origin.x;
      const horizontal = Math.abs(dx) >= Math.max(SWIPE_DISTANCE, this.single.maxVerticalTravel * HORIZONTAL_RATIO);
      if (horizontal && this.single.mode === 'next' && dx < 0) navigate = 1;
      if (horizontal && this.single.mode === 'previous' && dx > 0) navigate = -1;
    }
    this.pointers.delete(id);
    // cancel/lost capture 후 남은 손가락으로도 사진을 넘기지 않는다.
    if (cancelled) { this.hadMultiplePointers = true; this.single = null; }
    if (!this.active) this.reset();
    else if (this.pointers.size >= 2) this.startPinch(transform);
    else this.pinch = null;
    return { transform, navigate };
  }

  reset() {
    this.pointers.clear();
    this.single = null;
    this.pinch = null;
    this.hadMultiplePointers = false;
  }
}
