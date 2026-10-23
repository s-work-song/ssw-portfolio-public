'use client';

import { useState } from 'react';
import ProjectMediaCarousel from '@/components/about/ProjectMediaCarousel';
import type { AiWorkflowCapture } from '@/data/aiWorkflow';
import styles from './AiWorkflow.module.css';

interface WorkflowCaptureGalleryProps {
  title: string;
  captures: AiWorkflowCapture[];
  portrait?: boolean;
  frameAspectRatio?: string;
}

export default function WorkflowCaptureGallery({ title, captures, portrait = false, frameAspectRatio }: WorkflowCaptureGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const current = captures[activeIndex];
  if (!current) return null;

  return (
    <div className={`${styles.captureGallery} ${portrait ? styles.portraitGallery : ''}`}>
      <ProjectMediaCarousel
        gallery={{ images: captures, placeholder: '' }}
        projectTitle={title}
        className={portrait ? styles.portraitMedia : undefined}
        frameAspectRatio={frameAspectRatio ?? (portrait ? '834 / 1706' : undefined)}
        imageSizes={portrait ? '(max-width: 640px) 90vw, 350px' : '(max-width: 1100px) 90vw, 850px'}
        hideInlineCaption
        onActiveIndexChange={setActiveIndex}
      />
      <div className={styles.captureCopy}>
        <p className={styles.captureIndex}>실제 작업 캡처 · {activeIndex + 1} / {captures.length}</p>
        <div className={styles.captureExplanation} aria-live="polite" aria-atomic="true">
          <h5>{current.title}</h5>
          <p>{current.detail}</p>
        </div>
        <p className={styles.captureHint}>이미지를 누르면 전체 보기로 열립니다. 확대창에서 마우스 휠이나 + / − 버튼으로 확대·축소하고, 확대한 뒤 드래그로 이동할 수 있습니다.</p>
      </div>
    </div>
  );
}
