'use client';

import { useEffect } from 'react';

const LOG_ROOT = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/about-me/log`;

/**
 * 빌드 뒤에 올라온 글에는 정적 페이지가 없으므로, 404에서 API로 그리는 화면으로 넘긴다.
 * 이동할 주소는 고정된 기준 경로로 만들어 현재 주소가 다른 사이트로 이끌지 못하게 한다.
 */
export default function LogNotFoundRedirect() {
  useEffect(() => {
    const { pathname, hash } = window.location;
    if (!pathname.startsWith(`${LOG_ROOT}/`)) return;
    const slug = pathname.slice(LOG_ROOT.length + 1).replace(/\/$/u, '');
    if (slug === 'view' || !/^[^/&]+$/u.test(slug)) return;
    window.location.replace(`${LOG_ROOT}/view/?slug=${slug}${hash}`);
  }, []);
  return null;
}
