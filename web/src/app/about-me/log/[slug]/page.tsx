import type { Metadata } from 'next';
import LogDetailClient from '../../../../features/logs/detail/LogDetailClient';
import { LOG_FIRST_SCREEN_ANCHOR } from '../../../../features/logs/detail/logReadingPosition';
import { loadStaticLogDetail, loadStaticLogSlugs } from '@/features/logs/api/logStatic';

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await loadStaticLogSlugs()).map((slug) => ({ slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const detail = await loadStaticLogDetail((await params).slug);
  return {
    title: detail?.post.title ?? '기록',
    description: detail?.post.summary ?? '개인 기록',
  };
}

export default async function LogPostPage({ params }: Props) {
  const { slug } = await params;
  const detail = await loadStaticLogDetail(slug);
  return (
    <>
      {/* 제목만 먼저 그리지 않고 첫 화면의 문단까지 읽은 뒤 한 번에 그린다. 지원하지 않는 브라우저는 무시한다. */}
      {detail && <link rel="expect" href={`#${LOG_FIRST_SCREEN_ANCHOR}`} blocking="render" />}
      <LogDetailClient key={slug} slug={slug} initialDetail={detail} />
    </>
  );
}
