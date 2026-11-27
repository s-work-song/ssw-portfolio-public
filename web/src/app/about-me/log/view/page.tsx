import { Suspense } from 'react';
import { loadStaticLogSlugs } from '@/features/logs/api/logStatic';
import LogViewEntry from '../../../../features/logs/navigation/LogViewEntry';

export const metadata = {
  title: '기록',
  description: '개인 기록',
};

/** 예전 주소(?slug=)의 입구다. 빌드에 들어간 글은 정적 주소로 넘기고, 그 뒤에 올라온 글만 API로 그린다. */
export default async function LogViewPage() {
  const staticSlugs = await loadStaticLogSlugs();
  return (
    <Suspense fallback={<p style={{ color: 'var(--text-dim)' }}>기록을 불러오고 있습니다.</p>}>
      <LogViewEntry staticSlugs={staticSlugs} />
    </Suspense>
  );
}
