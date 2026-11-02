'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { portfolioLogHref } from '@/features/logs/api/logApi';
import LogDetailClient from '../detail/LogDetailClient';

export default function LogViewEntry({ staticSlugs }: { staticSlugs: string[] }) {
  const router = useRouter();
  const slug = useSearchParams().get('slug')?.trim() ?? '';
  const target = staticSlugs.includes(slug) ? portfolioLogHref(slug) : null;

  useEffect(() => {
    if (target) router.replace(`${target}${window.location.hash}`);
  }, [router, target]);

  if (!target) return <LogDetailClient key={slug} slug={slug} />;
  return (
    <p style={{ color: 'var(--text-dim)' }}>
      기록으로 이동하고 있습니다. <Link href={target}>바로 이동</Link>
    </p>
  );
}
