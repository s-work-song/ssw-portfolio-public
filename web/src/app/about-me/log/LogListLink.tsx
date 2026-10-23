'use client';

import type { ComponentProps } from 'react';
import Link from 'next/link';
import { logListReturnHref, requestLogListReturn, type LogListReturn } from './logListReturn';

type Props = Omit<ComponentProps<typeof Link>, 'href' | 'onNavigate'> & { returnTo: LogListReturn | null };

/** 이전 페이지로 한 칸 이동하는 대신, 출발한 목록과 선택 기록으로 명시적으로 돌아간다. */
export default function LogListLink({ returnTo, ...props }: Props) {
  return <Link {...props} href={logListReturnHref(returnTo)}
    onNavigate={() => requestLogListReturn(window, returnTo)} />;
}
