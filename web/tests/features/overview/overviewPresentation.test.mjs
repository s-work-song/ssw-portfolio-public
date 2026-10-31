import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { readImageHeader } from '../../support/imageHeader.mjs';
import { aboutArchiveProjects, aboutDestinations, aboutProjects } from '../../../src/features/overview/data/about.ts';
import { openWeightExperiments } from '../../../src/features/experiments/data/openWeightExperiments.ts';
import { agentExperiments } from '../../../src/features/experiments/data/agentExperiments.ts';
import { creditsWithoutTitleRepeat, imageWithoutRepeatedCaption, mergeModelCredits } from '../../../src/features/experiments/ui/experimentPresentation.ts';

const allProjects = [...aboutProjects, ...openWeightExperiments];

test('소개 카드는 실제 본문 주제를 요약하고 기존 이동 경로를 유지한다', async () => {
  assert.deepEqual(aboutDestinations.map(({ href, desc }) => [href, desc]), [
    ['/about-me/resume', '실무 경력과 핵심 기술, 주요 업무에서 맡은 역할을 정리했습니다. 웹·앱 개발과 시스템 운영 경험을 바탕으로 쌓아 온 역량을 확인할 수 있습니다.'],
    ['/about-me/cover-letter', '개발을 대하는 관점과 학습 과정, 경력의 전환점과 앞으로의 방향을 소개합니다.'],
    ['/about-me/research', '하드웨어 구성과 소프트웨어 최적화, 두 영역을 함께 고려한 SIMD·AVX2 활용 경험을 정리했습니다. 실험 중인 내용도 소개합니다.'],
    ['/about-me/log', '개발과 일상에서 얻은 기술적 배움, 문제 해결 과정의 고민, 프로젝트 회고를 기록합니다.'],
  ]);
  const coverLetter = await readFile(new URL('../../../src/app/about-me/cover-letter/page.tsx', import.meta.url), 'utf8');
  const turningPoint = await readFile(new URL('../../../src/features/profile/ui/CareerTurningPointPreview.tsx', import.meta.url), 'utf8');
  for (const topic of ['학창 시절부터 이어진 탐구심', '로우레벨에서 하이레벨까지', 'Core Values']) {
    assert.ok(coverLetter.includes(topic), topic);
  }
  for (const topic of ['경력의 전환점', '다시 직장생활을 시작하려는 이유']) {
    assert.ok(turningPoint.includes(topic), topic);
  }
  assert.doesNotMatch(aboutDestinations.find(({ href }) => href === '/about-me/cover-letter').desc,
    /해결해 온 과정|가치관을 형성한 경험/u);
});

test('프로젝트 공개 상태는 문서·데모·실행 화면·스냅샷을 구분하고 링크를 보존한다', () => {
  const existingProjectIds = [
    'project-common-infrastructure', 'project-ecommerce-demo',
    'project-colab-llm-launcher', 'project-code-archive',
  ];
  const existingProjects = existingProjectIds.map((id) => {
    const project = allProjects.find((item) => item.id === id);
    assert.ok(project, `${id} must be preserved`);
    return project;
  });
  assert.deepEqual(existingProjects.map(({ status }) => status), [
    '설계 문서 공개', '데모·설계 문서 공개', '실행 화면 공개', '문서·코드 스냅샷 공개',
  ]);
  assert.deepEqual(existingProjects.flatMap(({ links = [] }) => links.map(({ href }) => href)), [
    'https://github.com/s-work-agency/ssw-infra-public',
    'https://github.com/s-work-agency/ssw-e-commerce-demo-public',
    'https://demo.ecommerce.sworkagency.com/',
    'https://admin.ecommerce.sworkagency.com/',
    '/about-me/research#research-chatbot-architecture',
    'https://s-work-agency.github.io/ssw-algorithm-archive-public/',
  ]);
  // 런처 카드의 연구 링크만 사이트 안 이동이다.
  assert.deepEqual(existingProjects[2].links, [{
    label: '챗봇 구조 실험 보기',
    href: '/about-me/research#research-chatbot-architecture',
    kind: 'research',
  }]);
  assert.equal(existingProjects[2].desc, 'Colab에서 오픈웨이트 모델을 실행하고, Cloudflare Tunnel을 통해 외부 서비스와 연결하는 런처입니다. 엔진·컨텍스트·배치 등 실행 옵션을 조절할 수 있습니다.');
  assert.doesNotMatch(existingProjects[2].desc, /현재|포트폴리오|이커머스/);
  assert.match(aboutArchiveProjects[1].desc, /정부24에서 조회한 토지대장 정보를 주소·지번 기준으로 원본 엑셀 행에 매핑/);
});

test('기존 추가 프로젝트는 섹션을 옮겨도 공개 상태와 링크 범위를 유지한다', () => {
  const additions = [
    ['project-colab-comfyui', 'SSW Colab ComfyUI'],
    ['project-receipt-ocr', 'SSW 영수증 OCR'],
    ['project-sprite-toolkit', 'SSW Sprite Toolkit'],
    ['project-asset-library', 'SSW Asset Library'],
  ];
  assert.equal(aboutProjects.length, 6);
  assert.deepEqual(aboutProjects.slice(-3).map(({ id }) => id), additions.slice(1).map(([id]) => id));
  assert.equal(new Set(allProjects.map(({ id }) => id)).size, allProjects.length);
  for (const [id, title] of additions) {
    const project = allProjects.find((item) => item.id === id);
    assert.ok(project, `${id} must be present`);
    assert.equal(project.title, title);
    assert.equal(project.status, '실행 화면 공개');
    assert.equal(project.links?.length ?? 0, 0);
    assert.doesNotMatch(project.desc, /https?:\/\/|Y:[\\/]|인식률|스토어 출시|전표 등록/u);
  }
});

test('새 프로젝트 소개 이미지는 실제 로컬 파일이며 테스트 자료와 캡처 조건을 구분한다', async () => {
  const additions = allProjects.filter(({ id }) => [
    'project-colab-comfyui', 'project-sprite-toolkit',
    'project-receipt-ocr', 'project-asset-library',
  ].includes(id));
  for (const project of additions) {
    assert.ok(project.gallery, `${project.id} needs a gallery or an explicit capture placeholder`);
    if (project.id !== 'project-colab-comfyui') {
      assert.ok(project.gallery.images.length, `${project.id} needs an app preview`);
    }
    for (const image of project.gallery.images) {
      assert.match(image.src, /^\/images\/projects\//u);
      assert.ok(image.alt && image.caption);
      const bytes = await readFile(new URL(`../../../public${image.src}`, import.meta.url));
      assert.ok(bytes.length > 0);
      if (/\.png$/u.test(image.src)) assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      if (/\.jpe?g$/u.test(image.src)) assert.equal(bytes.subarray(0, 3).toString('hex'), 'ffd8ff');
    }
  }
  const comfy = additions.find(({ id }) => id === 'project-colab-comfyui');
  assert.deepEqual(comfy.gallery.images.map(({ src }) => src), [
    '/images/projects/colab-comfyui/01-web-image-generation.jpg',
    '/images/projects/colab-comfyui/02-web-system.jpg',
    '/images/projects/colab-comfyui/03-comfyui-image-workflow.webp',
  ]);
  assert.match(comfy.gallery.images[0].caption, /이미지 생성 웹.*프롬프트.*결과 목록/u);
  assert.match(comfy.gallery.images[1].caption, /시스템.*모델.*자원.*연결/u);
  assert.match(comfy.gallery.images[2].caption, /ComfyUI 이미지 워크플로/u);
  assert.doesNotMatch(comfy.gallery.images[2].caption, /전용 생성 웹|생성 완료/u);
  assert.doesNotMatch(JSON.stringify(comfy.gallery), /sf-astronaut|sf-video-input|생성 결과물|GPT 생성 입력|로컬 레이아웃 미리보기|01-video-layout|02-image-layout/u);
  const sprite = additions.find(({ id }) => id === 'project-sprite-toolkit');
  assert.deepEqual(sprite.gallery.images.map(({ src }) => src), [
    '/images/projects/sprite-toolkit/01-home.png',
    '/images/projects/sprite-toolkit/02-castle-workspace.webp',
    '/images/projects/sprite-toolkit/03-color-change-preview.webp',
    '/images/projects/sprite-toolkit/01-grid-workspace.jpg',
    '/images/projects/sprite-toolkit/02-quality-check.jpg',
  ]);
  assert.match(sprite.gallery.images[2].caption, /파랑.*빨강.*적용 전 미리보기/u);
  const receipt = additions.find(({ id }) => id === 'project-receipt-ocr');
  assert.deepEqual(receipt.gallery.images.map(({ src }) => src), [
    '/images/projects/receipt-ocr/01-receipt-review-trimmed.webp',
    '/images/projects/receipt-ocr/02-ai-settings-trimmed.png',
  ]);
  assert.match(receipt.gallery.images[0].caption, /검수.*일부 정보 가림/u);
  assert.match(receipt.gallery.images[1].caption, /AI 설정.*ChatGPT.*OpenAI 호환 API/u);
  for (const [image, width, height] of [
    [receipt.gallery.images[0], 2299, 1308],
    [receipt.gallery.images[1], 1909, 1051],
  ]) {
    const header = readImageHeader(await readFile(new URL(`../../../public${image.src}`, import.meta.url)));
    assert.deepEqual([header.width, header.height], [width, height]);
  }
  assert.doesNotMatch(JSON.stringify(receipt.gallery), /01-android-library|02-desktop-review|01-receipt-review\.png|02-ai-settings\.png|0\.1\.6|합성|UI 테스트 렌더/u);
  const asset = additions.find(({ id }) => id === 'project-asset-library');
  assert.deepEqual(asset.gallery.images.map(({ src }) => src), [
    '/images/projects/asset-library/01-military-models.webp',
    '/images/projects/asset-library/02-gym-models.webp',
    '/images/projects/asset-library/03-office-models-v2.webp',
    '/images/projects/asset-library/04-campsite-models-v2.webp',
    '/images/projects/asset-library/05-environment-models-v2.webp',
    '/images/projects/asset-library/04-food-library.webp',
    '/images/projects/asset-library/07-music-library.webp',
  ]);
  assert.doesNotMatch(JSON.stringify(asset.gallery), /02-gym-library|03-gym-equipment-detail|reference-map|mobile-library|05-environment-library\.png|랫풀다운|합성 테스트/u);
});

test('과거 작업을 SI 협업 프로젝트보다 먼저 배치하고 마지막 안내는 한 문장으로만 표시한다', async () => {
  const page = await readFile(new URL('../../../src/app/about-me/page.tsx', import.meta.url), 'utf8');
  const anchors = ['id="portfolio-overview"', 'aboutDestinations.map', 'id="past-work-archive"', 'id="featured-projects"', 'id="open-weight-experiments"', '<OptimizationPreview />', '<ArchitecturePreview />', '<AgentExperimentGallery />', '상세 이력서를 확인해 보세요'];
  const positions = anchors.map((anchor) => page.indexOf(anchor));
  assert.ok(positions.every((position, index) => position >= 0 && (!index || position > positions[index - 1])));
  assert.match(page, />\s*SI\(Super Intelligence, 초지능\) 협업 프로젝트\s*<\/h3>/);
  assert.doesNotMatch(page, />\s*주요 프로젝트\s*<\/h3>/);
  for (const anchor of ['id="past-work-archive"', 'id="featured-projects"', 'id="open-weight-experiments"']) {
    assert.equal(page.split(anchor).length - 1, 1);
  }
  assert.ok(page.includes('요구사항과 운영 환경에 맞춰 구조와 기술을 선택하고, SI 에이전트의 구현 결과를 검토·테스트하며 진행한 프로젝트입니다.'));
  assert.doesNotMatch(page, /첫걸음|일목요연하게/);
  assert.match(page, /minmax\(min\(100%, 280px\), 1fr\)/);
  const cta = page.slice(page.indexOf('{/* Bottom CTA'));
  assert.doesNotMatch(cta, /<p\b/);
  assert.match(cta, /href="\/about-me\/resume"/);
});

test('소개 본문은 하드웨어 탐구와 에이전트 네이티브 개발 지향의 두 문단으로 표시한다', async () => {
  const page = await readFile(new URL('../../../src/app/about-me/page.tsx', import.meta.url), 'utf8');
  const start = page.indexOf('id="portfolio-overview"');
  const hero = page.slice(start, page.indexOf('</AboutPanel>', start));
  const paragraphs = [...hero.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gu)]
    .map(([, content]) => content.trim());
  assert.deepEqual(paragraphs, [
    '하드웨어의 성능과 한계를 직접 측정하는 취미에서 출발해, CPU·주기억장치·보조기억장치에서 데이터가 처리되고 저장되는 방식을 살펴왔습니다. 구성 요소 간 데이터 전송과 외부 유무선 통신에서 대역폭이 성능에 미치는 영향까지 함께 고려하며, 컴퓨팅 시스템 전반의 동작 원리를 탐구해 왔습니다.',
    '소프트웨어 개발에서는 객체지향과 설계 원칙, 디자인 패턴을 단순히 암기하는 데 그치지 않고, 실제 문제 해결에 효과적으로 적용하는 방법을 고민해 왔습니다. 이를 바탕으로 SI(Super Intelligence, 초지능) 에이전트와 협업하며 개발 과정의 생산성을 높이는 에이전트 네이티브 소프트웨어 엔지니어를 지향하고 있습니다.',
  ]);
});

test('동일 모델의 여러 역할은 하나로 합치고 경유 도구와 원본 데이터는 보존한다', () => {
  const office = agentExperiments.find(({ id }) => id === 'blender-office');
  const before = structuredClone(office.modelCredits);
  assert.deepEqual(mergeModelCredits(office.modelCredits), [
    { purpose: '프롬프트 · Blender 모델링', models: ['GPT-6 Astra'], via: undefined },
    { purpose: '이미지', models: ['GPT Image 2.5'], via: undefined },
  ]);
  assert.deepEqual(office.modelCredits, before);
  assert.equal(mergeModelCredits([{ models: ['Model'], via: 'A' }, { models: ['Model'], via: 'B' }]).length, 2);
});

test('사진 헤더와 정확히 같은 캡션만 생략하고 슬라이드별 모델·파일은 보존한다', () => {
  const food = agentExperiments.find(({ id }) => id === 'blender-food');
  for (const image of food.images) {
    const result = imageWithoutRepeatedCaption(image, food.modelCredits);
    assert.equal(result.caption, undefined);
    assert.equal(result.title, image.title);
    assert.equal(result.src, image.src);
    assert.equal(result.modelCreditPurpose, image.modelCreditPurpose);
    assert.ok(image.caption);
    const distinct = { ...image, caption: '재질과 조명을 비교한 렌더' };
    assert.equal(imageWithoutRepeatedCaption(distinct, food.modelCredits), distinct);
  }
});

test('제목에 포함된 제작 모델만 중복 생략하고 역할이나 경유 도구가 있으면 유지한다', () => {
  assert.deepEqual(creditsWithoutTitleRepeat('모션그래픽 · Opus 5.5', [{ models: ['Opus 5.5'] }]), []);
  assert.deepEqual(creditsWithoutTitleRepeat('모션 도감', [{ models: ['Opus 5.5'] }]), [{ models: ['Opus 5.5'] }]);
  assert.equal(creditsWithoutTitleRepeat('모션그래픽 · Opus 5.5', [{ models: ['Opus 5.5'], purpose: '코드' }]).length, 1);
});

test('제작 모델은 크레딧이나 선택 제목에서 안내하고 설명·태그·캡션에는 반복하지 않는다', () => {
  for (const experiment of agentExperiments.filter(({ hidden }) => !hidden)) {
    const prose = [experiment.description, ...experiment.focus,
      ...(experiment.images ?? []).map((image) => imageWithoutRepeatedCaption(image, experiment.modelCredits).caption ?? ''),
      experiment.video?.caption ?? '',
    ].join('\n');
    for (const model of new Set(experiment.modelCredits?.flatMap(({ models }) => models) ?? [])) {
      assert.ok(!prose.includes(model), `${experiment.id} repeats ${model}`);
    }
  }
});

test('실험 제목·모델의 하단 중복 표시를 없애도 분류·작품·BGM·직접 실행은 보존한다', async () => {
  const source = await readFile(new URL('../../../src/features/experiments/ui/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.match(source, /<h3 id="agent-experiments-heading">SI 활용 실험<\/h3>/);
  const caption = source.slice(source.indexOf('<div className={styles.caption}>'));
  assert.doesNotMatch(caption, /<h4>\{active\.title\}<\/h4>|<dl aria-label="사용 모델">/);
  // 이동·핑용 상단 헤더는 기존 작품 제목만 한 번 재사용하고 하단 중복은 만들지 않는다.
  assert.match(source, /<header className=\{styles\.experimentHeading\} data-agent-experiment-heading="true" tabIndex=\{-1\}>[\s\S]*?<h4>\{active\.title\}<\/h4>[\s\S]*?<\/header>/);
  assert.equal((source.match(/<h4>\{active\.title\}<\/h4>/g) ?? []).length, 1);
  assert.match(source, /<strong>\{item\.title\}<\/strong>/);
  assert.match(source, /aria-label="실험 분류"/);
  assert.match(source, /aria-label="실험 바로 선택"/);
  assert.match(source, /onKeyDown=\{\(event\) => handleKey\(event, itemIndex\)\}/);
  assert.match(source, /<ExperimentAudio title=\{active\.title\} audio=\{active\.audio\}/);
  assert.match(source, /active\.demoUrl && <a href=\{active\.demoUrl\}/);
  assert.match(source, /gallery=\{\{ images, placeholder:/);
  assert.match(source, /hideInlineCaption=\{Boolean\(currentImage && imageWithoutRepeatedCaption\(currentImage, credits\)/);
  const carousel = await readFile(new URL('../../../src/features/projects/ui/ProjectMediaCarousel.tsx', import.meta.url), 'utf8');
  assert.match(carousel, /hideInlineCaption = false/);
  assert.match(carousel, /const inlineCaption = hideInlineCaption \? undefined : currentImage.caption/);
  assert.match(carousel, /<p>\{currentImage.caption \?\? currentImage.alt\}<\/p>/);
});

test('SI 실험 안내는 오픈웨이트 모델과 프론티어 SI로 표현하고 요청한 두 문단을 유지한다', async () => {
  const source = await readFile(new URL('../../../src/features/experiments/ui/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  const intro = source.match(/id=\{AGENT_EXPERIMENT_INTRO_ANCHOR\}[^>]*>([\s\S]*?)<\/div>/)?.[1];
  assert.ok(intro);
  assert.deepEqual([...intro.matchAll(/<p className=\{styles\.intro\}>(.*?)<\/p>/g)].map((match) => match[1]), [
    '오픈웨이트 모델부터 프론티어 SI까지, 다양한 모델이 어떤 작업을 어느 수준까지 수행할 수 있는지 직접 실험하고 있습니다.',
    '개발을 중심으로 경험을 쌓아 온 만큼, 디자인과 시각적 표현은 상대적으로 익숙하지 않은 영역이었습니다. 하지만 SI 에이전트와 함께 작업하면서 혼자서는 구현하기 어려웠던 아이디어를 구체화하고, 부족했던 부분을 보완할 수 있다는 가능성을 느꼈습니다.',
    '그 가능성을 실제 작업으로 연결하려면 모델이 잘하는 일과 한계를 이해하는 것이 중요하다고 생각합니다. 다양한 과제를 직접 시도하며, 작업과 상황에 따라 어떤 맥락을 어떻게 제공해야 원하는 결과에 가까워지는지 알아가고 있습니다.',
  ]);
  assert.doesNotMatch(source, /오픈웨이트\s+(?:AI|SI)/u);
  assert.doesNotMatch(openWeightExperiments.find(({ id }) => id === 'project-colab-llm-launcher').desc, /오픈웨이트\s+(?:AI|SI)/u);
});

test('소개 설명은 SI 에이전트로 통일하되 실제 UI명과 기존 모델 크레딧은 보존하고 챗봇은 오픈웨이트 모델로 부른다', () => {
  const archive = aboutProjects.find(({ id }) => id === 'project-code-archive');
  const sprite = aboutProjects.find(({ id }) => id === 'project-sprite-toolkit');
  const asset = aboutProjects.find(({ id }) => id === 'project-asset-library');
  assert.match(archive.desc, /^SI 에이전트로 구현한 코드/u);
  assert.match(sprite.desc, /^SI 에이전트로 생성한 스프라이트.*WebMCP로 SI 에이전트/u);
  assert.match(asset.desc, /MCP를 통해 SI 에이전트/u);
  const office = agentExperiments.find(({ id }) => id === 'blender-office');
  assert.match(office.description, /^SI 에이전트로 프롬프트/u);
  assert.ok(office.modelCredits.some(({ models }) => models.includes('GPT-6 Astra')));
  const comfy = agentExperiments.find(({ id }) => id === 'comfyui-qwen-wan');
  assert.match(comfy.description, /^SI 에이전트와 함께 ComfyUI/u);
  assert.ok(comfy.modelCredits.some(({ models }) => models.includes('GPT-6 Sol')));
  assert.match(aboutProjects.find(({ id }) => id === 'project-receipt-ocr').gallery.images[1].caption, /AI 설정.*OpenAI/u);
  assert.match(openWeightExperiments.find(({ id }) => id === 'project-colab-llm-launcher').gallery.images[1].caption, /^오픈웨이트 모델 챗봇 도구 호출/u);
});

test('오픈웨이트 실험은 독립 데이터로 이동하고 공통 카드 렌더러로 한 번씩 표시한다', async () => {
  assert.deepEqual(aboutProjects.map(({ id }) => id), [
    'project-common-infrastructure', 'project-ecommerce-demo', 'project-code-archive',
    'project-receipt-ocr', 'project-sprite-toolkit', 'project-asset-library',
  ]);
  assert.deepEqual(openWeightExperiments.map(({ id }) => id), [
    'project-colab-llm-launcher', 'project-colab-comfyui', 'project-open-weight-finetuning',
  ]);
  const page = await readFile(new URL('../../../src/app/about-me/page.tsx', import.meta.url), 'utf8');
  assert.match(page, />\s*오픈웨이트 모델 실험\s*<\/h3>/u);
  for (const collection of ['aboutProjects', 'openWeightExperiments']) {
    assert.equal(page.split(`<ProjectCardGrid projects={${collection}} />`).length - 1, 1);
  }
  assert.doesNotMatch(page, /aboutProjects\.map|openWeightExperiments\.map/u);
  const cards = await readFile(new URL('../../../src/features/projects/ui/ProjectCardGrid.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(cards, /['"]use client['"]/u);
  assert.match(cards, /id=\{project\.id\}/u);
  assert.match(cards, /<ProjectMediaCarousel/u);
  assert.match(cards, /project\.links\.map/u);
  assert.match(cards, /rel="noopener noreferrer"/u);
  assert.match(cards, /project\.statusTone === 'warning'/u);
  const css = await readFile(new URL('../../../src/features/projects/ui/ProjectCardGrid.module.css', import.meta.url), 'utf8');
  assert.match(css, /\.experimentCard\s*\{\s*grid-column: 1 \/ -1/u);
  assert.match(css, /minmax\(min\(100%, 320px\), 1fr\)/u);
});

test('파인튜닝은 빈 사진 영역 없이 표시하고 기존 런처·ComfyUI 이미지는 유지한다', async () => {
  const finetuning = openWeightExperiments.find(({ id }) => id === 'project-open-weight-finetuning');
  assert.equal(finetuning.gallery, undefined);
  assert.equal(finetuning.status, '실험·학습 진행 중');
  for (const id of ['project-colab-llm-launcher', 'project-colab-comfyui']) {
    assert.ok(openWeightExperiments.find((project) => project.id === id).gallery.images.length > 0);
  }
  const cards = await readFile(new URL('../../../src/features/projects/ui/ProjectCardGrid.tsx', import.meta.url), 'utf8');
  assert.match(cards, /project\.gallery &&/u);
});

test('미세조정은 정규 교육이 아닌 SI 협업 독학 실험과 전문지식·검증 범위의 한계를 밝힌다', () => {
  const finetuning = openWeightExperiments.find(({ id }) => id === 'project-open-weight-finetuning');
  assert.equal(finetuning.title, '오픈웨이트 모델 미세조정');
  assert.match(finetuning.desc, /Google Colab.*파인튜닝을 실험/u);
  assert.equal(finetuning.learningContext.title, '학습 배경과 실험 방식');
  assert.equal(finetuning.learningContext.paragraphs.length, 3);
  assert.match(finetuning.learningContext.paragraphs[0], /궁금증을 해소.*무엇을 바꾸면 어떤 결과.*탐색적 실험/u);
  assert.match(finetuning.learningContext.paragraphs[1], /정규 교육과정을 거치지 않고 독학.*전문지식에는 아직 한계/u);
  assert.match(finetuning.learningContext.paragraphs[2], /SI 에이전트와 함께 방법을 찾아 적용하고.*관찰·실측.*경험적 접근\(empirical approach\)/u);
  assert.doesNotMatch(finetuning.learningContext.paragraphs.join(' '), /통제 실험|일요인 실험|OFAT|인과관계.*입증/u);
  assert.doesNotMatch(finetuning.desc, /정규 교육과정|전문지식|SI 에이전트와 함께/u);
  assert.match(finetuning.desc, /LoRA.*도구 호출을 학습/u);
  assert.match(finetuning.desc, /현재 테스트와 적용은 이 포트폴리오 사이트의 채팅 챗봇에 한정/u);
  assert.match(finetuning.desc, /검색해 답하는 메인 세션과.*작업 세션을 대상으로/u);
  assert.match(finetuning.desc, /테마·채팅 설정 변경, 페이지 이동/u);
  assert.equal(finetuning.desc.split('\n\n').length, 3);
  assert.match(finetuning.desc, /많은 컴퓨팅 자원과 시간.*비용/u);
  assert.match(finetuning.desc, /다양한 조건의 테스트를 충분히 반복하지는 못했으며/u);
  assert.match(finetuning.desc, /제한된 범위에서 확인한 실험 예시/u);
  assert.match(finetuning.status, /실험·학습 진행 중/u);
});

test('학습 배경과 실험 방식은 본문과 실험 예시 사이의 독립 카드로 표시한다', async () => {
  const cards = await readFile(new URL('../../../src/features/projects/ui/ProjectCardGrid.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../../src/features/projects/ui/ProjectCardGrid.module.css', import.meta.url), 'utf8');
  const learningIndex = cards.indexOf('project.learningContext &&');
  assert.ok(cards.indexOf('{project.desc}') < learningIndex);
  assert.ok(learningIndex < cards.indexOf('project.experiment &&'));
  assert.match(cards, /<section className=\{styles\.learningContext\} aria-labelledby=\{`\$\{project.id\}-learning-context`\}/u);
  assert.match(cards, /project\.learningContext\.paragraphs\.map/u);
  const cardStyle = css.match(/\.learningContext,\s*\.experiment\s*\{([^}]*)\}/u)?.[1];
  assert.ok(cardStyle);
  assert.match(cardStyle, /border: 1px solid var\(--border\);/u);
  assert.match(cardStyle, /background: var\(--bg-elev\);/u);
  assert.doesNotMatch(cardStyle, /^\s*(?:block-size|height):|^\s*overflow:\s*hidden/mu);
});

test('미세조정 학습 배경 카드는 같은 탭에서 학습 관점 기록으로 연결한다', async () => {
  const finetuning = openWeightExperiments.find(({ id }) => id === 'project-open-weight-finetuning');
  assert.deepEqual(finetuning.learningContext.relatedLog, {
    slug: 'every-learning-and-research-effort-has-a-cost',
    label: '학습과 실험에 대한 생각',
  });
  assert.equal(finetuning.learningContext.paragraphs.length, 3);
  const cards = await readFile(new URL('../../../src/features/projects/ui/ProjectCardGrid.tsx', import.meta.url), 'utf8');
  const learningCard = cards.slice(cards.indexOf('project.learningContext &&'), cards.indexOf('project.experiment &&'));
  assert.match(cards, /import LogReadingLink from '@\/features\/logs\/navigation\/LogReadingLink'/u);
  assert.match(learningCard, /project\.learningContext\.relatedLog &&/u);
  assert.match(learningCard, /<LogReadingLink\s+slug=\{project\.learningContext\.relatedLog\.slug\}/u);
  assert.doesNotMatch(learningCard, /<Link\b|href=/u);
  assert.match(learningCard, /<span aria-hidden="true">→<\/span>/u);
  assert.doesNotMatch(learningCard, /target=|window\.open|https?:\/\//u);
  const css = await readFile(new URL('../../../src/features/projects/ui/ProjectCardGrid.module.css', import.meta.url), 'utf8');
  assert.match(css, /\.learningContextLink\s*\{[^}]*max-width: 100%;[^}]*min-height: 44px;/u);
  assert.match(css, /\.learningContextLink:focus-visible\s*\{/u);
});

test('메인 지침 축약은 문자 수 범위와 유지 항목 및 기반 모델 관찰의 한계를 명시한다', () => {
  const finetuning = openWeightExperiments.find(({ id }) => id === 'project-open-weight-finetuning');
  const experiment = finetuning.experiment;
  assert.equal(experiment.title, '실험 예시 · 메인 지침 축약');
  assert.equal(experiment.before, '이전 · 기반 모델용 전체 지침');
  assert.equal(experiment.after, '현재 · 메인 LoRA용 간결 지침');
  assert.equal(experiment.result, '11,339자 → 1,562자 · 9,777자 감소 (86.2%)');
  assert.equal(11339 - 1562, 9777);
  assert.equal(((11339 - 1562) / 11339 * 100).toFixed(1), '86.2');
  assert.match(experiment.scope, /메인 세션 시스템 지침의 문자 수/u);
  assert.match(experiment.scope, /86자 상기 문구는 포함하지 않았고/u);
  assert.match(experiment.scope, /전체 입력 토큰의 감소율은 아닙니다/u);
  assert.match(experiment.retained, /고정 답변 문장, 도구 정의와 실행 전후 검증/u);
  assert.match(experiment.observation, /기반 모델에 간결 지침만 주면.*검색하는 경우가 크게 줄었습니다/u);
  assert.match(experiment.limitation, /LoRA를 적용한 뒤의 품질은 아직 검증 중입니다/u);
  assert.doesNotMatch(JSON.stringify(finetuning), /https?:\/\/|localhost|127\.0\.0\.1|192\.168\.|[A-Z]:[\\/]|정책 LoRA|품질 향상|속도 개선/u);
});

test('미세조정 카드는 학습 데이터를 연구 경험 오픈웨이트 모델 실험 탭으로 넘기고 카드 안에는 예시를 두지 않는다', async () => {
  const finetuning = openWeightExperiments.find(({ id }) => id === 'project-open-weight-finetuning');
  assert.equal(finetuning.trainingExamples, undefined);
  assert.deepEqual(finetuning.links, [
    { label: '학습 데이터 형식·예시 보기', href: '/about-me/research#research-training-data', kind: 'research' },
  ]);
  const cards = await readFile(new URL('../../../src/features/projects/ui/ProjectCardGrid.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../../src/features/projects/ui/ProjectCardGrid.module.css', import.meta.url), 'utf8');
  assert.doesNotMatch(cards, /trainingExamples|trainingTranscript|prettyJson/u);
  assert.doesNotMatch(css, /.training/u);
});

test('소개 오픈웨이트 모델 실험 섹션은 같은 이름의 연구 탭을 상세로 연결한다', async () => {
  const page = await readFile(new URL('../../../src/app/about-me/page.tsx', import.meta.url), 'utf8');
  const footer = await readFile(new URL('../../../src/features/experiments/ui/OpenWeightDetailFooter.tsx', import.meta.url), 'utf8');
  const section = page.slice(page.indexOf('id="open-weight-experiments"'));
  assert.ok(section.indexOf('<ProjectCardGrid projects={openWeightExperiments} />') < section.indexOf('<OpenWeightDetailFooter />'));
  assert.ok(section.indexOf('<OpenWeightDetailFooter />') < section.indexOf('</AboutPanel>'));
  assert.match(footer, /<ResearchLink href=\{ACTION_ROUTES\.research_open_weight\}/u);
  assert.match(footer, /오픈웨이트 모델 실험 상세 보기/u);
  const { ACTION_LABELS, ACTION_ROUTES } = await import('../../../src/features/chat/constants.ts');
  assert.equal(ACTION_ROUTES.research_open_weight, '/about-me/research#research-chatbot-architecture');
  // 소개 섹션과 상세 탭의 이동 문구가 겹치지 않아야 채팅 버튼에서 둘을 구분한다.
  assert.notEqual(ACTION_LABELS.research_open_weight, ACTION_LABELS.open_weight_experiments);
});
