'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { portfolioLogHref } from '@/lib/logApi';

export default function LegacyLogRedirect({ slug }: { slug: string }) {
  const router = useRouter();
  const target = portfolioLogHref(slug);

  useEffect(() => {
    router.replace(`${target}${window.location.hash}`);
  }, [router, target]);

  return (
    <p style={{ color: 'var(--text-dim)' }}>
      기록 주소를 새 조회 화면으로 연결하고 있습니다.{' '}
      <Link href={target}>바로 이동</Link>
    </p>
  );
}
