'use client';

import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import type { AiWorkflowStoryCapture } from '@/features/ai-workflow/data/aiWorkflow';
import MediaDialog from '@/components/media/MediaDialog';
import ZoomableImage from '@/components/media/ZoomableImage';
import { mediaDialogOutsideCloseAllowed } from '@/components/media/mediaDialogPolicy';
import mediaStyles from '@/features/projects/ui/ProjectMediaCarousel.module.css';
import styles from '../../../app/about-me/ai-workflow/AiWorkflow.module.css';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function WorkflowInlineCapture({ id, capture }: { id: string; capture: AiWorkflowStoryCapture }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const lastDragFinishedAt = useRef<number | null>(null);
  const recordDragEnd = useCallback(() => { lastDragFinishedAt.current = window.performance.now(); }, []);

  return (
    <>
      <figure className={styles.inlineCapture}>
        <button ref={triggerRef} type="button" className={styles.inlineCaptureButton}
          onClick={() => setIsOpen(true)} aria-haspopup="dialog"
          aria-label={`${capture.alt} 크게 보기`} aria-describedby={`${id}-hint`}>
          <Image src={`${basePath}${capture.src}`} alt={capture.alt} width={capture.width} height={capture.height}
            sizes="(max-width: 1100px) 90vw, 900px" className={styles.inlineCaptureImage} />
        </button>
        <figcaption className={styles.inlineCaptureCaption}>
          <span>{capture.caption}</span>
          <span id={`${id}-hint`} className={styles.captureHint}>이미지를 누르면 전체 보기로 열립니다. 확대창에서 마우스 휠이나 + / − 버튼으로 확대·축소하고, 확대한 뒤 드래그로 이동할 수 있습니다.</span>
        </figcaption>
      </figure>
      {isOpen && (
        <MediaDialog open={isOpen} onOpenChange={setIsOpen} title={capture.caption}
          overlayClassName={mediaStyles.lightboxOverlay} contentClassName={mediaStyles.lightboxDialog}
          initialFocusRef={closeRef} returnFocus={() => triggerRef.current}
          canCloseFromOutside={() => mediaDialogOutsideCloseAllowed(false, lastDragFinishedAt.current, window.performance.now())}>
          <button ref={closeRef} type="button" className={mediaStyles.lightboxClose}
            onClick={() => setIsOpen(false)} aria-label="크게 보기 닫기" />
          <div className={styles.inlineZoomFrame}>
            <ZoomableImage src={`${basePath}${capture.src}`} alt={capture.alt}
              onDragEnd={recordDragEnd} />
          </div>
          <div className={mediaStyles.lightboxFooter}><p>{capture.caption}</p></div>
        </MediaDialog>
      )}
    </>
  );
}
