import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';
import { aiWorkflowExamples, aiWorkflowLearning, aiWorkflowStories, aiWorkflowStages, aiWorkflowTools, aiWorkflowCliTools, aiWorkflowOrchestrationConnections } from '../../../../src/features/ai-workflow/data/aiWorkflow.ts';
import { aboutTabPathFromPath } from '../../../../src/features/chat/navigation.ts';
import { workflowStageFromHash, workflowStageIndexFromHash, workflowStageIndexForKey } from '../../../../src/features/ai-workflow/navigation/workflowStageNavigation.ts';
import { scrollToWorkflowStageNav } from '../../../../src/features/ai-workflow/navigation/workflowStageScroll.ts';

test('SI 활용 다섯 단계는 고유 앵커와 역할 설명을 갖는다', () => {
  assert.deepEqual(aiWorkflowStages.map(({ id }) => id), ['chat', 'read-only', 'implementation', 'tools', 'orchestration']);
  assert.deepEqual(aiWorkflowStages.map(({ number }) => number), ['01', '02', '03', '04', '05']);
  for (const stage of aiWorkflowStages) {
    for (const key of ['shortTitle', 'navDescription', 'title', 'description', 'aiRole', 'humanRole', 'change', 'captureNote']) {
      assert.ok(typeof stage[key] === 'string' && stage[key].trim(), `${stage.id}.${key}`);
    }
  }
});

test('05 단계는 구현·검수의 요청과 보고를 모두 조율 세션으로 연결하고 보고 뒤 다음 실행을 판단한다', async () => {
  assert.deepEqual(aiWorkflowOrchestrationConnections.map(({ step, from, to }) => [step, from, to]), [
    [1, 'coordinator', 'implementer'], [2, 'implementer', 'coordinator'],
    [3, 'coordinator', 'reviewer'], [4, 'reviewer', 'coordinator'],
  ]);
  const flow = await readFile(new URL('../../../../src/features/ai-workflow/ui/WorkflowOrchestrationFlow.tsx', import.meta.url), 'utf8');
  assert.match(flow, /aiWorkflowOrchestrationConnections\.filter/);
  assert.doesNotMatch(flow, /styles\.forward|styles\.returnConnector/);
  const content = await readFile(new URL('../../../../src/features/ai-workflow/ui/WorkflowStageContent.tsx', import.meta.url), 'utf8');
  assert.match(content, /stage\.id === 'orchestration' \? <WorkflowOrchestrationFlow/);
  assert.match(content, /stage\.id === 'orchestration' && <WorkflowOrchestrationReview/);
});

test('05 모바일은 같은 요청·보고 데이터를 시간순 타임라인으로 읽고 데스크톱 관계도와 분리한다', async () => {
  const flow = await readFile(new URL('../../../../src/features/ai-workflow/ui/WorkflowOrchestrationFlow.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../../../src/features/ai-workflow/ui/WorkflowOrchestrationFlow.module.css', import.meta.url), 'utf8');
  assert.match(flow, /<WorkflowOrchestrationTimeline coordinator={coordinator} \/>/);
  assert.match(flow, /aiWorkflowOrchestrationConnections\.map/);
  assert.match(flow, /roles\[edge\.from\].*roles\[edge\.to\]/);
  assert.doesNotMatch(flow, /mobileCoordinator/);
  assert.match(css, /\.desktopFlow \{ display: contents; \}/);
  assert.match(css, /\.mobileTimeline \{ display: none; \}/);
  const mobile = css.slice(css.indexOf('@media (max-width: 760px)'));
  assert.match(mobile, /\.desktopFlow \{ display: none; \}/);
  assert.match(mobile, /\.mobileTimeline \{ display: grid;/);
  assert.match(mobile, /\.timelineStep:first-child \.timelineRail::after/);
});

test('05 모바일 타임라인은 조율 역할을 설명하는 카드 안에 있고 사람의 검토는 카드 밖에 둔다', async () => {
  const flow = await readFile(new URL('../../../../src/features/ai-workflow/ui/WorkflowOrchestrationFlow.tsx', import.meta.url), 'utf8');
  const timeline = flow.slice(flow.indexOf('function WorkflowOrchestrationTimeline('), flow.indexOf('export function WorkflowOrchestrationReview('));
  assert.match(timeline, /<section className={styles\.mobileTimeline} aria-labelledby="mobile-orchestration-title">/);
  assert.match(timeline, /<h4 id="mobile-orchestration-title">{coordinator\.title}<\/h4>/);
  assert.match(timeline, /<p>{coordinator\.detail}<\/p>/);
  assert.match(timeline, /className={styles\.timelineCycle}/);
  assert.doesNotMatch(timeline, /styles\.humanNode/);
});

test('실제 사례는 있는 단계에 연결하고 사용 환경만 남기며 모델 정보는 공개하지 않는다', () => {
  const stageIds = new Set(aiWorkflowStages.map(({ id }) => id));
  assert.ok(Object.keys(aiWorkflowExamples).every((id) => stageIds.has(id)));
  for (const example of Object.values(aiWorkflowExamples)) {
    assert.deepEqual(Object.keys(example.environment).sort(), ['project', 'tool']);
    assert.ok(example.summary && example.privacyNote);
    assert.doesNotMatch(JSON.stringify(example), /[A-Z]:[\\/]|https?:\/\/|_si-adoption-levels-imgs/u);
    assert.doesNotMatch(JSON.stringify(example), /Gemini|GPT-\d|Extra High|사용 모델/u);
  }
  for (const id of ['chat', 'read-only', 'implementation']) assert.ok(aiWorkflowExamples[id].request);
});

test('공개 캡처는 실제 WebP 파일이고 필수 설명을 갖는다', async () => {
  const captures = ['chat', 'read-only', 'implementation'].flatMap((id) => aiWorkflowExamples[id].captures);
  for (const capture of captures) {
    assert.match(capture.src, /^\/images\/si-adoption\/[a-z/-]+[0-9a-z-]+\.webp$/);
    assert.ok(capture.alt && capture.caption && capture.title && capture.detail);
    const bytes = await readFile(new URL(`../../../../public${capture.src}`, import.meta.url));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  }
});

test('사례 렌더러는 도구 소개 뒤에 놓이고 관련 링크의 앵커가 소개 페이지에 있다', async () => {
  const example = aiWorkflowExamples.tools;
  const about = await readFile(new URL('../../../../src/features/overview/data/about.ts', import.meta.url), 'utf8');
  const anchor = example.relatedLink.href.split('#')[1];
  assert.ok(about.includes(`id: '${anchor}'`), anchor);
  const content = await readFile(new URL('../../../../src/features/ai-workflow/ui/WorkflowStageContent.tsx', import.meta.url), 'utf8');
  assert.ok(content.indexOf('<WorkflowTools />') < content.indexOf('<WorkflowExample'));
  const component = await readFile(new URL('../../../../src/features/ai-workflow/ui/WorkflowExample.tsx', import.meta.url), 'utf8');
  assert.match(component, /example\.request &&/);
  assert.match(component, /frameAspectRatio=\{example\.frameAspectRatio\}/);
  assert.match(component, /href=\{example\.relatedLink\.href\}/);
});

test('FFmpeg 사례는 동적인 게임·앱 화면 검토로의 활용을 별도 카드로 설명한다', async () => {
  const note = aiWorkflowExamples.tools.applicationNote;
  assert.ok(note?.title && note.description);
  const component = await readFile(new URL('../../../../src/features/ai-workflow/ui/WorkflowExample.tsx', import.meta.url), 'utf8');
  assert.match(component, /example\.applicationNote &&/);
  assert.match(component, /<aside className=\{styles\.applicationNote\} aria-labelledby=/);
  assert.match(component, /<h5 id=\{`example-\$\{stageId\}-applications-title`\}>/);
  assert.ok(component.indexOf('</ol>') < component.indexOf('className={styles.applicationNote}'));
  assert.ok(component.indexOf('className={styles.applicationNote}') < component.indexOf('<WorkflowCaptureGallery'));
});

test('FFmpeg 사례 사진은 로컬 WebP이고 메타데이터를 제외한다', async () => {
  for (const capture of aiWorkflowExamples.tools.captures) {
    assert.match(capture.src, /^\/images\/(?:si-adoption\/tools|archive\/android-ar-campfire)\/[a-z0-9-]+\.webp$/);
    assert.ok(capture.title && capture.detail && capture.alt && capture.caption);
    const bytes = await readFile(new URL(`../../../../public${capture.src}`, import.meta.url));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, 'webp');
    for (const key of ['exif', 'xmp', 'iptc']) assert.equal(metadata[key], undefined);
  }
});

test('02·03 단계에서 모델명이 표시된 다섯 캡처의 해당 영역은 불투명 단색으로 가려져 있다', async () => {
  const regions = [
    ['read-only/01-codebase-scan.webp', 1588, 1280, 196, 42, 38],
    ['implementation/01-implementation-request.webp', 1885, 1452, 215, 40, 43],
    ['implementation/02-code-review-request.webp', 2605, 1452, 220, 40, 43],
    ['implementation/04-screen-annotation.webp', 2605, 1452, 220, 40, 43],
    ['implementation/05-layout-result.webp', 2605, 1452, 220, 40, 43],
  ];
  for (const [file, left, top, width, height, color] of regions) {
    const bytes = await readFile(new URL(`../../../../public/images/si-adoption/${file}`, import.meta.url));
    const pixels = await sharp(bytes).extract({ left, top, width, height }).removeAlpha().raw().toBuffer();
    assert.ok(pixels.every((value) => value === color), file);
  }
});

test('05 단계는 본문·이미지·후속 설명을 스크롤 순서로 배치하고 사진 슬라이더를 쓰지 않는다', async () => {
  const story = aiWorkflowStories.orchestration;
  assert.doesNotMatch(JSON.stringify(story), /[A-Z]:[\\/]|https?:\/\/|_si-adoption-levels-imgs|Fable|사용 모델|\.md\b|\.sh\b|@[a-z0-9.-]+\.[a-z]+/u);
  const content = await readFile(new URL('../../../../src/features/ai-workflow/ui/WorkflowStageContent.tsx', import.meta.url), 'utf8');
  assert.match(content, /aiWorkflowStories\[stage\.id\]/);
  assert.match(content, /story && <WorkflowStory/);
  const component = await readFile(new URL('../../../../src/features/ai-workflow/ui/WorkflowStory.tsx', import.meta.url), 'utf8');
  assert.match(component, /story\.sections\.map/);
  assert.ok(component.indexOf('section.paragraphs.map') < component.indexOf('<WorkflowInlineCapture'));
  const image = await readFile(new URL('../../../../src/features/ai-workflow/ui/WorkflowInlineCapture.tsx', import.meta.url), 'utf8');
  for (const source of [component, image]) assert.doesNotMatch(source, /Swiper|ProjectMediaCarousel["']|WorkflowCaptureGallery|aria-roledescription="carousel"|새 탭/);
  assert.match(image, /<Image[^]*?width=\{capture\.width\} height=\{capture\.height\}/);
  assert.match(image, /<ZoomableImage/);
  assert.match(image, /<MediaDialog/);
  assert.match(image, /returnFocus=\{\(\) => triggerRef\.current\}/);
  assert.match(image, /mediaDialogOutsideCloseAllowed/);
});

test('05 사전 통보 캡처는 세션 메시지와 수신 측 판단을 보존하고 권한 식별자·경로만 불투명하게 가린다', async () => {
  const capture = aiWorkflowStories.orchestration.sections[1].capture;
  const bytes = await readFile(new URL(`../../../../public${capture.src}`, import.meta.url));
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, capture.width);
  assert.equal(metadata.height, capture.height);
  for (const key of ['exif', 'xmp', 'iptc']) assert.equal(metadata[key], undefined);
  for (const [left, top, width, height] of [[759, 75, 101, 25], [530, 98, 198, 26]]) {
    const pixels = await sharp(bytes).extract({ left, top, width, height }).removeAlpha().raw().toBuffer();
    assert.ok(pixels.every((value) => value === 36), `${left},${top}`);
  }
});

test('05 공개 캡처는 원본 해상도의 검토된 불투명 가림 사본이며 메타데이터를 제외한다', async () => {
  const capture = aiWorkflowStories.orchestration.sections[0].capture;
  const bytes = await readFile(new URL(`../../../../public${capture.src}`, import.meta.url));
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, capture.width);
  assert.equal(metadata.height, capture.height);
  for (const key of ['exif', 'xmp', 'iptc']) assert.equal(metadata[key], undefined);
  const regions = [
    [1, 258, 473, 323, 17], [1, 659, 473, 830, 17],
    [720, 30, 965, 150, 32], [725, 437, 465, 31, 36],
    [855, 551, 159, 31, 36], [1099, 551, 214, 31, 36], [1328, 551, 168, 31, 36],
    [725, 643, 812, 32, 36], [762, 841, 895, 31, 36], [762, 869, 179, 31, 36],
    [850, 895, 235, 31, 36], [720, 1026, 965, 47, 36],
    [1744, 143, 316, 102, 32], [1760, 497, 288, 38, 32], [1740, 599, 320, 101, 32],
    [2191, 1060, 507, 150, 32], [2195, 1418, 560, 71, 32], [1460, 1440, 221, 49, 32],
  ];
  for (const [left, top, width, height, color] of regions) {
    const pixels = await sharp(bytes).extract({ left, top, width, height }).removeAlpha().raw().toBuffer();
    assert.ok(pixels.every((value) => value === color), `${left},${top}`);
  }
});

test('04 단계의 도구 카드는 id가 겹치지 않고 로컬 아이콘은 스크립트 없는 파일이다', async () => {
  const allTools = [...aiWorkflowTools, ...aiWorkflowCliTools];
  assert.equal(new Set(allTools.map(({ id }) => id)).size, allTools.length);
  for (const tool of allTools) {
    assert.ok(tool.detail);
    assert.deepEqual(Object.keys(tool).sort(), ['detail', 'icon', 'id', 'name']);
    assert.match(tool.icon, /^\/icons\/workflow-tools\/[a-z-]+\.(?:svg|webp)$/);
    if (tool.icon.endsWith('.webp')) {
      const bytes = await readFile(new URL(`../../../../public${tool.icon}`, import.meta.url));
      assert.equal((await sharp(bytes).metadata()).format, 'webp');
      continue;
    }
    const svg = await readFile(new URL(`../../../../public${tool.icon}`, import.meta.url), 'utf8');
    assert.match(svg, /<svg\b[^>]*viewBox=/);
    assert.doesNotMatch(svg, /<script|<foreignObject|<image\b/);
    assert.doesNotMatch(svg, /(?:href|src)="(?!#)/);
  }
  const content = await readFile(new URL('../../../../src/features/ai-workflow/ui/WorkflowStageContent.tsx', import.meta.url), 'utf8');
  assert.match(content, /stage\.id === 'tools' && <WorkflowTools \/>/);
  const component = await readFile(new URL('../../../../src/features/ai-workflow/ui/WorkflowTools.tsx', import.meta.url), 'utf8');
  assert.match(component, /aiWorkflowToolGroups\.map/);
  assert.match(component, /group\.tools\.map/);
  assert.match(component, /data-group=\{group\.id\}/);
  assert.doesNotMatch(component, /tool\.command|toolCommand|<code\b/);
  assert.match(component, /\$\{basePath\}\$\{tool\.icon\}/);
  assert.match(component, /alt=""/);
  assert.doesNotMatch(component, /<button\b|<a\b|WorkflowCaptureGallery/);
  const notice = await readFile(new URL('../../../../public/icons/workflow-tools/NOTICE.txt', import.meta.url), 'utf8');
  assert.match(notice, /Simple Icons/);
  assert.match(notice, /GitHub: https:\/\/github\.com\/logos/);
  assert.match(notice, /Git logo by Jason Long, CC BY 3\.0/);
  assert.match(notice, /Android robot.*adb CLI/s);
  assert.match(notice, /work created and shared by Google.*Creative Commons 3\.0 Attribution License/);
  assert.match(notice, /Podman: https:\/\/podman\.io/);
  assert.match(notice, /Podman color symbol: unmodified WebP used by the official Podman website navbar/);
  assert.match(notice, /913ceb777a00360fbbe0f697bc36f54781ca3b1b\/static\/logos\/optimized\/podman-3-logo-266w-253h\.webp/);
  const podmanLicense = await readFile(new URL('../../../../public/icons/workflow-tools/LICENSE-podman.txt', import.meta.url), 'utf8');
  assert.match(podmanLicense, /Apache License.*Version 2\.0/s);
  assert.match(notice, /MIT License.*OpenPencil contributors/s);
});

test('CLI 카드 그룹의 생략 표시는 동작 없는 안내로 둔다', async () => {
  const component = await readFile(new URL('../../../../src/features/ai-workflow/ui/WorkflowTools.tsx', import.meta.url), 'utf8');
  assert.match(component, /group\.id === 'cli' &&/);
  assert.match(component, /<li className=\{styles\.toolMore\} style=/);
  assert.match(component, /'--tool-more-span': Math\.max\(1, 7 - group\.tools\.length\)/);
});

test('단계 탭은 기존 직접 링크·챗봇 헤더·사례 앵커를 올바른 패널로 연결한다', () => {
  aiWorkflowStages.forEach((stage, index) => {
    for (const hash of [`#workflow-${stage.id}`, `#workflow-header-${stage.id}`, `#example-${stage.id}`]) {
      assert.equal(workflowStageFromHash(hash), stage.id);
      assert.equal(workflowStageIndexFromHash(hash), index);
    }
  });
  assert.equal(workflowStageFromHash('#workflow-tools-gallery-title'), 'tools');
  for (const hash of ['', '#ai-workflow-intro', '#workflow-tools-extra', '#workflow-header-unknown', '#%']) {
    assert.equal(workflowStageFromHash(hash), 'chat');
  }
  assert.equal(workflowStageIndexForKey('ArrowRight', 4), 0);
  assert.equal(workflowStageIndexForKey('ArrowLeft', 0), 4);
  assert.equal(workflowStageIndexForKey('Home', 3), 0);
  assert.equal(workflowStageIndexForKey('End', 1), 4);
  for (const key of ['Tab', 'Enter', ' ', 'ArrowDown']) assert.equal(workflowStageIndexForKey(key, 1), null);
});

test('상하단 단계 선택은 기존 카드형 버튼을 공유하고 본문은 퇴장·입장 슬라이드와 독립 갤러리를 유지한다', async () => {
  const page = await readFile(new URL('../../../../src/app/about-me/ai-workflow/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /<WorkflowStageTabs panels=\{aiWorkflowStages\.map/);
  assert.doesNotMatch(page, /<WorkflowStageNav/);
  const tabs = await readFile(new URL('../../../../src/features/ai-workflow/ui/WorkflowStageTabs.tsx', import.meta.url), 'utf8');
  assert.equal((tabs.match(/<WorkflowStageNav\b/g) ?? []).length, 2);
  for (const pattern of [/autoHeight speed=\{speed\}/, /useMediaSwiperSpeed\(\)/, /allowTouchMove=\{false\}/, /simulateTouch=\{false\}/, /inert=\{index !== activeIndex\}/, /<SwiperSlide/, /\{panels\[index\]\}/, /new ResizeObserver/, /swiper\.updateAutoHeight\(\)/, /addEventListener\('popstate'/, /addEventListener\('hashchange'/, /window\.history\.pushState\(window\.history\.state/]) {
    assert.match(tabs, pattern);
  }
  assert.doesNotMatch(tabs, /index === activeIndex &&|activeIndex === index &&/);
  const nav = await readFile(new URL('../../../../src/features/ai-workflow/ui/WorkflowStageNav.tsx', import.meta.url), 'utf8');
  for (const text of ['role="tablist"', 'role="tab"', 'aria-controls=', 'aria-selected={current}', 'tabIndex={current ? 0 : -1}', 'workflowStageIndexForKey', 'styles.jumpNumber', 'styles.jumpDescription']) assert.ok(nav.includes(text), text);
  assert.doesNotMatch(nav, /scrollToStage|scrollIntoView/);
});

test('하단 선택은 고유 탭 ID와 공통 선택 상태를 쓰고 상단 도착 후에만 초점·단계를 바꾼다', async () => {
  const tabs = await readFile(new URL('../../../../src/features/ai-workflow/ui/WorkflowStageTabs.tsx', import.meta.url), 'utf8');
  assert.match(tabs, /<WorkflowStageNav currentStageId=\{activeId\} onSelect=\{selectStage\}/);
  assert.match(tabs, /<WorkflowStageNav currentStageId=\{activeId\} onSelect=\{selectStageFromBottom\} position="bottom"/);
  assert.ok(tabs.indexOf('position="bottom"') > tabs.indexOf('</Swiper>'));
  const handler = tabs.match(/function selectStageFromBottom\(id: AiWorkflowStageId\) \{([^]*?)\n  \}/)?.[1];
  assert.ok(handler);
  assert.match(handler, /scrollToWorkflowStageNav\(target, speed > 0, \(\) => \{/);
  assert.match(handler, /getElementById\(`workflow-tab-\$\{id\}`\)\?\.focus\(\{ preventScroll: true \}\)/);
  assert.ok(handler.indexOf('scrollToWorkflowStageNav') < handler.indexOf('selectStage(id)'));
  assert.ok(handler.indexOf('.focus') < handler.indexOf('selectStage(id)'));
  assert.doesNotMatch(handler, /scrollIntoView|behavior: 'instant'/);
  assert.match(tabs, /useEffect\(\(\) => \(\) => \{ cancelNavScrollRef\.current\?\.\(\); \}, \[hash, speed\]\)/);
  const nav = await readFile(new URL('../../../../src/features/ai-workflow/ui/WorkflowStageNav.tsx', import.meta.url), 'utf8');
  assert.match(nav, /position === 'top' \? 'workflow-tab' : 'workflow-bottom-tab'/);
  assert.match(nav, /id=\{`\$\{tabIdPrefix\}-\$\{stage\.id\}`\}/);
  assert.match(nav, /getElementById\(`\$\{tabIdPrefix\}-\$\{stage\.id\}`\)/);
  assert.ok(nav.indexOf('.focus') < nav.indexOf('onSelect(stage.id)'));
});

function workflowScrollFixture({ scrollY = 8000, navTop = 1108 } = {}) {
  const frames = new Map();
  const commands = [];
  let nextFrame = 0;
  const view = Object.assign(new EventTarget(), {
    scrollY, scrollX: 0, innerHeight: 900,
    performance: { now: () => 0 },
    getComputedStyle: (target) => target === document.documentElement ? { scrollPaddingTop: '84px' } : { scrollMarginTop: '24px' },
    scrollTo: (options) => { commands.push(options); if (options.behavior === 'instant') view.scrollY = options.top; },
    requestAnimationFrame: (callback) => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: (id) => frames.delete(id),
  });
  const document = { defaultView: view, documentElement: { scrollHeight: 12000 }, scrollingElement: { scrollHeight: 12000 } };
  const target = { ownerDocument: document, getBoundingClientRect: () => ({ top: navTop - view.scrollY }) };
  const tick = (timestamp) => { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(timestamp); };
  return { view, target, commands, frames, tick };
}

test('브라우저가 기본 스크롤을 즉시 실행해도 모션 켬은 첫 프레임에 상단으로 점프하지 않는다', () => {
  const fixture = workflowScrollFixture();
  fixture.view.scrollTo = (options) => { fixture.commands.push(options); fixture.view.scrollY = options.top; };
  let arrivals = 0;
  scrollToWorkflowStageNav(fixture.target, true, () => { arrivals++; });
  assert.equal(fixture.view.scrollY, 8000);
  fixture.tick(0);
  assert.equal(fixture.view.scrollY, 8000);
  fixture.tick(160);
  assert.ok(fixture.view.scrollY < 8000 && fixture.view.scrollY > 1000);
  assert.equal(arrivals, 0);
});

test('하단 선택은 부드러운 스크롤 도중 본문을 유지하고 헤더 여백을 반영한 상단 도착 뒤 전환한다', () => {
  const fixture = workflowScrollFixture();
  let arrivals = 0;
  scrollToWorkflowStageNav(fixture.target, true, () => { arrivals++; });
  assert.deepEqual(fixture.commands, []);
  fixture.tick(0);
  fixture.tick(200);
  assert.ok(fixture.view.scrollY < 8000 && fixture.view.scrollY > 1000);
  assert.equal(arrivals, 0);
  fixture.tick(500);
  assert.equal(arrivals, 0);
  fixture.tick(900);
  assert.equal(fixture.view.scrollY, 1000);
  assert.ok(fixture.commands.every(({ behavior }) => behavior === 'instant'));
  assert.equal(arrivals, 1);
  assert.equal(fixture.frames.size, 0);
  const commandCount = fixture.commands.length;
  fixture.view.dispatchEvent(new Event('wheel'));
  assert.equal(fixture.commands.length, commandCount);
});

test('모션 끄기 또는 이미 상단에 있는 경우에는 불필요하게 기다리지 않고 바로 전환한다', () => {
  for (const [fixture, animated] of [[workflowScrollFixture(), false], [workflowScrollFixture({ scrollY: 1000 }), true]]) {
    let arrivals = 0;
    scrollToWorkflowStageNav(fixture.target, animated, () => { arrivals++; });
    assert.deepEqual(fixture.commands, [{ top: 1000, behavior: 'instant' }]);
    assert.equal(arrivals, 1);
    assert.equal(fixture.frames.size, 0);
  }
});

test('휠·터치·다른 클릭으로 스크롤을 중단하면 나중에 초점이나 단계를 강제로 바꾸지 않는다', () => {
  for (const type of ['wheel', 'touchstart', 'pointerdown']) {
    const fixture = workflowScrollFixture();
    let arrivals = 0;
    scrollToWorkflowStageNav(fixture.target, true, () => { arrivals++; });
    fixture.tick(0);
    fixture.tick(200);
    const interruptedTop = fixture.view.scrollY;
    const commandCount = fixture.commands.length;
    fixture.view.dispatchEvent(new Event(type));
    fixture.tick(900);
    assert.equal(fixture.commands.length, commandCount);
    assert.equal(fixture.view.scrollY, interruptedTop);
    assert.equal(arrivals, 0, type);
    assert.equal(fixture.frames.size, 0, type);
  }
});

test('반복 선택·화면 이탈 취소는 이전 전환 콜백을 폐기하고 최신 요청만 완료한다', () => {
  const fixture = workflowScrollFixture();
  let previousArrivals = 0;
  let latestArrivals = 0;
  const cancel = scrollToWorkflowStageNav(fixture.target, true, () => { previousArrivals++; });
  cancel();
  cancel();
  assert.equal(fixture.commands.length, 0);
  scrollToWorkflowStageNav(fixture.target, true, () => { latestArrivals++; });
  fixture.tick(0);
  fixture.tick(900);
  assert.equal(previousArrivals, 0);
  assert.equal(latestArrivals, 1);
  assert.equal(fixture.frames.size, 0);
});

test('문서 스크롤이 잠겨 상단에 도착하지 못하면 본문만 전환하지 않는다', () => {
  const fixture = workflowScrollFixture();
  fixture.view.scrollTo = (options) => fixture.commands.push(options);
  let arrivals = 0;
  scrollToWorkflowStageNav(fixture.target, true, () => { arrivals++; });
  fixture.tick(0);
  fixture.tick(900);
  assert.equal(arrivals, 0);
  assert.equal(fixture.frames.size, 0);
});

test('스크롤 키는 이동을 취소하지만 탭 자체가 처리한 Home·End 키는 새 요청을 취소하지 않는다', () => {
  for (const prevented of [false, true]) {
    const fixture = workflowScrollFixture();
    let arrivals = 0;
    scrollToWorkflowStageNav(fixture.target, true, () => { arrivals++; });
    const event = new Event('keydown', { cancelable: true });
    Object.defineProperty(event, 'key', { value: 'Home' });
    if (prevented) event.preventDefault();
    fixture.view.dispatchEvent(event);
    fixture.tick(0);
    fixture.tick(900);
    assert.equal(arrivals, prevented ? 1 : 0);
  }
});

test('사례 갤러리는 기존 확대·슬라이드를 재사용하고 모든 단계의 이미지 새 탭 링크를 제거한다', async () => {
  const page = await readFile(new URL('../../../../src/app/about-me/ai-workflow/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /<WorkflowStageContent/);
  const content = await readFile(new URL('../../../../src/features/ai-workflow/ui/WorkflowStageContent.tsx', import.meta.url), 'utf8');
  assert.match(content, /aiWorkflowExamples\[stage\.id\]/);
  assert.match(content, /<WorkflowExample/);
  const example = await readFile(new URL('../../../../src/features/ai-workflow/ui/WorkflowExample.tsx', import.meta.url), 'utf8');
  assert.match(example, /environment\.tool/);
  assert.doesNotMatch(example, /environment\.model/);
  const gallery = await readFile(new URL('../../../../src/features/ai-workflow/ui/WorkflowCaptureGallery.tsx', import.meta.url), 'utf8');
  assert.match(gallery, /onActiveIndexChange=\{setActiveIndex\}/);
  assert.match(gallery, /captures\[activeIndex\]/);
  assert.doesNotMatch(gallery, /<a\b|target="_blank"|새 탭에서 크게 보기|basePath/);
  assert.match(gallery, /aria-live="polite"/);
  assert.match(gallery, /frameAspectRatio=\{frameAspectRatio \?\?/);
  assert.doesNotMatch(gallery, /expandedImageSize/);
  const shared = await readFile(new URL('../../../../src/features/projects/ui/ProjectMediaCarousel.tsx', import.meta.url), 'utf8');
  assert.equal((shared.match(/style=\{frameAspectRatio \? \{ aspectRatio: frameAspectRatio \} : undefined\}/g) ?? []).length, 1);
  assert.match(shared, /<ZoomableImage key=\{image\.src\}/);
  assert.doesNotMatch(shared, /expandedImageSize|lightboxPortraitFrame/);
});

test('새 탭 경로를 정확히 구분하고 기존 탭은 유지한다', () => {
  assert.equal(aboutTabPathFromPath('/about-me/ai-workflow/'), '/about-me/ai-workflow');
  assert.equal(aboutTabPathFromPath('/about-me/ai-workflow-extra'), null);
  assert.equal(aboutTabPathFromPath('/about-me/architecture/'), '/about-me/architecture');
  assert.equal(aboutTabPathFromPath('/about-me/architecture-extra'), null);
  assert.equal(aboutTabPathFromPath('/about-me/log/view'), '/about-me/log');
  assert.equal(aboutTabPathFromPath('/about-me'), '/about-me');
});

test('소개 요약은 프로젝트 다음·활용 실험 앞에 놓고 상세 탭에 연결한다', async () => {
  const page = await readFile(new URL('../../../../src/app/about-me/page.tsx', import.meta.url), 'utf8');
  const positions = ['id="featured-projects"', '<AiWorkflowPreview />', '<AgentExperimentGallery />'].map((text) => page.indexOf(text));
  assert.ok(positions.every((position, index) => position >= 0 && (!index || position > positions[index - 1])));
  const preview = await readFile(new URL('../../../../src/features/ai-workflow/ui/AiWorkflowPreview.tsx', import.meta.url), 'utf8');
  assert.ok(preview.includes('/about-me/ai-workflow/#workflow-${stage.id}'));
  const layout = await readFile(new URL('../../../../src/app/about-me/layout.tsx', import.meta.url), 'utf8');
  assert.ok(layout.includes('href: "/about-me/ai-workflow"'));
});

test('SI 표기 안내는 소개 페이지의 프로젝트 섹션보다 앞에 놓는다', async () => {
  const page = await readFile(new URL('../../../../src/app/about-me/page.tsx', import.meta.url), 'utf8');
  assert.ok(page.indexOf('<SiTerminologyNotice />') >= 0);
  assert.ok(page.indexOf('<SiTerminologyNotice />') < page.indexOf('id="featured-projects"'));
});

test('SI 학습 활용은 단계와 별개 섹션으로 마무리 카드 뒤, 기록 안내 앞에 놓인다', async () => {
  for (const practice of aiWorkflowLearning.practices) {
    assert.ok(practice.title.trim() && practice.description.trim(), practice.title);
  }
  const page = await readFile(new URL('../../../../src/app/about-me/ai-workflow/page.tsx', import.meta.url), 'utf8');
  const tabs = page.indexOf('<WorkflowStageTabs');
  const closing = page.indexOf('id="workflow-try-title"');
  const learning = page.indexOf('id="ai-workflow-learning"');
  const next = page.indexOf('id="workflow-next-title"');
  assert.ok(tabs >= 0 && tabs < closing && closing < learning && learning < next, '단계 탭 → 마무리 카드 → 학습 섹션 → 기록 안내 순서');
});

test('SI 학습 활용 예시의 관련 링크는 채팅 이동 경로에 있는 목적지를 가리킨다', async () => {
  const { ACTION_ROUTES } = await import('../../../../src/features/chat/constants.ts');
  const routes = new Set(Object.values(ACTION_ROUTES));
  for (const example of aiWorkflowLearning.examples) {
    if (example.relatedLink) assert.ok(routes.has(example.relatedLink.href), example.mode);
  }
});

test('둘러보기는 SI 05단계 다음에 학습 섹션을 들른 뒤 개발·배포 환경을 거쳐 기록으로 넘어간다', async () => {
  const { GUIDED_TOUR_STEPS } = await import('../../../../src/features/chat/onboarding/guidedTour.ts');
  const { ACTION_ROUTES, ACTION_IDS } = await import('../../../../src/features/chat/constants.ts');
  const ids = GUIDED_TOUR_STEPS.map(({ id }) => id);
  const index = ids.indexOf('si-learning');
  assert.equal(ids[index - 1], 'si-level-orchestration');
  assert.equal(ids[index + 1], 'development-environment');
  assert.equal(ids[ids.indexOf('log') - 1], 'infrastructure-optimization');
  const step = GUIDED_TOUR_STEPS[index];
  assert.equal(step.actionId, 'si_learning');
  assert.ok(ACTION_IDS.includes('si_learning'));
  assert.equal(ACTION_ROUTES.si_learning, '/about-me/ai-workflow#ai-workflow-learning');
});

test('채팅의 화면 이동 도구도 학습 섹션을 목적지로 받는다', async () => {
  const { ACTION_ROUTES } = await import('../../../../src/features/chat/constants.ts');
  const { resolvePortfolioViewTarget } = await import('../../../../src/features/webmcp/portfolioView.ts');
  const { PORTFOLIO_CHAT_TOOL_REGISTRY } = await import('../../../../src/features/portfolio-tools/schema.ts');
  const view = PORTFOLIO_CHAT_TOOL_REGISTRY.definitions.find(({ name }) => name === 'control_portfolio_view');
  assert.ok(view.inputSchema.properties.action.enum.includes('si-learning'));
  const target = resolvePortfolioViewTarget('si-learning');
  assert.equal(target.route, ACTION_ROUTES.si_learning);
});
