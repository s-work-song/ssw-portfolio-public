import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { mediaSlideIndex, mediaSwiperSpeed } from '../../../src/components/media/mediaSwiperPolicy.ts';
import { clampImageTransform, fittedImageGeometry, MAX_IMAGE_ZOOM, wheelImageZoom, zoomImageAt } from '../../../src/components/media/imageZoom.ts';
import { ImageGestureController } from '../../../src/components/media/imageGestures.ts';

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
  const source = await readFile(new URL('../../../src/features/projects/ui/ProjectMediaCarousel.tsx', import.meta.url), 'utf8');
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
  const css = await readFile(new URL('../../../src/features/projects/ui/ProjectMediaCarousel.module.css', import.meta.url), 'utf8');
  assert.match(css, /\.frame > \.swiper > :global\(\.swiper-wrapper\) > \.swiperSlide,\s*\.lightboxFrame > \.swiper > :global\(\.swiper-wrapper\) > \.lightboxSlide \{\s*height: 100%;/);
  const workflowCss = await readFile(new URL('../../../src/app/about-me/ai-workflow/AiWorkflow.module.css', import.meta.url), 'utf8');
  assert.match(workflowCss, /\.stageSwiper > :global\(\.swiper-wrapper\)/);
  assert.doesNotMatch(workflowCss, /\.stageSwiper :global\(\.swiper-wrapper\)/);
});

test('사진 캐러셀은 소수점 폭에서 이웃 사진이 비치지 않도록 간격·정수화·잘림을 함께 적용한다', async () => {
  const source = await readFile(new URL('../../../src/features/projects/ui/ProjectMediaCarousel.tsx', import.meta.url), 'utf8');
  assert.match(source, /spaceBetween: 2/);
  assert.match(source, /roundLengths: true/);
  const css = await readFile(new URL('../../../src/features/projects/ui/ProjectMediaCarousel.module.css', import.meta.url), 'utf8');
  for (const selector of ['swiper', 'swiperSlide', 'lightboxSlide']) {
    assert.match(css, new RegExp(`\\.${selector} \\{[^}]*overflow: hidden;`));
  }
  for (const viewportWidth of [169.125, 320.25, 350.4, 353.75, 550.5, 799.875]) {
    assert.ok(Math.round(viewportWidth) + 2 > viewportWidth, `다음 사진의 시작점은 표시 폭 밖에 있어야 한다: ${viewportWidth}`);
  }
  assert.doesNotMatch(css, /swiperSlide[^}]*visibility: hidden/s, '전환 중 이전·다음 사진은 함께 이동해야 한다');
});

test('아카이브는 비순환 경계·기본 영상 컨트롤·hidden 재오픈·pause 계약을 유지한다', async () => {
  const source = await readFile(new URL('../../../src/components/media/ArchiveVideoGallery.tsx', import.meta.url), 'utf8');
  assert.match(source, /loop=\{false\}/);
  assert.match(source, /rewind=\{false\}/);
  assert.match(source, /disabled=\{activeIndex === 0\}/);
  assert.match(source, /disabled=\{activeIndex === mediaItems\.length - 1\}/);
  assert.match(source, /hidden=\{!isOpen\}/);
  assert.match(source, /const requestedIndex = activeIndexRef\.current;\s*swiper\.update\(\);\s*swiper\.slideTo\(requestedIndex, 0\)/);
  assert.match(source, /preload="auto"/);
  assert.match(source, /video\.play\(\)/);
  assert.match(source, /video\.pause\(\)/);
  assert.match(source, /noSwipingSelector="button, \[data-swiper-native-controls\], \[data-image-zoom-root\]"/);
  assert.doesNotMatch(source, /dragOffset|dragStartX|dragViewportWidth|translate3d|setPointerCapture/);
});

test('핀치 보호는 공개 이동 잠금만 사용하고 CSS·OS 구독은 공유 진입점에 둔다', async () => {
  for (const file of ['features/projects/ui/ProjectMediaCarousel.tsx', 'components/media/ArchiveVideoGallery.tsx']) {
    const source = await readFile(new URL('../../../src/' + file, import.meta.url), 'utf8');
    assert.match(source, /swiper\.allowSlideNext = false/);
    assert.match(source, /swiper\.allowSlidePrev = false/);
    assert.match(source, /onPointerDownCapture=/);
    assert.doesNotMatch(source, /swiper\.touchEventsData|swiper\.touches|swiper\.swipeDirection/);
  }
  const hook = await readFile(new URL('../../../src/components/media/useMediaSwiperMotion.ts', import.meta.url), 'utf8');
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
  const zoom = await readFile(new URL('../../../src/components/media/ZoomableImage.tsx', import.meta.url), 'utf8');
  assert.match(zoom, /addEventListener\('wheel', wheel, \{ passive: false \}\)/);
  assert.match(zoom, /removeEventListener\('wheel', wheel\)/);
  assert.match(zoom, /event\.metaKey \|\| !event\.deltaY/);
  assert.match(zoom, /setPointerCapture\(event\.pointerId\)/);
  assert.match(zoom, /ResizeObserver\(measure\)/);
  assert.match(zoom, /aria-label="이미지 전체 보기"/);
  assert.match(zoom, /data-image-zoom=\{transform\.scale\}/);
  const carousel = await readFile(new URL('../../../src/features/projects/ui/ProjectMediaCarousel.tsx', import.meta.url), 'utf8');
  assert.match(carousel, /index === activeIndex \? \(\s*<ZoomableImage key=\{image\.src\}/);
  assert.match(carousel, /onNavigate=\{hasMultipleImages \? move : undefined\}/);
  assert.match(carousel, /initialSlide=\{activeIndex\} allowTouchMove=\{false\}/);
  assert.match(carousel, /noSwipingSelector="\[data-image-zoom-root\]"/);
  assert.doesNotMatch(carousel, /expandedImageSize|lightboxPortraitFrame/);
  const css = await readFile(new URL('../../../src/components/media/ZoomableImage.module.css', import.meta.url), 'utf8');
  assert.match(css, /grid-template-rows: auto minmax\(0, 1fr\) auto/);
  assert.match(css, /\.viewport \{[^}]*grid-row: 2/);
  assert.match(css, /\.controls \{[^}]*grid-row: 1/);
  assert.match(css, /\.hint \{[^}]*grid-row: 3/);
  assert.match(css, /\.viewport \{[^}]*touch-action: none/);
});

test('캠프파이어 혼합 갤러리는 사진 확대만 공유하고 영상 컨트롤·일시정지·경계를 유지한다', async () => {
  const archive = await readFile(new URL('../../../src/components/media/ArchiveVideoGallery.tsx', import.meta.url), 'utf8');
  assert.match(archive, /import ZoomableImage from '\.\/ZoomableImage'/);
  assert.match(archive, /isOpen && index === activeIndex \? \(\s*<ZoomableImage key=\{media\.src\}/);
  assert.match(archive, /onNavigate=\{mediaItems\.length > 1 \? moveViewer : undefined\} onDragEnd=\{suppressOverlayCloseBriefly\}/);
  assert.match(archive, /allowTouchMove=\{isOpen && mediaItems\.length > 1 && activeMedia\.kind === 'video'\}/);
  assert.match(archive, /media\.kind === 'video' \? \(\s*<video/);
  assert.match(archive, /video\.pause\(\)/);
  assert.match(archive, /noSwipingSelector="button, \[data-swiper-native-controls\], \[data-image-zoom-root\]"/);
  assert.match(archive, /loop=\{false\}/);
  const css = await readFile(new URL('../../../src/components/media/ArchiveVideoGallery.module.css', import.meta.url), 'utf8');
  assert.match(css, /\.dialog\.imageDialog \{\s*width: min\(1000px, calc\(100vw - 24px\)\)/);
  assert.match(css, /\.mediaViewport\.imageViewport/);
});

const gestureGeometry = fittedImageGeometry(300, 200, 900, 600);
function gestures(initial = { scale: 2, x: 0, y: 0 }, geometry = gestureGeometry) {
  const controller = new ImageGestureController();
  let transform = initial;
  return {
    controller,
    get transform() { return transform; },
    down(id, x, y) { controller.down(id, { x, y }, transform, geometry); },
    move(id, x, y) { transform = controller.move(id, { x, y }, transform, geometry); return transform; },
    up(id, x, y, cancelled = false) {
      const result = controller.up(id, { x, y }, transform, geometry, cancelled);
      transform = result.transform;
      return result.navigate;
    },
  };
}

test('중간에서 끝까지 밀고 계속 밀어도 넘기지 않고, 손을 뗀 뒤 끝에서 새로 밀어야 넘긴다', () => {
  for (const sign of [-1, 1]) {
    const g = gestures();
    g.down(1, 0, 0);
    g.move(1, sign * 200, 0);
    g.move(1, sign * 400, 0);
    assert.equal(g.transform.x, sign * 150);
    assert.equal(g.up(1, sign * 400, 0), null);
    g.down(2, 0, 0);
    assert.equal(g.up(2, sign * 80, 0), -sign);
    assert.equal(g.controller.active, false);
  }
});

test('끝에서 안쪽으로 시작한 이동은 반대로 끝까지 밀어도 같은 접촉에서 넘기지 않는다', () => {
  const g = gestures({ scale: 2, x: -150, y: 0 });
  g.down(1, 0, 0);
  g.move(1, 30, 0);
  assert.equal(g.transform.x, -120);
  g.move(1, -300, 0);
  assert.equal(g.up(1, -300, 0), null);
});

test('100%와 가로 이동 여지가 없는 세로 이미지도 한 번의 가로 스와이프로 넘긴다', () => {
  for (const g of [gestures({ scale: 1, x: 0, y: 0 }), gestures({ scale: 2, x: 0, y: 0 }, fittedImageGeometry(600, 400, 100, 1000))]) {
    g.down(1, 0, 0);
    assert.equal(g.up(1, -80, 0), 1);
    g.down(2, 0, 0);
    assert.equal(g.up(2, 80, 0), -1);
  }
});

test('경계 소수점 오차는 2px까지만 허용하며 중간 위치를 끝으로 취급하지 않는다', () => {
  for (const [x, expected] of [[-148, 1], [-147.9, null], [-150, 1]]) {
    const g = gestures({ scale: 2, x, y: 0 });
    g.down(1, 0, 0);
    assert.equal(g.up(1, -80, 0), expected);
  }
});

test('짧은 흔들림·세로·대각선·방향 반전·중간 세로 이동은 사진 넘김이 아니다', () => {
  for (const path of [
    [[-47, 0]], [[-60, 100]], [[0, 20], [-100, 20]],
    [[-10, 0], [80, 0]], [[-10, 0], [-50, 150], [-80, 0]],
  ]) {
    const g = gestures({ scale: 2, x: -150, y: 0 });
    g.down(1, 0, 0);
    for (const [x, y] of path) g.move(1, x, y);
    assert.equal(g.up(1, ...path.at(-1)), null);
  }
});

test('핀치 거리를 배율로 바꾸고 두 손가락 중심 이동을 이미지 좌표에 반영한다', () => {
  const g = gestures({ scale: 1, x: 0, y: 0 });
  g.down(1, -50, 0); g.down(2, 50, 0);
  g.move(1, -100, 0); g.move(2, 100, 0);
  assert.deepEqual(g.transform, { scale: 2, x: 0, y: 0 });
  g.move(1, -80, 20); g.move(2, 120, 20);
  assert.deepEqual(g.transform, { scale: 2, x: 20, y: 20 });
});

test('핀치의 시작 중심 아래 이미지 지점을 유지한다', () => {
  const g = gestures();
  g.down(1, -20, 10); g.down(2, 80, 10);
  g.move(1, -70, 10); g.move(2, 130, 10);
  assert.deepEqual(g.transform, { scale: 4, x: -30, y: -10 });
});

test('핀치로 100~800%를 벗어나지 않고 닿아 있는 두 손가락 거리도 안전하게 처리한다', () => {
  const g = gestures({ scale: 1, x: 0, y: 0 });
  g.down(1, 0, 0); g.down(2, 0, 0);
  g.move(2, 10, 0);
  g.move(2, 10000, 0);
  assert.equal(g.transform.scale, 8);
  g.move(2, .1, 0);
  assert.deepEqual(g.transform, { scale: 1, x: 0, y: 0 });
});

test('핀치 후 한 손가락만 남거나 새 손가락이 추가되어도 모두 떼기 전에는 넘기지 않는다', () => {
  const g = gestures({ scale: 1, x: 0, y: 0 });
  g.down(1, -50, 0); g.down(2, 50, 0);
  assert.equal(g.up(2, 50, 0), null);
  assert.equal(g.move(1, -300, 0).scale, 1);
  g.down(3, -200, 0);
  assert.equal(g.up(3, -200, 0), null);
  assert.equal(g.up(1, -400, 0), null);
  g.down(4, 0, 0);
  assert.equal(g.up(4, -80, 0), 1);
});

test('드래그 중 두 번째 손가락이 오면 넘김 후보를 취소하고 핀치로 전환한다', () => {
  const g = gestures({ scale: 1, x: 0, y: 0 });
  g.down(1, 0, 0); g.move(1, -70, 0);
  g.down(2, 30, 0);
  g.move(2, 130, 0);
  assert.equal(g.transform.scale, 2);
  assert.equal(g.up(1, -70, 0), null);
  assert.equal(g.up(2, 130, 0), null);
});

test('pointercancel·lost capture·reset·중복 종료 뒤에는 잘못된 넘김이나 잠금이 남지 않는다', () => {
  const g = gestures({ scale: 1, x: 0, y: 0 });
  g.down(1, 0, 0); g.move(1, -100, 0);
  assert.equal(g.up(1, -100, 0, true), null);
  assert.equal(g.up(1, -100, 0), null);
  assert.equal(g.controller.active, false);
  g.down(2, 0, 0); g.move(2, -100, 0); g.controller.reset();
  assert.equal(g.up(2, -100, 0), null);
  g.down(3, 0, 0);
  assert.equal(g.up(3, -100, 0), 1);
});
