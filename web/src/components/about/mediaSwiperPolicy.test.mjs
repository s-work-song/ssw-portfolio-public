import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { mediaSlideIndex, mediaSwiperSpeed } from './mediaSwiperPolicy.ts';
import { clampImageTransform, fittedImageGeometry, MAX_IMAGE_ZOOM, wheelImageZoom, zoomImageAt } from './imageZoom.ts';

test('Swiper 버전은 workspace와 루트 lockfile에 고정하고 공개 MIT 고지를 배포한다', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../../package.json', import.meta.url), 'utf8'));
  const lock = JSON.parse(await readFile(new URL('../../../../package-lock.json', import.meta.url), 'utf8'));
  assert.equal(manifest.dependencies.swiper, '14.3.0');
  assert.equal(lock.packages.web.dependencies.swiper, manifest.dependencies.swiper);
  assert.equal(lock.packages['node_modules/swiper'].version, manifest.dependencies.swiper);
  assert.match(lock.packages['node_modules/swiper'].integrity, /^sha512-/);
  const license = await readFile(new URL('../../../public/licenses/swiper-LICENSE.txt', import.meta.url), 'utf8');
  assert.match(license, /The MIT License \(MIT\)/);
  assert.match(license, /Copyright \(c\) 2019 Vladimir Kharlampidi/);
  assert.match(license, /The above copyright notice and this permission notice shall be included/);
});

test('사이트 모션 설정과 OS reduced-motion의 모든 조합을 실제 전환 속도에 반영한다', () => {
  for (const reduced of [false, true]) {
    assert.equal(mediaSwiperSpeed('on', reduced), 380);
    assert.equal(mediaSwiperSpeed('off', reduced), 0);
    assert.equal(mediaSwiperSpeed('system', reduced), reduced ? 0 : 380);
  }
});

test('realIndex는 원본 데이터 범위의 정수만 허용한다', () => {
  assert.equal(mediaSlideIndex(0, 1), 0);
  assert.equal(mediaSlideIndex(2, 3), 2);
  for (const index of [-1, 3, 0.5, NaN, Infinity]) {
    assert.equal(mediaSlideIndex(index, 3), null);
  }
  assert.equal(mediaSlideIndex(0, 0), null);
});

test('프로젝트 이미지는 원본 슬라이드만 렌더하고 두 Swiper의 원본 인덱스를 동기화한다', async () => {
  const source = await readFile(new URL('./ProjectMediaCarousel.tsx', import.meta.url), 'utf8');
  assert.match(source, /from 'swiper\/react'/);
  assert.match(source, /loop: hasMultipleImages/);
  assert.match(source, /mediaSlideIndex\(swiper\.realIndex, images\.length\)/);
  assert.match(source, /other\.slideToLoop\(nextIndex, 0, false\)/);
  assert.match(source, /if \(swiper !== authoritativeSwiper\) return/);
  assert.match(source, /resetGesture\(\);\s*isExpandedRef\.current = false/);
  assert.match(source, /initialSlide=\{activeIndex\}/);
  assert.match(source, /inert=\{index !== activeIndex\}/);
  assert.match(source, /tabIndex=\{index === activeIndex \? 0 : -1\}/);
  assert.doesNotMatch(source, /loopedImages|trackPosition|dragOffset|translate3d|setPointerCapture/);
});

test('자동 높이 단계 안의 사진은 Swiper 전역 height:auto보다 구체적인 100% 높이를 유지한다', async () => {
  const vendor = await readFile(new URL('../../../../node_modules/swiper/swiper.css', import.meta.url), 'utf8');
  assert.match(vendor, /\.swiper-autoheight \.swiper-slide \{\s*height: auto;/);
  const css = await readFile(new URL('./ProjectMediaCarousel.module.css', import.meta.url), 'utf8');
  assert.match(css, /\.frame > \.swiper > :global\(\.swiper-wrapper\) > \.swiperSlide,\s*\.lightboxFrame > \.swiper > :global\(\.swiper-wrapper\) > \.lightboxSlide \{\s*height: 100%;/);
  const workflowCss = await readFile(new URL('../../app/about-me/ai-workflow/AiWorkflow.module.css', import.meta.url), 'utf8');
  assert.match(workflowCss, /\.stageSwiper > :global\(\.swiper-wrapper\)/);
  assert.doesNotMatch(workflowCss, /\.stageSwiper :global\(\.swiper-wrapper\)/);
});

test('사진 캐러셀은 소수점 폭에서 이웃 사진이 비치지 않도록 간격·정수화·잘림을 함께 적용한다', async () => {
  const source = await readFile(new URL('./ProjectMediaCarousel.tsx', import.meta.url), 'utf8');
  assert.match(source, /spaceBetween: 2/);
  assert.match(source, /roundLengths: true/);
  const css = await readFile(new URL('./ProjectMediaCarousel.module.css', import.meta.url), 'utf8');
  for (const selector of ['swiper', 'swiperSlide', 'lightboxSlide']) {
    assert.match(css, new RegExp(`\\.${selector} \\{[^}]*overflow: hidden;`));
  }
  for (const viewportWidth of [169.125, 320.25, 350.4, 353.75, 550.5, 799.875]) {
    assert.ok(Math.round(viewportWidth) + 2 > viewportWidth, `다음 사진의 시작점은 표시 폭 밖에 있어야 한다: ${viewportWidth}`);
  }
  assert.doesNotMatch(css, /swiperSlide[^}]*visibility: hidden/s, '전환 중 이전·다음 사진은 함께 이동해야 한다');
});

test('아카이브는 비순환 경계·기본 영상 컨트롤·hidden 재오픈·pause 계약을 유지한다', async () => {
  const source = await readFile(new URL('./ArchiveVideoGallery.tsx', import.meta.url), 'utf8');
  assert.match(source, /loop=\{false\}/);
  assert.match(source, /rewind=\{false\}/);
  assert.match(source, /disabled=\{activeIndex === 0\}/);
  assert.match(source, /disabled=\{activeIndex === mediaItems\.length - 1\}/);
  assert.match(source, /hidden=\{!isOpen\}/);
  assert.match(source, /const requestedIndex = activeIndexRef\.current;\s*swiper\.update\(\);\s*swiper\.slideTo\(requestedIndex, 0\)/);
  assert.match(source, /preload="auto"/);
  assert.match(source, /video\.play\(\)/);
  assert.match(source, /video\.pause\(\)/);
  assert.match(source, /noSwipingSelector="button, \[data-swiper-native-controls\]"/);
  assert.doesNotMatch(source, /dragOffset|dragStartX|dragViewportWidth|translate3d|setPointerCapture/);
});

test('핀치 보호는 공개 이동 잠금만 사용하고 CSS·OS 구독은 공유 진입점에 둔다', async () => {
  for (const file of ['ProjectMediaCarousel.tsx', 'ArchiveVideoGallery.tsx']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /swiper\.allowSlideNext = false/);
    assert.match(source, /swiper\.allowSlidePrev = false/);
    assert.match(source, /onPointerDownCapture=/);
    assert.doesNotMatch(source, /swiper\.touchEventsData|swiper\.touches|swiper\.swipeDirection/);
  }
  const hook = await readFile(new URL('./useMediaSwiperMotion.ts', import.meta.url), 'utf8');
  assert.match(hook, /useSyncExternalStore/);
  assert.match(hook, /prefers-reduced-motion: reduce/);
  assert.match(hook, /import 'swiper\/css'/);
  assert.match(hook, /import 'swiper\/css\/a11y'/);
  assert.doesNotMatch(hook, /swiper\/css\/bundle/);
});

test('긴 캡처와 가로 사진 모두 처음에는 전체가 보이는 비율로 맞춘다', () => {
  const portrait = fittedImageGeometry(1200, 600, 834, 1706);
  assert.equal(portrait.fittedHeight, 600);
  assert.ok(portrait.fittedWidth < 300);
  const landscape = fittedImageGeometry(1000, 600, 2000, 1000);
  assert.equal(landscape.fittedWidth, 1000);
  assert.equal(landscape.fittedHeight, 500);
  assert.deepEqual(clampImageTransform({ scale: 1, x: 100, y: -100 }, portrait), { scale: 1, x: 0, y: 0 });
});

test('이미지 휠 확대는 방향·델타 단위와 1~8배 경계를 지킨다', () => {
  assert.ok(wheelImageZoom(1, -100, 0, 600) > 1);
  assert.ok(wheelImageZoom(2, 100, 0, 600) < 2);
  assert.equal(wheelImageZoom(1, 100, 0, 600), 1);
  assert.equal(wheelImageZoom(8, -100, 0, 600), MAX_IMAGE_ZOOM);
  assert.equal(wheelImageZoom(2, 1, 1, 600), wheelImageZoom(2, 16, 0, 600));
  assert.equal(wheelImageZoom(2, .1, 2, 100), wheelImageZoom(2, 10, 0, 100));
  assert.equal(wheelImageZoom(NaN, 0, 0, 600), 1);
});

test('확대할 때 커서 아래의 지점을 유지하고 이동은 실제 이미지 경계에서 제한한다', () => {
  const geometry = fittedImageGeometry(1200, 600, 2000, 1000);
  const zoomed = zoomImageAt({ scale: 1, x: 0, y: 0 }, 2, { x: 200, y: -100 }, geometry);
  assert.deepEqual(zoomed, { scale: 2, x: -200, y: 100 });
  assert.deepEqual(clampImageTransform({ scale: 2, x: 9999, y: -9999 }, geometry), { scale: 2, x: 600, y: -300 });
  const portrait = fittedImageGeometry(1200, 600, 834, 1706);
  const panned = clampImageTransform({ scale: 3, x: 9999, y: -9999 }, portrait);
  assert.equal(Math.abs(panned.x), 0, '가로 여백은 이미지가 뷰포트보다 작으면 이동하지 않는다');
  assert.equal(panned.y, -600);
});

test('확대창은 휠·버튼·키보드·드래그를 제공하고 슬라이드 변경 시 확대 상태를 초기화한다', async () => {
  const zoom = await readFile(new URL('./ZoomableImage.tsx', import.meta.url), 'utf8');
  assert.match(zoom, /addEventListener\('wheel', wheel, \{ passive: false \}\)/);
  assert.match(zoom, /removeEventListener\('wheel', wheel\)/);
  assert.match(zoom, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(zoom, /setPointerCapture\(event\.pointerId\)/);
  assert.match(zoom, /ResizeObserver\(measure\)/);
  assert.match(zoom, /aria-label="이미지 전체 보기"/);
  assert.match(zoom, /data-image-zoom=\{transform\.scale\}/);
  const carousel = await readFile(new URL('./ProjectMediaCarousel.tsx', import.meta.url), 'utf8');
  assert.match(carousel, /index === activeIndex \? \(\s*<ZoomableImage key=\{image\.src\}/);
  assert.match(carousel, /activeIndexRef\.current = nextIndex;\s*updateExpandedZoom\(1\)/);
  assert.match(carousel, /swiper\.allowTouchMove = hasMultipleImages && scale <= 1/);
  assert.doesNotMatch(carousel, /expandedImageSize|lightboxPortraitFrame/);
  const css = await readFile(new URL('./ZoomableImage.module.css', import.meta.url), 'utf8');
  assert.match(css, /grid-template-rows: auto minmax\(0, 1fr\) auto/);
  assert.match(css, /\.viewport \{[^}]*grid-row: 2/);
  assert.match(css, /\.controls \{[^}]*grid-row: 1/);
  assert.match(css, /\.hint \{[^}]*grid-row: 3/);
});

test('캠프파이어 혼합 갤러리는 사진 확대만 공유하고 영상 컨트롤·일시정지·경계를 유지한다', async () => {
  const archive = await readFile(new URL('./ArchiveVideoGallery.tsx', import.meta.url), 'utf8');
  assert.match(archive, /import ZoomableImage from '\.\/ZoomableImage'/);
  assert.match(archive, /isOpen && index === activeIndex \? \(\s*<ZoomableImage key=\{media\.src\}/);
  assert.match(archive, /onZoomChange=\{updateImageZoom\} onDragEnd=\{suppressOverlayCloseBriefly\}/);
  assert.match(archive, /imageZoomRef\.current <= 1/);
  assert.match(archive, /activeIndexRef\.current = swiper\.realIndex;\s*updateImageZoom\(1\)/);
  assert.match(archive, /media\.kind === 'video' \? \(\s*<video/);
  assert.match(archive, /video\.pause\(\)/);
  assert.match(archive, /noSwipingSelector="button, \[data-swiper-native-controls\]"/);
  assert.match(archive, /loop=\{false\}/);
  const css = await readFile(new URL('./ArchiveVideoGallery.module.css', import.meta.url), 'utf8');
  assert.match(css, /\.dialog\.imageDialog \{\s*width: min\(1000px, calc\(100vw - 24px\)\)/);
  assert.match(css, /\.mediaViewport\.imageViewport/);
});
