'use client';

import { useEffect } from 'react';

/** 빌드 뒤에 올라온 글에는 정적 페이지가 없으므로, 404에서 API로 그리는 화면으로 넘긴다. */
export default function LogNotFoundRedirect() {
  useEffect(() => {
    const match = /^(.*\/about-me\/log)\/(?!view\/?$)([^/]+)\/?$/u.exec(window.location.pathname);
    if (!match) return;
    window.location.replace(`${match[1]}/view/?slug=${match[2]}${window.location.hash}`);
  }, []);
  return null;
}
