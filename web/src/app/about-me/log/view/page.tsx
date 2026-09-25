import { Suspense } from 'react';
import LogDetailClient from './LogDetailClient';

export const metadata = {
  title: '기록 | Log',
  description: '개인 기록',
};

export default function LogViewPage() {
  return (
    <Suspense fallback={<p style={{ color: 'var(--text-dim)' }}>기록을 불러오고 있습니다.</p>}>
      <LogDetailClient />
    </Suspense>
  );
}
