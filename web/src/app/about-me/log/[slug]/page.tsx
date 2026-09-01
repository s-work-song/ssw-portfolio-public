import LegacyLogRedirect from './LegacyLogRedirect';
import { LEGACY_LOG_SLUGS } from '@/lib/legacyLogSlugs';

export const dynamicParams = false;

export function generateStaticParams() {
  return LEGACY_LOG_SLUGS.map((slug) => ({ slug }));
}

export const metadata = {
  title: '기록 | Log',
  description: '개인 기록',
};

export default async function LegacyPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <LegacyLogRedirect slug={slug} />;
}
