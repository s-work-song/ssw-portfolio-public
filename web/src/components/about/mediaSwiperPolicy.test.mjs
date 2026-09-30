import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { mediaSlideIndex, mediaSwiperSpeed } from './mediaSwiperPolicy.ts';

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
