import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { aboutDestinations, aboutProjects } from '../../../src/features/overview/data/about.ts';
import { openWeightExperiments } from '../../../src/features/experiments/data/openWeightExperiments.ts';
import { creditsWithoutTitleRepeat, imageWithoutRepeatedCaption, mergeModelCredits } from '../../../src/features/experiments/ui/experimentPresentation.ts';

const allProjects = [...aboutProjects, ...openWeightExperiments];

test('소개 카드의 이동 경로는 실제 페이지를 가리킨다', async () => {
  assert.ok(aboutDestinations.length > 0);
  for (const { href } of aboutDestinations) {
    await access(new URL(`../../../src/app${href}/page.tsx`, import.meta.url));
  }
});

test('프로젝트 id는 섹션을 옮겨도 중복되지 않는다', () => {
  assert.equal(new Set(allProjects.map(({ id }) => id)).size, allProjects.length);
});

test('프로젝트 갤러리 이미지는 실제 로컬 파일이고 대체 문구와 캡션을 갖는다', async () => {
  const images = allProjects.flatMap(({ gallery }) => gallery?.images ?? []);
  assert.ok(images.length > 0);
  for (const image of images) {
    assert.ok(image.alt && image.caption, image.src);
    const bytes = await readFile(new URL(`../../../public${image.src}`, import.meta.url));
    assert.ok(bytes.length > 0);
    if (/\.png$/u.test(image.src)) assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    if (/\.jpe?g$/u.test(image.src)) assert.equal(bytes.subarray(0, 3).toString('hex'), 'ffd8ff');
  }
});

test('소개 페이지의 섹션 앵커는 한 번씩만 정해진 순서로 놓이고 마지막 안내는 이력서로 연결한다', async () => {
  const page = await readFile(new URL('../../../src/app/about-me/page.tsx', import.meta.url), 'utf8');
  const anchors = ['id="portfolio-overview"', 'aboutDestinations.map', 'id="past-work-archive"', 'id="featured-projects"', 'id="open-weight-experiments"', '<OptimizationPreview />', '<ArchitecturePreview />', '<AgentExperimentGallery />'];
  const positions = anchors.map((anchor) => page.indexOf(anchor));
  assert.ok(positions.every((position, index) => position >= 0 && (!index || position > positions[index - 1])));
  for (const anchor of ['id="past-work-archive"', 'id="featured-projects"', 'id="open-weight-experiments"']) {
    assert.equal(page.split(anchor).length - 1, 1);
  }
  const cta = page.slice(page.indexOf('{/* Bottom CTA'));
  assert.match(cta, /href="\/about-me\/resume"/);
});

test('동일 모델의 여러 역할은 하나로 합치고 경유 도구와 원본 데이터는 보존한다', () => {
  const credits = [
    { purpose: '프롬프트', models: ['Model A'] },
    { purpose: '이미지', models: ['Model B'] },
    { purpose: '모델링', models: ['Model A'] },
  ];
  const before = structuredClone(credits);
  assert.deepEqual(mergeModelCredits(credits), [
    { purpose: '프롬프트 · 모델링', models: ['Model A'], via: undefined },
    { purpose: '이미지', models: ['Model B'], via: undefined },
  ]);
  assert.deepEqual(credits, before);
  assert.equal(mergeModelCredits([{ models: ['Model'], via: 'A' }, { models: ['Model'], via: 'B' }]).length, 2);
});

test('사진 헤더와 정확히 같은 캡션만 생략하고 슬라이드별 모델·파일은 보존한다', () => {
  const credits = [{ purpose: '가전', models: ['Model A'] }];
  const image = { src: '/a.webp', alt: '믹서', title: '믹서', caption: '믹서 · Model A', modelCreditPurpose: '가전' };
  const result = imageWithoutRepeatedCaption(image, credits);
  assert.equal(result.caption, undefined);
  assert.equal(result.title, image.title);
  assert.equal(result.src, image.src);
  assert.equal(result.modelCreditPurpose, image.modelCreditPurpose);
  const distinct = { ...image, caption: '재질과 조명을 비교한 렌더' };
  assert.equal(imageWithoutRepeatedCaption(distinct, credits), distinct);
});

test('제목에 포함된 제작 모델만 중복 생략하고 역할이나 경유 도구가 있으면 유지한다', () => {
  assert.deepEqual(creditsWithoutTitleRepeat('모션그래픽 · Opus 5.5', [{ models: ['Opus 5.5'] }]), []);
  assert.deepEqual(creditsWithoutTitleRepeat('모션 도감', [{ models: ['Opus 5.5'] }]), [{ models: ['Opus 5.5'] }]);
  assert.equal(creditsWithoutTitleRepeat('모션그래픽 · Opus 5.5', [{ models: ['Opus 5.5'], purpose: '코드' }]).length, 1);
});

test('실험 제목·모델의 하단 중복 표시를 없애도 분류·작품·BGM·직접 실행은 보존한다', async () => {
  const source = await readFile(new URL('../../../src/features/experiments/ui/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  const caption = source.slice(source.indexOf('<div className={styles.caption}>'));
  assert.doesNotMatch(caption, /<h4>\{active\.title\}<\/h4>|<dl aria-label="사용 모델">/);
  // 이동·핑용 상단 헤더는 기존 작품 제목만 한 번 재사용하고 하단 중복은 만들지 않는다.
  assert.match(source, /<header className=\{styles\.experimentHeading\} data-agent-experiment-heading="true" tabIndex=\{-1\}>[\s\S]*?<h4>\{active\.title\}<\/h4>[\s\S]*?<\/header>/);
  assert.equal((source.match(/<h4>\{active\.title\}<\/h4>/g) ?? []).length, 1);
  assert.match(source, /<strong>\{item\.title\}<\/strong>/);
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

test('오픈웨이트 실험은 독립 데이터로 이동하고 공통 카드 렌더러로 한 번씩 표시한다', async () => {
  const page = await readFile(new URL('../../../src/app/about-me/page.tsx', import.meta.url), 'utf8');
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
});

test('갤러리가 없는 프로젝트 카드는 빈 사진 영역을 만들지 않는다', async () => {
  const cards = await readFile(new URL('../../../src/features/projects/ui/ProjectCardGrid.tsx', import.meta.url), 'utf8');
  assert.match(cards, /project\.gallery &&/u);
});

test('학습 배경과 실험 방식은 본문과 실험 예시 사이의 독립 카드로 표시한다', async () => {
  const cards = await readFile(new URL('../../../src/features/projects/ui/ProjectCardGrid.tsx', import.meta.url), 'utf8');
  const learningIndex = cards.indexOf('project.learningContext &&');
  assert.ok(cards.indexOf('{project.desc}') < learningIndex);
  assert.ok(learningIndex < cards.indexOf('project.experiment &&'));
  assert.match(cards, /<section className=\{styles\.learningContext\} aria-labelledby=\{`\$\{project.id\}-learning-context`\}/u);
  assert.match(cards, /project\.learningContext\.paragraphs\.map/u);
});

test('미세조정 학습 배경 카드는 같은 탭에서 학습 관점 기록으로 연결한다', async () => {
  const cards = await readFile(new URL('../../../src/features/projects/ui/ProjectCardGrid.tsx', import.meta.url), 'utf8');
  const learningCard = cards.slice(cards.indexOf('project.learningContext &&'), cards.indexOf('project.experiment &&'));
  assert.match(cards, /import LogReadingLink from '@\/features\/logs\/navigation\/LogReadingLink'/u);
  assert.match(learningCard, /project\.learningContext\.relatedLog &&/u);
  assert.match(learningCard, /<LogReadingLink\s+slug=\{project\.learningContext\.relatedLog\.slug\}/u);
  assert.doesNotMatch(learningCard, /<Link\b|href=/u);
  assert.match(learningCard, /<span aria-hidden="true">→<\/span>/u);
  assert.doesNotMatch(learningCard, /target=|window\.open|https?:\/\//u);
});

test('미세조정 카드 렌더러에는 학습 데이터 예시를 두지 않는다', async () => {
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
  const { ACTION_LABELS, ACTION_ROUTES } = await import('../../../src/features/chat/constants.ts');
  assert.equal(ACTION_ROUTES.research_open_weight, '/about-me/research#research-chatbot-architecture');
  // 소개 섹션과 상세 탭의 이동 문구가 겹치지 않아야 채팅 버튼에서 둘을 구분한다.
  assert.notEqual(ACTION_LABELS.research_open_weight, ACTION_LABELS.open_weight_experiments);
});
