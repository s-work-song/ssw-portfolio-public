import type { Metadata } from 'next';
import LogDetailClient from '../../../../features/logs/detail/LogDetailClient';
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
  return <LogDetailClient key={slug} slug={slug} initialDetail={await loadStaticLogDetail(slug)} />;
}
