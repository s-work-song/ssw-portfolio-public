import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import { agentExperiments } from './agentExperiments.ts';

const visible = agentExperiments.filter((item) => !item.hidden);

test('실험 선택 목록은 가로 스크롤 없이 줄바꿈하고 키보드 탐색을 유지한다', async () => {
  const css = await readFile(new URL('../components/about/AgentExperimentGallery.module.css', import.meta.url), 'utf8');
  const filmstrip = css.match(/\.filmstrip\s*\{([^}]+)\}/)?.[1];
  assert.ok(filmstrip);
  assert.match(filmstrip, /flex-wrap:\s*wrap/);
  assert.doesNotMatch(filmstrip, /overflow-x:\s*(?:auto|scroll)/);
  const component = await readFile(new URL('../components/about/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(component, /scrollLeft/);
  assert.match(component, /focus\(\{ preventScroll: true \}\)/);
  assert.match(css, /\.filters\s*\{[^}]*grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 900px\)\s*\{\s*\.filters\s*\{\s*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 600px\)\s*\{\s*\.filters\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(css, /\.filters\s*\{[^}]*overflow-x:\s*(?:auto|scroll)/);
  const categoryToolbar = component.slice(component.indexOf('<div className={styles.toolbar}>'), component.indexOf('<div className={styles.experimentNavigation}>'));
  assert.doesNotMatch(categoryToolbar, /styles.controls/);
  assert.match(component, /styles\.experimentNavigation[\s\S]*styles\.filmstrip[\s\S]*styles\.controls[\s\S]*id="agent-experiment-stage"/);
  assert.match(css, /\.controls\s*\{[^}]*justify-content:\s*flex-end/);
  assert.match(css, /\.experimentNavigation\s*\{[^}]*border-bottom:/);
  assert.match(css, /\.filters button\s*\{[^}]*width:\s*100%/);
  assert.match(css, /\.filterIndicator\s*\{[^}]*transition:\s*transform 240ms/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*filterIndicator[\s\S]*transition: none/);
  assert.match(css, /:global\(:root:not\(\[data-motion='on'\]\)\) \.filterIndicator/);
  assert.match(component, /new ResizeObserver\(measure\)/);
  assert.match(component, /translate3d\(\$\{filterIndicator\.x\}px/);
});

test('펠리컨 애니메이션은 8개 결과와 빈 한 칸을 3열 그리드로 표시한다', async () => {
  const svg = visible.filter((item) => item.category === 'SVG 제작');
  assert.deepEqual(svg.map((item) => item.id), ['svg-illustrations', 'claude-pelican-svg-animation']);
  const pelican = svg[1];
  assert.deepEqual(pelican.animationGroups.map((group) => group.label), ['Claude', 'GPT', 'Grok·Gemini']);
  assert.equal(pelican.animationGroups.reduce((count, group) => count + group.items.length, 0), 9);
  const [claude, gpt, others] = pelican.animationGroups;
  assert.deepEqual(claude.items.map((item) => item.model), ['Fable 5.1', 'Opus 5.5', 'Sonnet 5.5']);
  assert.deepEqual(claude.items.map((item) => item.image?.src), [
    '/images/agent-experiments/svg/pelican/01-fable-5-1.svg',
    '/images/agent-experiments/svg/pelican/02-opus-5-5.svg',
    '/images/agent-experiments/svg/pelican/03-sonnet-5-5.svg',
  ]);
  assert.deepEqual(gpt.items.map((item) => item.model), ['GPT-6 Astra', 'GPT-6 Sol', 'GPT-6 Luna']);
  assert.deepEqual(gpt.items.map((item) => item.image?.src), [
    '/images/agent-experiments/svg/pelican/05-gpt-6-astra.svg',
    '/images/agent-experiments/svg/pelican/06-gpt-6-sol.svg',
    '/images/agent-experiments/svg/pelican/04-gpt-6-luna.svg',
  ]);
  assert.deepEqual(others.items.map((item) => item.model), ['Grok 4.7', 'Gemini 3.8 Flash', null]);
  assert.deepEqual(others.items.map((item) => item.image?.src), [
    '/images/agent-experiments/svg/pelican/08-grok-4-7.svg',
    '/images/agent-experiments/svg/pelican/07-gemini-3-8-flash.svg',
    undefined,
  ]);
  assert.equal(pelican.images, undefined);
  assert.deepEqual(pelican.modelCredits, [
    { purpose: 'Claude', models: ['Fable 5.1', 'Opus 5.5', 'Sonnet 5.5'] },
    { purpose: 'GPT', models: ['GPT-6 Astra', 'GPT-6 Sol', 'GPT-6 Luna'] },
    { purpose: 'Grok', models: ['Grok 4.7'] },
    { purpose: 'Gemini', models: ['Gemini 3.8 Flash'] },
  ]);
  for (const { image } of [...claude.items, ...gpt.items, ...others.items.slice(0, 2)]) {
    const source = await readFile(new URL(`../../public${image.src}`, import.meta.url), 'utf8');
    assert.match(source, /<svg\b/);
    assert.match(source, /<animate(?:Transform|Motion)?\b/);
    assert.doesNotMatch(source, /<script\b|<foreignObject\b/i);
  }
  assert.equal(pelican.video, undefined);
  const component = await readFile(new URL('../components/about/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.match(component, /active\.animationGroups\.map/);
  assert.match(component, /kind="svg-animation"/);
});

test('제작 모델이 확인된 공개 실험에 모델과 버전을 표시한다', () => {
  assert.deepEqual(Object.fromEntries(visible.filter((item) => item.modelCredits?.length).map((item) => [
    item.id, item.modelCredits?.flatMap((credit) => credit.models),
  ])), {
    'svg-illustrations': ['GPT-6 Astra'],
    'claude-pelican-svg-animation': ['Fable 5.1', 'Opus 5.5', 'Sonnet 5.5', 'GPT-6 Astra', 'GPT-6 Sol', 'GPT-6 Luna', 'Grok 4.7', 'Gemini 3.8 Flash'],
    'planet-defense': ['GPT-5.6 Sol', 'GPT Image 2'],
    'aqua-guardian': ['GPT-5.6 Sol', 'GPT Image 2', 'Lyria 3'],
    'project-game-collection-platform': ['Fable 5', 'Opus 4.8', 'GPT-5.6 Sol', 'GPT Image 2'],
    'flight-simulator-experiment': ['Opus 5', 'GPT-5.6 Sol'],
    'siege-warfare': ['Opus 5', 'GPT-5.6 Sol'],
    'blender-medieval-weapons': ['Opus 5.5'],
    'blender-food': ['GPT-6 Astra', 'GPT-6 Astra', 'Grok 4.6', 'Opus 5.5'],
    'blender-subway': ['GPT-6 Astra'],
    'blender-city': ['GPT-6 Astra'],
    'blender-office': ['GPT-6 Astra', 'GPT Image 2.5', 'GPT-6 Astra'],
    'motion-graphics': ['Opus 5.5', 'GPT-6 Astra'],
    'spaceship-simulation': ['Opus 5.5'],
    'comfyui-qwen-wan': ['GPT-6 Sol', 'Qwen Image 2512 FP8 E4M3FN', 'Wan 2.2 I2V 14B FP8'],
    'comfyui-gpt-image2-wan': ['GPT Image 2', 'Wan 2.2 I2V 14B FP8'],
  });
});

test('Blender 작업 이미지와 사무실의 참고 이미지 및 구현 렌더를 순서대로 표시한다', async () => {
  const blender = visible.filter((item) => item.category === 'Blender 3D 에셋 제작');
  assert.deepEqual(blender.map((item) => item.id), [
    'blender-medieval-weapons', 'blender-food', 'blender-subway', 'blender-city', 'blender-office',
  ]);
  assert.deepEqual(blender[0].images?.map((image) => image.src), [
    '/images/agent-experiments/blender-medieval-weapons/05-scale-comparison.jpg',
    '/images/agent-experiments/blender-medieval-weapons/01-catalog.jpg',
    '/images/agent-experiments/blender-medieval-weapons/02-weapons-detail.jpg',
    '/images/agent-experiments/blender-medieval-weapons/03-shields.jpg',
    '/images/agent-experiments/blender-medieval-weapons/04-shading-wireframe.jpg',
  ]);
  for (const image of blender[0].images) {
    const bytes = await readFile(new URL(`../../public${image.src}`, import.meta.url));
    assert.deepEqual([...bytes.subarray(0, 3)], [255, 216, 255]);
    assert.ok(bytes.length > 20_000);
  }
  assert.deepEqual(blender[0].modelCredits, [{ models: ['Opus 5.5'] }]);
  assert.equal(blender[1].title, '음식·가전');
  assert.deepEqual(blender[1].focus, ['음식', '가전', 'Blender 3D']);
  assert.deepEqual(blender[1].images?.map((image) => image.src), [
    '/images/agent-experiments/blender-food/01-mixer.png',
    '/images/agent-experiments/blender-food/02-waffle-maker.png',
    '/images/agent-experiments/blender-food/03-toaster.png',
    '/images/agent-experiments/blender-food/04-donut-gpt-6-astra.png',
    '/images/agent-experiments/blender-food/05-waffle-grok-4-6.png',
    '/images/agent-experiments/blender-food/06-macaron-opus-5-5.png',
  ]);
  for (const image of blender[1].images) {
    const bytes = await readFile(new URL(`../../public${image.src}`, import.meta.url));
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  }
  assert.deepEqual(blender[1].images.slice(3).map((image) => image.caption), [
    '도넛 · GPT-6 Astra',
    '와플 · Grok 4.6',
    '마카롱 · Opus 5.5',
  ]);
  assert.deepEqual(blender[1].modelCredits, [
    { purpose: '가전', models: ['GPT-6 Astra'] },
    { purpose: '음식 · 도넛', models: ['GPT-6 Astra'] },
    { purpose: '음식 · 와플', models: ['Grok 4.6'] },
    { purpose: '음식 · 마카롱', models: ['Opus 5.5'] },
  ]);
  assert.deepEqual(blender[2].images?.map((image) => image.src), [
    '/images/agent-experiments/blender-subway/01-station-cutaway.png',
    '/images/agent-experiments/blender-subway/02-platform.png',
    '/images/agent-experiments/blender-subway/03-ticket-gates.png',
  ]);
  for (const image of blender[2].images) {
    const bytes = await readFile(new URL(`../../public${image.src}`, import.meta.url));
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.readUInt32BE(16), 1600);
    assert.equal(bytes.readUInt32BE(20), 900);
  }
  assert.deepEqual(blender[2].modelCredits, [{ models: ['GPT-6 Astra'] }]);
  const city = blender[3];
  assert.equal(city.title, '도시 거리');
  assert.deepEqual(city.modelCredits, [{ models: ['GPT-6 Astra'] }]);
  assert.deepEqual(city.images.map((image) => image.src), [
    '/images/agent-experiments/blender-city/01_city_overview.jpg',
    '/images/agent-experiments/blender-city/02_boulevard_hero.jpg',
    '/images/agent-experiments/blender-city/03_road_intersection.jpg',
    '/images/agent-experiments/blender-city/04_sidewalk_west.jpg',
    '/images/agent-experiments/blender-city/05_sidewalk_east.jpg',
    '/images/agent-experiments/blender-city/06_crosswalk_corner.jpg',
  ]);
  for (const image of city.images) {
    const bytes = await readFile(new URL(`../../public${image.src}`, import.meta.url));
    assert.deepEqual([...bytes.subarray(0, 3)], [255, 216, 255]);
    assert.ok(bytes.length > 20_000 && bytes.length < 1_000_000);
    assert.ok(image.alt.length > 0 && image.caption.length > 0);
  }
  const office = blender[4];
  assert.equal(office.title, '사무실');
  assert.equal(office.images, undefined);
  assert.deepEqual(office.imageGroups.map((group) => group.title), ['생성한 참고 이미지', 'Blender 구현 결과']);
  assert.deepEqual(office.imageGroups.map((group) => group.images.length), [1, 4]);
  const officeImages = office.imageGroups.flatMap((group) => group.images);
  assert.deepEqual(officeImages.map((image) => image.src), [
    '/images/agent-experiments/blender-office/01-reference.png',
    '/images/agent-experiments/blender-office/02-entrance.jpg',
    '/images/agent-experiments/blender-office/03-workstation-detail.jpg',
    '/images/agent-experiments/blender-office/04-reverse-aisle.jpg',
    '/images/agent-experiments/blender-office/05-meeting-room.jpg',
  ]);
  assert.match(office.description, /이미지를 먼저 생성하고.*Blender로 모델링/);
  assert.match(officeImages[0].caption, /참고 이미지.*Blender 구현 결과 아님/);
  const reference = await readFile(new URL(`../../public${officeImages[0].src}`, import.meta.url));
  assert.deepEqual([...reference.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(reference.readUInt32BE(16) >= 1600);
  for (const image of officeImages.slice(1)) {
    const bytes = await readFile(new URL(`../../public${image.src}`, import.meta.url));
    assert.deepEqual([...bytes.subarray(0, 3)], [255, 216, 255]);
    assert.ok(bytes.length > 20_000 && bytes.length < 1_000_000);
    assert.match(image.caption, /^Blender 구현 — /);
    assert.ok(image.alt.length > 0);
  }
  assert.deepEqual(office.imageGroups[0].modelCredits, [
    { purpose: '프롬프트', models: ['GPT-6 Astra'] },
    { purpose: '이미지', models: ['GPT Image 2.5'] },
  ]);
  assert.deepEqual(office.imageGroups[1].modelCredits, [{ purpose: 'Blender 모델링', models: ['GPT-6 Astra'] }]);
  assert.deepEqual(office.modelCredits, office.imageGroups.flatMap((group) => group.modelCredits));
  assert.equal(office.downloads, undefined);
});

test('음식·가전에만 세 Blender 원본 다운로드를 제공한다', async () => {
  const food = visible.find((item) => item.id === 'blender-food');
  assert.deepEqual(food.downloads, [
    { src: '/models/agent-experiments/blender-food/kitchen-mixer.blend', label: '믹서' },
    { src: '/models/agent-experiments/blender-food/kitchen-waffle-maker.blend', label: '와플 메이커' },
    { src: '/models/agent-experiments/blender-food/kitchen-toaster.blend', label: '토스터' },
  ]);
  for (const file of food.downloads) {
    const filePath = new URL(`../../public${file.src}`, import.meta.url);
    const bytes = await readFile(filePath);
    assert.deepEqual([...bytes.subarray(0, 4)], [0x28, 0xb5, 0x2f, 0xfd]);
    assert.ok((await stat(filePath)).size < 10_000_000);
  }
  assert.ok(visible.filter((item) => item.id !== 'blender-food').every((item) => !item.downloads?.length));
  const source = await readFile(new URL('../components/about/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.match(source, /active\.downloads\.map/);
  assert.match(source, /href=\{`\$\{basePath\}\$\{file\.src\}`\} download/);
});

test('이미지와 영상은 제작 단계 및 모델 헤더가 있는 미디어 블록으로 구분한다', async () => {
  const component = await readFile(new URL('../components/about/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../components/about/AgentExperimentGallery.module.css', import.meta.url), 'utf8');
  assert.match(component, /function ExperimentMediaBlock/);
  assert.match(component, /<header className=\{styles\.mediaHeader\}/);
  assert.match(component, /credit\.purpose \?\? '제작 모델'/);
  assert.match(component, /active\.imageGroups\.map[\s\S]*credits=\{group\.modelCredits\}/);
  assert.match(component, /title="생성 이미지"[^\n]*credit\.purpose === '이미지'/);
  assert.match(component, /title="5초 생성 영상"[^\n]*credit\.purpose === '영상'/);
  assert.doesNotMatch(component, /SCREEN \/ VIDEO|IMAGE \/ VIDEO|styles\.previewLabel/);
  assert.match(css, /\.mediaBlock\s*\{[^}]*min-width:\s*0[^}]*border:/);
  assert.match(css, /\.mediaCredits\s*\{[^}]*flex-wrap:\s*wrap/);
});

test('모션그래픽은 Opus 위·Astra 아래 순서로 제작 모델 헤더가 있는 개별 플레이어를 연결한다', async () => {
  const items = visible.filter((item) => item.category === '영상물');
  assert.deepEqual(items.map((item) => item.id), ['motion-graphics', 'spaceship-simulation']);
  const [motion, spaceship] = items;
  assert.equal(motion.video, undefined);
  assert.deepEqual(motion.videos.map(({ label, model }) => ({ label, model })), [
    { label: '위 영상', model: 'Opus 5.5' },
    { label: '아래 영상', model: 'GPT-6 Astra' },
  ]);
  assert.deepEqual(motion.modelCredits, motion.videos.map(({ label, model }) => ({ purpose: label, models: [model] })));
  assert.deepEqual(spaceship.modelCredits, [{ models: ['Opus 5.5'] }]);
  const videos = [...motion.videos.map((entry) => entry.video), spaceship.video];
  assert.deepEqual(videos.map((video) => video.src), [
    '/media/agent-experiments/motion-graphics/main.mp4',
    '/media/agent-experiments/motion-graphics/astra.mp4',
    '/media/agent-experiments/spaceship-simulation/main.mp4',
  ]);
  for (const video of videos) {
    const videoPath = new URL(`../../public${video.src}`, import.meta.url);
    const posterPath = new URL(`../../public${video.poster}`, import.meta.url);
    const videoBytes = await readFile(videoPath);
    const posterBytes = await readFile(posterPath);
    assert.equal(videoBytes.toString('ascii', 4, 8), 'ftyp');
    assert.ok((await stat(videoPath)).size < 20_000_000);
    assert.deepEqual([...posterBytes.subarray(0, 3)], [255, 216, 255]);
  }
  const component = await readFile(new URL('../components/about/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../components/about/AgentExperimentGallery.module.css', import.meta.url), 'utf8');
  assert.match(component, /active\.videos\.map/);
  const videoBlocks = component.slice(component.indexOf('active.videos.map'), component.indexOf('active.imageGroups?.length'));
  assert.match(videoBlocks, /ExperimentMediaBlock[^>]*title=\{entry\.model\}/);
  assert.match(videoBlocks, /eyebrow="제작 모델"/);
  assert.doesNotMatch(videoBlocks, /entry\.label|위 영상|아래 영상/);
  assert.match(component, /otherVideo !== currentVideo.*otherVideo\.pause\(\)/);
  assert.match(component, /preload="none"/);
  assert.doesNotMatch(component, /\bautoPlay\b/);
  assert.match(css, /\.videoStack\s*\{[^}]*flex-direction:\s*column/);
});

test('ComfyUI 활용 첫 사례는 이미지와 5초 영상을 함께 표시하고 제작 단계를 구분한다', async () => {
  const items = visible.filter((item) => item.category === 'ComfyUI 활용');
  assert.deepEqual(items.map((item) => item.id), ['comfyui-qwen-wan', 'comfyui-gpt-image2-wan']);
  const item = items[0];
  assert.deepEqual(item.modelCredits, [
    { purpose: '워크플로우와 프롬프트', models: ['GPT-6 Sol'] },
    { purpose: '이미지', models: ['Qwen Image 2512 FP8 E4M3FN'] },
    { purpose: '영상', models: ['Wan 2.2 I2V 14B FP8'] },
  ]);
  assert.deepEqual(item.images.map((image) => image.src), [
    '/images/agent-experiments/comfyui/cafe-qwen-image-2512.png',
  ]);
  assert.equal(item.video.src, '/media/agent-experiments/comfyui-qwen-wan/cafe-i2v-5s.mp4');
  assert.equal(item.video.poster, item.images[0].src);
  const imageBytes = await readFile(new URL(`../../public${item.images[0].src}`, import.meta.url));
  assert.deepEqual([...imageBytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(imageBytes.readUInt32BE(16), 1280);
  assert.equal(imageBytes.readUInt32BE(20), 720);
  const videoPath = new URL(`../../public${item.video.src}`, import.meta.url);
  const videoBytes = await readFile(videoPath);
  assert.equal(videoBytes.toString('ascii', 4, 8), 'ftyp');
  assert.ok((await stat(videoPath)).size < 5_000_000);
  const source = await readFile(new URL('../components/about/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.match(source, /styles\.mediaPair/);
  assert.match(source, /active\.video && active\.images\?\.length/);
});

test('ComfyUI 활용 두 번째 사례는 GPT Image 2 이미지와 같은 Wan I2V 영상 모델을 표시한다', async () => {
  const item = visible.find((entry) => entry.id === 'comfyui-gpt-image2-wan');
  assert.deepEqual(item.modelCredits, [
    { purpose: '이미지', models: ['GPT Image 2'] },
    { purpose: '영상', models: ['Wan 2.2 I2V 14B FP8'] },
  ]);
  assert.deepEqual(item.images.map((image) => image.src), [
    '/images/agent-experiments/comfyui/astronaut-gpt-image-2.png',
  ]);
  assert.equal(item.video.src, '/media/agent-experiments/comfyui-gpt-image2-wan/astronaut-i2v-5s.mp4');
  assert.equal(item.video.poster, item.images[0].src);
  const imageBytes = await readFile(new URL(`../../public${item.images[0].src}`, import.meta.url));
  assert.deepEqual([...imageBytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(imageBytes.readUInt32BE(16), 1672);
  assert.equal(imageBytes.readUInt32BE(20), 941);
  const videoPath = new URL(`../../public${item.video.src}`, import.meta.url);
  const videoBytes = await readFile(videoPath);
  assert.equal(videoBytes.toString('ascii', 4, 8), 'ftyp');
  assert.ok((await stat(videoPath)).size < 5_000_000);
});

test('공성전은 3D 게임 탭에서 발리스타와 성벽 파괴 캡처 및 실행 링크를 제공한다', async () => {
  const siege = visible.find((item) => item.id === 'siege-warfare');
  assert.equal(siege.category, '3D 게임 제작');
  assert.equal(siege.demoUrl, 'https://ssw-siege-warfare.swsongab11572.chatgpt.site/');
  assert.equal(siege.images.length, 2);
  assert.deepEqual(siege.images.map((image) => image.src), [
    '/images/agent-experiments/siege-warfare/01-ballista-wide.jpg',
    '/images/agent-experiments/siege-warfare/02-trebuchet-impact.png',
  ]);
  for (const image of siege.images) {
    const bytes = await readFile(new URL(`../../public${image.src}`, import.meta.url));
    if (image.src.endsWith('.png')) {
      assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      const width = bytes.readUInt32BE(16);
      const height = bytes.readUInt32BE(20);
      assert.ok(Math.abs(width / height - 16 / 9) < 0.04);
    } else {
      assert.deepEqual([...bytes.subarray(0, 3)], [255, 216, 255]);
    }
    assert.ok(bytes.length >= 50_000);
  }
});

test('물고기 키우기는 이미지 슬라이더와 설명 사이에 독립 BGM 플레이어를 둔다', async () => {
  const planet = agentExperiments.find((item) => item.id === 'planet-defense');
  const fish = agentExperiments.find((item) => item.id === 'aqua-guardian');
  assert.deepEqual(planet.modelCredits, [
    { purpose: '코드', models: ['GPT-5.6 Sol'] },
    { purpose: '2D 에셋', models: ['GPT Image 2'] },
  ]);
  assert.deepEqual(fish.modelCredits, [
    ...planet.modelCredits,
    { purpose: '배경음악', models: ['Lyria 3'], via: 'Gemini' },
  ]);
  assert.equal(planet.audio, undefined);
  assert.equal(fish.images.length, 2);
  assert.deepEqual(fish.audio, {
    src: '/media/agent-experiments/aqua-guardian/the-saltwater-hour.mp3',
    title: 'The Saltwater Hour', model: 'Lyria 3', via: 'Gemini',
    caption: '물고기 키우기에 사용한 배경음악',
  });
  const bytes = await readFile(new URL(`../../public${fish.audio.src}`, import.meta.url));
  assert.ok(bytes.toString('ascii', 0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0));
  assert.ok(bytes.length > 1_000_000 && bytes.length < 10_000_000);
  const component = await readFile(new URL('../components/about/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.match(component, /<audio[\s\S]*?preload="none"/);
  assert.match(component, /player\?\.pause\(\)/);
  assert.match(component, /active\.audio && <ExperimentAudio[\s\S]*?<div className=\{styles\.caption\}/);
  assert.match(component, /<article key=\{active\.id\}/);
  const carousel = await readFile(new URL('../components/about/ProjectMediaCarousel.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(carousel, /<audio|gallery\.audio|BGM 듣기/);
  assert.doesNotMatch(component, /\bautoPlay\b/);
});

test('제작 모델 정보가 기존 모델 비교 화면을 활성화하지 않고 숨김 항목도 보존한다', () => {
  assert.ok(visible.every((item) => item.models === undefined));
  assert.deepEqual(agentExperiments.filter((item) => item.hidden).map((item) => item.id), [
    'fps-model-comparison', 'blender-3d-assets',
  ]);
  assert.deepEqual(agentExperiments.find((item) => item.id === 'fps-model-comparison').models, [
    'Opus 5', 'Fable 5.1', 'Astra',
  ]);
});

test('하단의 실험 기록과 미확인 제작 안내 대신 실제 모델 정보를 사용한다', async () => {
  const source = await readFile(new URL('../components/about/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /<dt>실험 기록<\/dt>|모델별 제작 기록 정리 예정|제작 기록 확인 후 추가|요구사항·개입 과정·결과 정리 예정/);
  assert.match(source, /active\.modelCredits\.map/);
});
