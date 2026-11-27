'use client';

import { Root } from '@radix-ui/react-radio-group';
import { useEffect, useRef, type ComponentProps, type SyntheticEvent } from 'react';
import { SettingsRadioKeyboardSelection } from './settingsRadioKeyboardPolicy';

export { Item as SettingsRadioItem } from '@radix-ui/react-radio-group';

function radioWithin(event: SyntheticEvent<HTMLDivElement>): HTMLButtonElement | null {
  const target = event.target;
  return target instanceof HTMLButtonElement &&
    target.getAttribute('role') === 'radio' &&
    target.closest('[role="radiogroup"]') === event.currentTarget
    ? target : null;
}

/** DOM 래퍼를 추가하지 않고 기존 typed onClick으로 누락 선택만 전달한다. */
export function SettingsRadioGroup({
  onKeyDown, onFocus, onClickCapture, onPointerDownCapture, onBlur, ...props
}: ComponentProps<typeof Root>) {
  const selectionRef = useRef(new SettingsRadioKeyboardSelection<HTMLButtonElement>());
  const timerRef = useRef<number | null>(null);

  const cancelPending = () => {
    selectionRef.current.cancel();
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => {
    const selection = selectionRef.current;
    return () => {
      selection.cancel();
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  return <Root
    {...props}
    onKeyDown={(event) => {
      onKeyDown?.(event);
      cancelPending();
      const origin = radioWithin(event);
      if (!origin || origin.disabled) return;
      // Radix가 유효 방향키에 이미 preventDefault한 뒤 버블되므로 이를 거절하지 않는다.
      const token = selectionRef.current.begin(event, origin);
      if (token === null) return;
      // Radix의 0ms focus 타이머 뒤에 등록해 같은 입력의 focus까지 요청을 보존한다.
      timerRef.current = window.setTimeout(() => {
        selectionRef.current.expire(token);
        timerRef.current = null;
      }, 0);
    }}
    onClickCapture={(event) => {
      cancelPending(); // 정상 Radix 클릭·Space·마우스·프로그램 클릭은 보완하지 않는다.
      onClickCapture?.(event);
    }}
    onFocus={(event) => {
      onFocus?.(event);
      const target = radioWithin(event);
      if (!event.defaultPrevented && target && !target.disabled && selectionRef.current.consumeFocus(target)) {
        target.click(); // Item 내부 onFocus가 클릭을 생략한 경우에만 한 번 실행한다.
      }
    }}
    onPointerDownCapture={(event) => {
      cancelPending();
      onPointerDownCapture?.(event);
    }}
    onBlur={(event) => {
      const next = event.relatedTarget;
      if (!(next instanceof Node) || !event.currentTarget.contains(next)) cancelPending();
      onBlur?.(event);
    }}
  />;
}
