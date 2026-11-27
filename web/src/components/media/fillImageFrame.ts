import type { CSSProperties } from 'react';

/**
 * next/image의 fill 이미지는 position: absolute라서, 감싸는 요소의 position이 CSS 파일에만 있으면
 * 그 CSS 조각을 못 받은 순간 이미지가 문서 맨 위에 화면 크기로 붙습니다. 감싸는 요소에 인라인으로 둡니다.
 */
export const FILL_IMAGE_FRAME_STYLE: CSSProperties = { position: 'relative', overflow: 'hidden' };
