import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(new URL('../../../../src/features/architecture/ui/DeploymentDiagramCarousel.tsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../../../../src/features/architecture/ui/DeploymentDiagramCarousel.module.css', import.meta.url), 'utf8');

test('전체 연결 그림 없이 프로젝트 카드와 상세 캐러셀만 보여준다', async () => {
  const overview = await readFile(new URL('../../../../src/features/architecture/ui/DeploymentOverview.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(overview, /['"]use client['"]/u);
  assert.doesNotMatch(overview, /deploymentOverviewDiagram|<MermaidDiagram|전체 구조도/u);
  assert.match(overview, /<DeploymentDiagramCarousel diagrams=\{deploymentDiagrams\} \/>/u);
  assert.match(overview, /LLM 추론은 각 웹의 서버 측에서 요청/u);
  const order = ['deploymentProjects.map', '외부 공개 경계', '<DeploymentDiagramCarousel']
    .map((text) => overview.indexOf(text));
  assert.ok(order.every((position, index) => position >= 0 && (!index || position > order[index - 1])));
  assert.doesNotMatch(overview, /DeploymentMemoryHistory|infrastructureMigrationReasons|infrastructureTransition/u);
});

test('Swiper는 자동 넘김과 반복 없이 기존 모션 설정을 사용한다', () => {
  assert.match(component, /useMediaSwiperSpeed\(\)/u);
  assert.match(component, /modules=\{swiperModules\} a11y=\{swiperA11y\}/u);
  assert.match(component, /loop=\{false\} autoHeight speed=\{speed\}/u);
  assert.doesNotMatch(component, /autoplay|(?:import|modules=)[^\n]*\bKeyboard\b|setInterval|loop=\{true\}/u);
  assert.match(css, /prefers-reduced-motion: reduce/u);
});

test('이름 선택·이전·다음과 번호 안내는 기본 키보드·접근성 계약을 유지한다', () => {
  assert.match(component, /role="region" aria-roledescription="carousel"/u);
  assert.match(component, /aria-labelledby=\{headingId\} tabIndex=\{0\}/u);
  assert.match(component, /aria-pressed=\{index === activeIndex\}/u);
  assert.match(component, /disabled=\{activeIndex === 0\} aria-label="이전 프로젝트"/u);
  assert.match(component, /disabled=\{activeIndex === diagrams\.length - 1\} aria-label="다음 프로젝트"/u);
  assert.match(component, /aria-live="polite" aria-atomic="true"/u);
  assert.match(component, /event\.target !== event\.currentTarget/u);
  for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) assert.ok(component.includes(`'${key}'`));
  assert.match(css, /\.projectSelector\s*\{[^}]*flex-wrap:\s*wrap/u);
  assert.doesNotMatch(css, /overflow-x:\s*(?:auto|scroll)/u);
});

test('비활성 슬라이드는 접근성에서 숨기되 방문한 그림은 퇴장 애니메이션과 재방문을 위해 보존한다', () => {
  assert.match(component, /aria-hidden=\{index !== activeIndex\} inert=\{index !== activeIndex\}/u);
  assert.match(component, /useState\(\(\) => new Set\(\[0\]\)\)/u);
  assert.match(component, /setVisitedIndices\(previous => new Set\(previous\)\.add\(nextIndex\)\)/u);
  assert.match(component, /visitedIndices\.has\(index\) && \([\s\S]*?<MermaidDiagram/u);
  assert.doesNotMatch(component, /index === activeIndex && \(/u);
  assert.equal(component.split('<MermaidDiagram').length - 1, 1);
});

test('현재 SVG의 비동기 높이 변화는 고정 높이 없이 Swiper에 반영한다', () => {
  assert.match(component, /new ResizeObserver\(updateHeight\)/u);
  assert.match(component, /observer\.observe\(content\)/u);
  assert.match(component, /swiper\.updateAutoHeight\(\)/u);
  assert.doesNotMatch(component, /updateAutoHeight\(0\)/u);
  assert.match(component, /observer\.disconnect\(\)/u);
  assert.match(css, /\.slide\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%[^}]*overflow:\s*hidden[^}]*height:\s*auto/u);
  for (const selector of ['frame', 'swiper', 'slide', 'content']) {
    const rule = css.match(new RegExp(`\\.${selector}\\s*\\{([^}]+)\\}`, 'u'))?.[1];
    assert.ok(rule);
    assert.doesNotMatch(rule, /(?:^|[;{\s])(?:min-)?height:\s*\d+(?:px|vh|rem)/u);
  }
});

test('슬라이드를 바꾸기 전에 이전 높이를 유지하고 현재 다이어그램이 준비된 뒤만 해제한다', () => {
  const capture = component.indexOf('const previousContent =');
  const floor = component.indexOf('slide.style.minHeight =');
  const selection = component.indexOf('activeIndexRef.current = nextIndex');
  assert.ok(capture >= 0 && floor > capture && selection > floor);
  assert.match(component, /Math\.max\([\s\S]*?previousContent\?\.getBoundingClientRect\(\)\.height \?\? 0,[\s\S]*?swiper\.wrapperEl\.getBoundingClientRect\(\)\.height/u);
  assert.match(component, /style=\{\{ minHeight: heldHeight \?\? undefined \}\}/u);
  assert.match(component, /if \(index !== activeIndexRef\.current\) return;\s*if \(swiperRef\.current\?\.animating\) return;/u);
  assert.match(component, /swiperRef\.current\?\.slides\.forEach\(slide => \{ slide\.style\.minHeight = ''; \}\);\s*setHeldHeight\(null\)/u);
  assert.match(component, /readyIndices\.current\.add\(index\)/u);
  assert.match(component, /onTransitionEnd=\{finishTransition\}/u);
  assert.match(component, /readyIndices\.current\.has\(activeIndexRef\.current\)/u);
  assert.match(component, /onSettled=\{\(\) => releaseHeight\(index\)\}/u);
  assert.match(component, /\[activeIndex, diagrams\.length, heldHeight\]/u);
});

test('세로 스크롤·핀치 확대는 브라우저에 맡기고 두 손가락 동안 Swiper를 잠근다', () => {
  assert.match(css, /touch-action:\s*pan-y pinch-zoom/u);
  assert.match(component, /touchStartPreventDefault=\{false\}/u);
  assert.match(component, /touchPointers\.current\.size < 2/u);
  assert.match(component, /swiper\.allowTouchMove = false/u);
  assert.match(component, /swiper\.allowSlideNext = false/u);
  assert.match(component, /swiper\.allowSlidePrev = false/u);
  assert.match(component, /swiper\.slideTo\(activeIndexRef\.current, 0, false\)/u);
  assert.match(component, /onPointerCancelCapture=\{capturePointerEnd\}/u);
});

test('개발 환경은 배포 프로젝트 카드와 구분되는 별도 정적 섹션으로 한 번만 표시한다', async () => {
  const environment = await readFile(new URL('../../../../src/features/architecture/ui/DevelopmentEnvironmentOverview.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(environment, /['"]use client['"]|deploymentProjects|deploymentDiagrams/u);
  assert.match(environment, /id="development-environment"/u);
  assert.match(environment, /aria-labelledby="development-environment-title"/u);
  assert.match(environment, /개발 환경 연결 구조/u);
  assert.match(environment, /어느 기기에서 어떤 도구에 접속하는지와 기기 간 연결/u);
  assert.match(environment, /폰에서 조작하는 앱과 실제 작업이 실행되는 PC/u);
  assert.match(environment, /<DevelopmentEnvironmentDiagram \/>/u);
  assert.doesNotMatch(environment, /DevelopmentAccessOverview|DevelopmentTopology/u);
  assert.doesNotMatch(environment, /MermaidDiagram/u);
  assert.doesNotMatch(environment, /fetch\(|현재 연결됨|온라인|https?:\/\/|localhost|192\.168\./u);
  const page = await readFile(new URL('../../../../src/app/about-me/architecture/page.tsx', import.meta.url), 'utf8');
  assert.equal(page.split('<DevelopmentEnvironmentOverview />').length - 1, 1);
  const order = ['<DevelopmentEnvironmentOverview />', '<DeploymentOverview />'].map((text) => page.indexOf(text));
  assert.ok(order.every((position, index) => position >= 0 && (!index || position > order[index - 1])));
});
