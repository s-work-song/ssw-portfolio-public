"use client";

import Link from 'next/link';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { useChat } from '@/features/chat';

/**
 * 연구 페이지의 특정 위치로 같은 탭에서 이동하는 링크다.
 *
 * 일반 클릭은 채팅과 같은 이동 경로(`navigateRoute`)로 넘겨 연구 탭 전환과
 * 위치 스크롤을 맡기고, 보조 키를 누른 클릭은 브라우저 기본 동작에 둔다.
 * 문장 안에 넣는 링크는 `arrow={false}`로 끝의 화살표를 뺀다.
 */
export default function ResearchLink({
  href,
  className,
  style,
  ariaLabel,
  arrow = true,
  children,
}: Readonly<{
  href: string;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  arrow?: boolean;
  children: ReactNode;
}>) {
  const { navigateRoute } = useChat();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigateRoute(href);
  };

  return (
    <Link className={className} style={style} href={href} onClick={handleClick} aria-label={ariaLabel}>
      {children}
      {arrow && <span aria-hidden="true">→</span>}
    </Link>
  );
}
