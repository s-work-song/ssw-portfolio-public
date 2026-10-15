'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { clampImageTransform, FIT_IMAGE_TRANSFORM, fittedImageGeometry, MAX_IMAGE_ZOOM, MIN_IMAGE_ZOOM, wheelImageZoom, zoomImageAt, type ImageTransform } from './imageZoom';
import styles from './ZoomableImage.module.css';

interface ZoomableImageProps {
  src: string;
  alt: string;
  onZoomChange: (scale: number) => void;
  onDragEnd: () => void;
}

export default function ZoomableImage({ src, alt, onZoomChange, onDragEnd }: ZoomableImageProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const geometryRef = useRef(fittedImageGeometry(0, 0, 0, 0));
  const transformRef = useRef<ImageTransform>({ ...FIT_IMAGE_TRANSFORM });
  const [transform, setTransform] = useState<ImageTransform>({ ...FIT_IMAGE_TRANSFORM });
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; imageX: number; imageY: number } | null>(null);

  const applyTransform = useCallback((next: ImageTransform) => {
    const safe = clampImageTransform(next, geometryRef.current);
    const previous = transformRef.current;
    if (safe.scale === previous.scale && safe.x === previous.x && safe.y === previous.y) return;
    transformRef.current = safe;
    setTransform(safe);
    onZoomChange(safe.scale);
  }, [onZoomChange]);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const image = imageRef.current;
    if (!viewport || !image) return;
    geometryRef.current = fittedImageGeometry(viewport.clientWidth, viewport.clientHeight, image.naturalWidth, image.naturalHeight);
    applyTransform(transformRef.current);
  }, [applyTransform]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const wheel = (event: WheelEvent) => {
      // 브라우저 자체 확대와 트랙패드 핀치는 가로채지 않는다.
      if (event.ctrlKey || event.metaKey || !event.deltaY) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = viewport.getBoundingClientRect();
      const current = transformRef.current;
      applyTransform(zoomImageAt(current, wheelImageZoom(current.scale, event.deltaY, event.deltaMode, rect.height),
        { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 }, geometryRef.current));
    };
    viewport.addEventListener('wheel', wheel, { passive: false });
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => {
      viewport.removeEventListener('wheel', wheel);
      observer.disconnect();
    };
  }, [applyTransform, measure]);

  const zoomBy = (factor: number) => applyTransform(zoomImageAt(transformRef.current,
    transformRef.current.scale * factor, { x: 0, y: 0 }, geometryRef.current));
  const reset = () => applyTransform({ ...FIT_IMAGE_TRANSFORM });
  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    event.stopPropagation();
    onDragEnd();
  };
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    // 두 번째 손가락부터는 이미지 드래그를 중단하고 브라우저 핀치에 맡긴다.
    if (!event.isPrimary) {
      dragRef.current = null;
      return;
    }
    if (event.button !== 0 || transformRef.current.scale <= 1) return;
    if (event.pointerType === 'mouse') event.preventDefault();
    event.stopPropagation();
    const current = transformRef.current;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, imageX: current.x, imageY: current.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    applyTransform({ scale: transformRef.current.scale, x: drag.imageX + event.clientX - drag.startX, y: drag.imageY + event.clientY - drag.startY });
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
    <div className={styles.root}>
      <div ref={viewportRef} className={`${styles.viewport} ${transform.scale > 1 ? styles.zoomed : ''}`}
        tabIndex={0} role="group" aria-label={`${alt} 확대·축소 영역`}
        data-image-zoom={transform.scale} onKeyDown={handleKey}
        onPointerDownCapture={startDrag} onPointerMove={moveDrag}
        onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={() => { dragRef.current = null; }}>
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
      <p className={styles.hint}>휠로 확대·축소 · 확대한 뒤 드래그로 이동</p>
    </div>
  );
}
