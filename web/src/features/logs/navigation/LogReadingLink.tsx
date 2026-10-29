'use client';

import type { ComponentProps } from 'react';
import Link from 'next/link';
import { portfolioLogHref } from '@/features/logs/api/logApi';
import { requestLogReadingStart } from '../detail/logReadingPosition';
import { rememberLogListReturn } from './logListReturn';

type Props = Omit<ComponentProps<typeof Link>, 'href' | 'onNavigate'> & { slug: string };

/** 새 글 열기와 목록의 복귀 대상을 함께 기록한다. 새 탭 열기에는 개입하지 않는다. */
export default function LogReadingLink({ slug, ...props }: Props) {
  return <Link {...props} href={portfolioLogHref(slug)} onNavigate={() => {
    rememberLogListReturn(window, slug);
    requestLogReadingStart(slug);
  }} />;
}
