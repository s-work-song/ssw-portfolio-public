'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { clampImageTransform, FIT_IMAGE_TRANSFORM, fittedImageGeometry, MAX_IMAGE_ZOOM, MIN_IMAGE_ZOOM, wheelImageZoom, zoomImageAt, type ImageTransform } from './imageZoom';
import { ImageGestureController } from './imageGestures';
import styles from './ZoomableImage.module.css';

interface ZoomableImageProps {
  src: string;
  alt: string;
  onNavigate?: (direction: -1 | 1) => void;
  onDragEnd: () => void;
}

export default function ZoomableImage({ src, alt, onNavigate, onDragEnd }: ZoomableImageProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const geometryRef = useRef(fittedImageGeometry(0, 0, 0, 0));
  const transformRef = useRef<ImageTransform>({ ...FIT_IMAGE_TRANSFORM });
  const [transform, setTransform] = useState<ImageTransform>({ ...FIT_IMAGE_TRANSFORM });
  const gestureRef = useRef(new ImageGestureController());

  const applyTransform = useCallback((next: ImageTransform) => {
    const safe = clampImageTransform(next, geometryRef.current);
    const previous = transformRef.current;
    if (safe.scale === previous.scale && safe.x === previous.x && safe.y === previous.y) return;
    transformRef.current = safe;
    setTransform(safe);
  }, []);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const image = imageRef.current;
    if (!viewport || !image) return;
    gestureRef.current.reset();
    geometryRef.current = fittedImageGeometry(viewport.clientWidth, viewport.clientHeight, image.naturalWidth, image.naturalHeight);
    applyTransform(transformRef.current);
  }, [applyTransform]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const wheel = (event: WheelEvent) => {
      // 이미지 영역의 트랙패드 핀치(ctrl-wheel)도 같은 배율을 사용한다.
      // 브라우저 확대 단축키와 이미지 바깥의 확대는 그대로 둔다.
      if (event.metaKey || !event.deltaY) return;
      event.preventDefault();
      event.stopPropagation();
      if (gestureRef.current.active) return;
      const rect = viewport.getBoundingClientRect();
      const current = transformRef.current;
      applyTransform(zoomImageAt(current, wheelImageZoom(current.scale, event.deltaY, event.deltaMode, rect.height),
        { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 }, geometryRef.current));
    };
    const cancelGesture = () => gestureRef.current.reset();
    viewport.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('blur', cancelGesture);
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => {
      viewport.removeEventListener('wheel', wheel);
      window.removeEventListener('blur', cancelGesture);
      observer.disconnect();
    };
  }, [applyTransform, measure]);

  const zoomBy = (factor: number) => applyTransform(zoomImageAt(transformRef.current,
    transformRef.current.scale * factor, { x: 0, y: 0 }, geometryRef.current));
  const reset = () => { gestureRef.current.reset(); applyTransform({ ...FIT_IMAGE_TRANSFORM }); };
  const pointerPoint = (event: PointerEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget;
    const rect = viewport.getBoundingClientRect();
    return { x: (event.clientX - rect.left - rect.width / 2) * viewport.clientWidth / rect.width,
      y: (event.clientY - rect.top - rect.height / 2) * viewport.clientHeight / rect.height };
  };
  const stopDrag = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    if (!gestureRef.current.active) return;
    const result = gestureRef.current.up(event.pointerId, pointerPoint(event), transformRef.current, geometryRef.current, cancelled);
    applyTransform(result.transform);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    event.stopPropagation();
    onDragEnd();
    if (result.navigate !== null) onNavigate?.(result.navigate);
  };
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (event.pointerType === 'mouse') event.preventDefault();
    event.stopPropagation();
    gestureRef.current.down(event.pointerId, pointerPoint(event), transformRef.current, geometryRef.current);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!gestureRef.current.active) return;
    event.preventDefault();
    event.stopPropagation();
    applyTransform(gestureRef.current.move(event.pointerId, pointerPoint(event), transformRef.current, geometryRef.current));
  };
  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === '+' || event.key === '=') zoomBy(1.25);
    else if (event.key === '-') zoomBy(1 / 1.25);
    else if (event.key === '0' || event.key === 'Home') reset();
    else if (transformRef.current.scale > 1 && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      const current = transformRef.current;
      applyTransform({ ...current, x: current.x + (event.key === 'ArrowLeft' ? 50 : event.key === 'ArrowRight' ? -50 : 0),
        y: current.y + (event.key === 'ArrowUp' ? 50 : event.key === 'ArrowDown' ? -50 : 0) });
    } else return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className={styles.root} data-image-zoom-root>
      <div ref={viewportRef} className={`${styles.viewport} ${transform.scale > 1 ? styles.zoomed : ''}`}
        tabIndex={0} role="group" aria-label={`${alt} 확대·축소 영역`}
        data-image-zoom={transform.scale} onKeyDown={handleKey}
        onPointerDownCapture={startDrag} onPointerMove={moveDrag}
        onPointerUp={(event) => stopDrag(event)} onPointerCancel={(event) => stopDrag(event, true)}
        onLostPointerCapture={(event) => stopDrag(event, true)}>
        <div className={styles.transform} style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}>
          <Image ref={imageRef} src={src} alt={alt} fill sizes="96vw" className={styles.image} draggable={false} onLoad={measure} />
        </div>
      </div>
      <div className={styles.controls} role="group" aria-label="이미지 확대·축소">
        <button type="button" onClick={() => zoomBy(1 / 1.25)} disabled={transform.scale <= MIN_IMAGE_ZOOM} aria-label="이미지 축소">−</button>
        <output aria-label="전체 보기 기준 확대 배율">{Math.round(transform.scale * 100)}%</output>
        <button type="button" onClick={() => zoomBy(1.25)} disabled={transform.scale >= MAX_IMAGE_ZOOM} aria-label="이미지 확대">+</button>
        <button type="button" className={styles.reset} onClick={reset} aria-label="이미지 전체 보기">전체 보기</button>
      </div>
      <p className={styles.hint}>휠·핀치로 확대 · 드래그로 이동{onNavigate && ' · 끝에서 손을 떼고 다시 밀면 넘기기'}</p>
    </div>
  );
}
