'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode, RefObject } from 'react';
import styles from './MediaDialog.module.css';

interface MediaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  overlayClassName: string;
  contentClassName: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocus?: () => HTMLElement | null | undefined;
  canCloseFromOutside?: () => boolean;
  children: ReactNode;
}

/** 표시와 미디어 상태는 호출부에 남기고, 모달의 공통 동작만 공유합니다. */
export default function MediaDialog({
  open,
  onOpenChange,
  title,
  overlayClassName,
  contentClassName,
  initialFocusRef,
  returnFocus,
  canCloseFromOutside,
  children,
}: MediaDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClassName}>
          <Dialog.Content asChild
            onOpenAutoFocus={(event) => {
              if (!initialFocusRef?.current) return;
              event.preventDefault();
              initialFocusRef.current.focus({ preventScroll: true });
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              returnFocus?.()?.focus({ preventScroll: true });
            }}
            onPointerDownOutside={(event) => {
              if (canCloseFromOutside && !canCloseFromOutside()) event.preventDefault();
            }}>
            <section className={contentClassName} role="dialog" aria-modal="true">
              <Dialog.Title className={styles.accessibleTitle}>{title}</Dialog.Title>
              {children}
            </section>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
