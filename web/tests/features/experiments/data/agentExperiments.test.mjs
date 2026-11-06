import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Script } from 'node:vm';
import { readImageHeader } from '../../../support/imageHeader.mjs';
import { agentExperiments } from '../../../../src/features/experiments/data/agentExperiments.ts';
import {
  AGENT_EXPERIMENT_CATEGORY_ANCHORS,
  AGENT_EXPERIMENT_INTRO_ANCHOR,
  agentExperimentForAnchor,
} from '../../../../src/features/experiments/data/agentExperimentNavigation.ts';

const visible = agentExperiments.filter((item) => !item.hidden);

test('공개 실험의 id는 겹치지 않고 참조한 이미지·영상·음원·다운로드 파일은 실제로 있다', async () => {
  assert.equal(new Set(agentExperiments.map(({ id }) => id)).size, agentExperiments.length);
  const publicFile = (src) => readFile(new URL(`../../../../public${src}`, import.meta.url));
  for (const item of visible) {
    const images = [
      ...(item.images ?? []),
      ...(item.imageGroups ?? []).flatMap((group) => group.images),
      ...(item.animationGroups ?? []).flatMap((group) => group.items.map((entry) => entry.image).filter(Boolean)),
    ];
    for (const image of images) {
      const bytes = await publicFile(image.src);
      if (!image.src.endsWith('.svg')) assert.notEqual(readImageHeader(bytes).format, 'unknown', image.src);
    }
    const videos = [item.video, ...(item.videos ?? []).map((entry) => entry.video), item.htmlPreview?.download].filter(Boolean);
    for (const video of videos) {
      assert.equal((await publicFile(video.src)).toString('ascii', 4, 8), 'ftyp', video.src);
      if (video.poster) await publicFile(video.poster);
    }
    if (item.htmlPreview) await publicFile(item.htmlPreview.src);
    if (item.audio) await publicFile(item.audio.src);
    for (const file of item.downloads ?? []) await publicFile(file.src);
    if (item.demoUrl) assert.equal(new URL(item.demoUrl).protocol, 'https:', item.id);
  }
});

test('2D·3D 게임 분류는 실험으로 표시하고 기존 직접 링크를 유지한다', () => {
  assert.equal(AGENT_EXPERIMENT_CATEGORY_ANCHORS['2D 게임 실험'], 'agent-experiments-2d-games');
  assert.equal(AGENT_EXPERIMENT_CATEGORY_ANCHORS['3D 게임 실험'], 'agent-experiments-3d-games');
});

test('설명 박스와 대분류 탭의 앵커를 분리하고 일곱 분류의 첫 공개 작품만 선택한다', async () => {
  assert.equal(AGENT_EXPERIMENT_INTRO_ANCHOR, 'agent-experiments-intro');
  // 공개 작품이 아직 없는 분류도 앵커는 미리 둘 수 있지만, 공개 분류는 모두 앵커가 있어야 한다.
  assert.deepEqual(
    Object.keys(AGENT_EXPERIMENT_CATEGORY_ANCHORS).filter((category) => visible.some((item) => item.category === category)),
    [...new Set(visible.map((item) => item.category))],
  );
  for (const [category, anchor] of Object.entries(AGENT_EXPERIMENT_CATEGORY_ANCHORS)) {
    assert.equal(agentExperimentForAnchor(agentExperiments, anchor), visible.find((item) => item.category === category));
    assert.ok(!agentExperiments.some((item) => item.id === anchor));
  }
  for (const item of visible) assert.equal(agentExperimentForAnchor(agentExperiments, item.id), item);
  for (const item of agentExperiments.filter((item) => item.hidden)) {
    assert.equal(agentExperimentForAnchor(agentExperiments, item.id), undefined);
  }
  for (const anchor of [AGENT_EXPERIMENT_INTRO_ANCHOR, 'agent-experiments', 'unknown', '__proto__']) {
    assert.equal(agentExperimentForAnchor(agentExperiments, anchor), undefined);
  }
  const component = await readFile(new URL('../../../../src/features/experiments/ui/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.match(component, /<section id="agent-experiments"/);
  assert.match(component, /<div id=\{AGENT_EXPERIMENT_INTRO_ANCHOR\} tabIndex=\{-1\} className=\{styles\.introPanel\}/);
  assert.match(component, /<button key=\{value\} id=\{AGENT_EXPERIMENT_CATEGORY_ANCHORS\[value\]\}/);
  assert.match(component, /agentExperimentForAnchor\(visibleExperiments, anchor\)/);
  assert.match(component, /addEventListener\(CHAT_ACTION_TARGET_PREPARE_EVENT, prepareExperiment\)/);
  assert.match(component, /removeEventListener\(CHAT_ACTION_TARGET_PREPARE_EVENT, prepareExperiment\)/);
  assert.match(component, /addEventListener\('popstate', selectHashExperiment\)/);
  assert.doesNotMatch(component, /CHAT_ACTION_TARGET_ARRIVED_EVENT/);
  assert.match(component, /data-active-experiment-id=\{active\.id\}/);
  assert.match(component, /data-agent-experiment-heading="true" tabIndex=\{-1\}/);
});

test('실험 선택 목록은 가로 스크롤 없이 줄바꿈하고 키보드 탐색을 유지한다', async () => {
  const css = await readFile(new URL('../../../../src/features/experiments/ui/AgentExperimentGallery.module.css', import.meta.url), 'utf8');
  const filmstrip = css.match(/\.filmstrip\s*\{([^}]+)\}/)?.[1];
  assert.ok(filmstrip);
  // 같은 폭 칸으로 줄바꿈한다(auto-fill 격자).
  assert.match(filmstrip, /grid-template-columns:\s*repeat\(auto-fill,/);
  assert.doesNotMatch(filmstrip, /overflow-x:\s*(?:auto|scroll)/);
  const component = await readFile(new URL('../../../../src/features/experiments/ui/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(component, /scrollLeft/);
  assert.match(component, /focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(css, /\.filters\s*\{[^}]*overflow-x:\s*(?:auto|scroll)/);
  const categoryToolbar = component.slice(component.indexOf('<div className={styles.toolbar}>'), component.indexOf('<div className={styles.experimentNavigation}>'));
  assert.doesNotMatch(categoryToolbar, /styles.controls/);
  assert.match(component, /styles\.experimentNavigation[\s\S]*styles\.filmstrip[\s\S]*styles\.controls[\s\S]*id="agent-experiment-stage"/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*filterIndicator[\s\S]*transition: none/);
  assert.match(css, /:global\(:root:not\(\[data-motion='on'\]\)\) \.filterIndicator/);
  assert.match(component, /new ResizeObserver\(measure\)/);
  assert.match(component, /translate3d\(\$\{filterIndicator\.x\}px/);
});

test('캡처가 없는 실험은 자리표시자를 보여 준다', async () => {
  const component = await readFile(new URL('../../../../src/features/experiments/ui/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.match(component, /<CapturePlaceholder label=\{active\.title\} kind=\{active\.category === '영상물' \? 'video' : 'image'\}/u);
});

test('SVG 애니메이션 결과는 스크립트 없는 애니메이션 SVG이고 묶음별로 렌더한다', async () => {
  const groups = visible.flatMap((item) => item.animationGroups ?? []);
  assert.ok(groups.length > 0);
  for (const { image } of groups.flatMap((group) => group.items)) {
    const source = await readFile(new URL(`../../../../public${image.src}`, import.meta.url), 'utf8');
    assert.match(source, /<svg\b/);
    assert.match(source, /<animate(?:Transform|Motion)?\b/);
    assert.doesNotMatch(source, /<script\b|<foreignObject\b/i);
  }
  const component = await readFile(new URL('../../../../src/features/experiments/ui/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.match(component, /active\.animationGroups\.map/);
  assert.match(component, /kind="svg-animation"/);
});

test('공통 프롬프트는 설명과 별도 인용 박스로 표시하고 원문의 줄바꿈을 보존한다', async () => {
  const component = await readFile(new URL('../../../../src/features/experiments/ui/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../../../src/features/experiments/ui/AgentExperimentGallery.module.css', import.meta.url), 'utf8');
  assert.match(component, /<p>\{active\.description\}<\/p>\s*\{active\.prompt &&/u);
  assert.match(component, /<p>\{active\.prompt\}<\/p>/u);
  assert.match(css, /\.prompt p\s*\{[^}]*white-space: pre-wrap[^}]*overflow-wrap: anywhere/u);
});

test('Gemini 4 Argon은 HTML 래퍼 없이 원본 SVG의 47개 반복 애니메이션을 보존한다', async () => {
  const source = await readFile(new URL('../../../../public/images/agent-experiments/svg/pelican/09-gemini-4-argon.svg', import.meta.url), 'utf8');
  assert.match(source, /^<svg\b/u);
  const animations = source.match(/<animate(?:Transform|Motion)?\b[^>]*\/>/gu) ?? [];
  assert.ok(animations.length > 0);
  assert.ok(animations.every(animation => animation.includes('repeatCount="indefinite"')));
  assert.doesNotMatch(source, /<!DOCTYPE|<(?:html|head|body|script|foreignObject)\b|\son[a-z]+\s*=/iu);
  assert.doesNotMatch(source, /(?:href|src)\s*=\s*["'](?:https?:|\/\/|javascript:|data:)|@import|url\(\s*["']?https?:/iu);
});

test('OSCILLO MP3 프리뷰는 겹치지 않는 해시 경로와 필수 필드를 쓴다', () => {
  const rhythm = visible.find(({ id }) => id === 'oscillo-rhythm-game');
  const previews = rhythm.audioPreviews;
  assert.ok(previews.length > 0);
  assert.equal(new Set(previews.map(({ src }) => src)).size, previews.length);
  for (const preview of previews) {
    assert.ok(preview.album && preview.title && preview.durationSeconds > 0, preview.src);
    const url = new URL(preview.src);
    assert.match(url.pathname, /\/previews\/[a-z0-9]+(?:-[a-z0-9]+)*\.[a-f0-9]{12}\.mp3$/);
    assert.equal(url.search + url.hash, '');
    assert.deepEqual(Object.keys(preview).sort(), ['album', 'durationSeconds', 'src', 'title']);
  }
});

test('사진별 헤더는 현재 사진의 제작 모델 요약을 참조한다', async () => {
  const component = await readFile(new URL('../../../../src/features/experiments/ui/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.match(component, /title=\{currentImage\?\.title \?\? mediaTitle\}/);
  assert.match(component, /credit\.purpose === currentImage\.modelCreditPurpose/);
  assert.match(component, /onActiveIndexChange=\{setImageIndex\}/);
  assert.match(component, /<article key=\{active\.id\}/);
  assert.doesNotMatch(component, /<dl aria-label="사용 모델">/);
  assert.match(component, /imageWithoutRepeatedCaption\(currentImage, credits\)/);
  const carousel = await readFile(new URL('../../../../src/features/projects/ui/ProjectMediaCarousel.tsx', import.meta.url), 'utf8');
  assert.match(carousel, /setActiveIndex\(nextIndex\);\s*onActiveIndexChange\?\.\(nextIndex\)/);
  assert.match(carousel, /mediaSlideIndex\(swiper\.realIndex, images\.length\)/);
  assert.match(carousel, /nextIndex === activeIndexRef\.current/);
});

test('공개 다운로드는 압축된 Blender 원본 파일이다', async () => {
  for (const file of visible.flatMap((item) => item.downloads ?? [])) {
    const bytes = await readFile(new URL(`../../../../public${file.src}`, import.meta.url));
    assert.deepEqual([...bytes.subarray(0, 4)], [0x28, 0xb5, 0x2f, 0xfd]);
  }
  const source = await readFile(new URL('../../../../src/features/experiments/ui/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.match(source, /active\.downloads\.map/);
  assert.match(source, /href=\{`\$\{basePath\}\$\{file\.src\}`\} download/);
});

test('이미지와 영상은 제작 단계 및 모델 헤더가 있는 미디어 블록으로 구분한다', async () => {
  const component = await readFile(new URL('../../../../src/features/experiments/ui/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.match(component, /function ExperimentMediaBlock/);
  assert.match(component, /<header className=\{styles\.mediaHeader\}/);
  assert.match(component, /mergeModelCredits\(active\.imageGroups\.flatMap\(\(group\) => group\.modelCredits\)\)/);
  assert.match(component, /credits=\{mergeModelCredits\(active\.modelCredits\)\}/);
  assert.doesNotMatch(component, /SCREEN \/ VIDEO|IMAGE \/ VIDEO|styles\.previewLabel/);
});

test('영상물은 HTML 미리보기를 쓰고 자동 재생 없이 다른 재생을 멈춘다', async () => {
  const component = await readFile(new URL('../../../../src/features/experiments/ui/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.match(component, /active\.htmlPreview \? \([\s\S]*?<ExperimentHtmlPreview/);
  assert.match(component, /<article key=\{active\.id\}/);
  assert.match(component, /otherVideo !== currentVideo.*otherVideo\.pause\(\)/);
  assert.match(component, /preload="none"/);
  assert.doesNotMatch(component, /\bautoPlay\b/);
});

test('영상 다운로드 버튼은 비활성화한 잠김 표시로 둔다', async () => {
  const component = await readFile(new URL('../../../../src/features/experiments/ui/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.match(component, /video\.downloadName &&/);
  const downloadComponent = component.match(/function ExperimentDownload\([\s\S]*?\n\}/)?.[0];
  assert.ok(downloadComponent);
  assert.match(downloadComponent, /<button type="button" className=\{styles\.videoDownload\} disabled/);
  assert.match(downloadComponent, /className=\{styles\.videoActions\}/);
  assert.doesNotMatch(downloadComponent, /<a\b|\bhref=|\bonClick=/);
  assert.match(component, /<ExperimentDownload title=\{title\} \/>/);
  assert.match(component, /preview\.download && \(/);
  assert.match(component, /<video[\s\S]*?controls[\s\S]*?preload="none"/);
  assert.match(component, /<source src=\{`\$\{basePath\}\$\{video\.src\}`\} type="video\/mp4"/);
});

test('HTML 콘텐츠 헤더는 재생 제목을 빼고 제작 모델만 유지한다', async () => {
  const component = await readFile(new URL('../../../../src/features/experiments/ui/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.match(component, /<ExperimentMediaBlock title=\{active\.title\} hideTitle credits=\{creditsWithoutTitleRepeat\(active\.title, active\.modelCredits\)\}>/);
  assert.match(component, /\{!hideTitle && <h4>\{title\}<\/h4>\}/);
});

test('Opus 모션그래픽은 끝에서 정지하고 명시적 재생만 처음부터 다시 시작한다', async () => {
  const html = await readFile(new URL('../../../../public/media/agent-experiments/motion-graphics/opus-5-5.html', import.meta.url), 'utf8');
  const setPlaying = html.match(/function setPlaying\(p\) \{[\s\S]*?\n  \}/)?.[0];
  const frame = html.match(/function frame\(now\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(setPlaying && frame);
  assert.doesNotMatch(frame, /t -= DUR|startAudio\(\)/);
  for (const sample of [{ clock: null, speed: 1 }, { clock: null, speed: 0.25 }, { clock: 15.1, speed: 1 }]) {
    const labels = {};
    const audioStates = [];
    let renders = 0;
    const state = {
      t: 14.99, DUR: 15, playing: true, started: true, speed: sample.speed,
      last: 0, dirty: false, dragging: false, actx: null,
      performance: { now: () => 100 },
      audioClock: () => sample.clock,
      $: (id) => ({ toggleAttribute() {}, setAttribute(name, value) { labels[`${id}:${name}`] = value; } }),
      syncAudio: () => audioStates.push(state.playing),
      meter() {}, render: () => { renders++; }, ui() {}, requestAnimationFrame() {},
    };
    const script = new Script(`${setPlaying}\n${frame}\nframe(100);`);
    script.runInNewContext(state, { timeout: 1000 });
    assert.equal(state.t, 15);
    assert.equal(state.playing, false);
    assert.equal(labels['play:aria-label'], '재생');
    assert.deepEqual(audioStates, [false]);
    new Script('frame(500);').runInNewContext(state, { timeout: 1000 });
    assert.equal(state.t, 15);
    assert.equal(renders, 1);
    new Script('setPlaying(true);').runInNewContext(state, { timeout: 1000 });
    assert.equal(state.t, 0);
    assert.equal(state.playing, true);
    assert.equal(labels['play:aria-label'], '일시정지');
  }
});

test('HTML 작품은 외부 요청 없이 격리 재생하고 현재 프레임의 크기만 수신한다', async () => {
  const previews = visible.filter((item) => item.htmlPreview);
  assert.ok(previews.length > 0);
  for (const item of previews) {
    const html = await readFile(new URL(`../../../../public${item.htmlPreview.src}`, import.meta.url), 'utf8');
    assert.match(html, /playing\s*[=:]\s*false/);
    assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com|<video\b/);
    assert.match(html, /Content-Security-Policy[^>]*connect-src 'none'/);
    if (item.htmlPreview.layout !== 'viewport') {
      assert.match(html, /window\.parent\.postMessage\(\{ type: 'ssw:html-preview:size', height \}/);
    }
    for (const [index, script] of [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].entries()) {
      if (script[1].includes('application/json')) {
        assert.doesNotThrow(() => JSON.parse(script[2]));
      } else if (script[1].includes('application/octet-stream')) {
        assert.match(script[2].trim(), /^[A-Za-z0-9+/=]+$/);
      } else {
        assert.doesNotThrow(() => new Script(script[2], { filename: `${item.id}-${index}.js` }));
      }
    }
  }
  for (const font of ['unbounded', 'anton', 'ibmplexmono', 'noto-sans-kr']) {
    const license = await readFile(new URL(`../../../../public/fonts/licenses/${font}-OFL.txt`, import.meta.url), 'utf8');
    assert.match(license, /SIL OPEN FONT LICENSE Version 1.1/);
  }
  const component = await readFile(new URL('../../../../src/features/experiments/ui/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.match(component, /sandbox="allow-scripts"/);
  assert.doesNotMatch(component, /allow-same-origin|dangerouslySetInnerHTML/);
  assert.match(component, /event\.source !== frameRef\.current\?\.contentWindow/);
  assert.match(component, /event\.origin !== 'null'/);
  assert.match(component, /Number\.isFinite\(data\.height\)/);
  assert.match(component, /Math\.min\(2200, Math\.max\(240/);
  assert.match(component, /style=\{preview\.layout === 'viewport' \? undefined : \{ height \}\}/);
});

test('키보드 분해도 HTML은 끝에서 멈추고 장면 설명을 영상 밖에 둔다', async () => {
  const keyboard = visible.find((item) => item.id === 'keyboard-exploded-view');
  const html = await readFile(new URL(`../../../../public${keyboard.htmlPreview.src}`, import.meta.url), 'utf8');
  assert.match(html, /playing:false/);
  assert.match(html, /setPlaying\(false\);\s*window\.__WAVE_READY__/);
  assert.match(html, /if\(next>=DURATION\)setPlaying\(false\)/);
  const filmMarkup = html.split('<div class="film"')[1]?.split('<div class="scene-caption"')[0];
  assert.ok(filmMarkup);
  assert.match(filmMarkup, /id="layerLabels"/);
  assert.doesNotMatch(filmMarkup, /id="annotationValue"|id="chapterKo"/);
});

test('모션 도감 목록은 테마에 맞는 스크롤바와 위치 이동 없는 바깥 클릭 닫기를 지원한다', async () => {
  const html = await readFile(new URL('../../../../public/media/agent-experiments/motion-atlas/main.html', import.meta.url), 'utf8');
  assert.match(html, /scrollbar-color: var\(--list-thumb\) var\(--list-bg\)/);
  assert.match(html, /@media\(prefers-color-scheme:dark\)/);
  assert.match(html, /color-scheme: light/);
  assert.match(html, /color-scheme: dark/);
  assert.match(html, /if \(!list\.contains\(event\.target\) && !bList\.contains\(event\.target\)\) setListOpen\(false\)/);
  assert.match(html, /event\.source !== window\.parent \|\| event\.data\?\.type !== 'ssw:html-preview:dismiss-panels'/);
  assert.match(html, /bList\.setAttribute\('aria-expanded', String\(open\)\)/);
  assert.match(html, /e\.code === 'Escape'\) setListOpen\(false\)/);
  const closePanel = html.match(/function setListOpen\(open\) \{([\s\S]*?)\n    \}/)?.[1];
  assert.ok(closePanel);
  assert.doesNotMatch(closePanel, /seek\(|\bT\s*=/);
  const component = await readFile(new URL('../../../../src/features/experiments/ui/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.match(component, /postMessage\(\{ type: 'ssw:html-preview:dismiss-panels' \}, '\*'\)/);
  assert.match(component, /document\.removeEventListener\('pointerdown', dismissPanels\)/);
});

test('영상과 이미지가 함께 있는 사례는 둘을 나란히 표시한다', async () => {
  const source = await readFile(new URL('../../../../src/features/experiments/ui/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.match(source, /styles\.mediaPair/);
  assert.match(source, /active\.video && active\.images\?\.length/);
});

test('독립 BGM 플레이어는 설명 앞에 놓고 음원 파일은 MP3이며 자동 재생하지 않는다', async () => {
  for (const { audio } of visible.filter((item) => item.audio)) {
    const bytes = await readFile(new URL(`../../../../public${audio.src}`, import.meta.url));
    assert.ok(bytes.toString('ascii', 0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0), audio.src);
  }
  const component = await readFile(new URL('../../../../src/features/experiments/ui/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.match(component, /<audio[\s\S]*?preload="none"/);
  assert.match(component, /player\?\.pause\(\)/);
  assert.match(component, /active\.audio && <ExperimentAudio[\s\S]*?<div className=\{styles\.caption\}/);
  assert.match(component, /<article key=\{active\.id\}/);
  const carousel = await readFile(new URL('../../../../src/features/projects/ui/ProjectMediaCarousel.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(carousel, /<audio|gallery\.audio|BGM 듣기/);
  assert.doesNotMatch(component, /\bautoPlay\b/);
});

test('제작 모델 정보가 기존 모델 비교 화면을 활성화하지 않는다', () => {
  assert.ok(visible.every((item) => item.models === undefined));
});

test('하단 안내 대신 제작 모델 정보 컴포넌트를 사용한다', async () => {
  const source = await readFile(new URL('../../../../src/features/experiments/ui/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.match(source, /function ExperimentModelCredits/);
  assert.doesNotMatch(source, /<dl aria-label="사용 모델">/);
});
