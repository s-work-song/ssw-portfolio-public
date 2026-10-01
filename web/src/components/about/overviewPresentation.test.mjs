import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { aboutArchiveProjects, aboutDestinations, aboutProjects } from '../../data/about.ts';
import { agentExperiments } from '../../data/agentExperiments.ts';
import { creditsWithoutTitleRepeat, imageWithoutRepeatedCaption, mergeModelCredits } from './experimentPresentation.ts';

test('소개 카드 문구와 기존 이동 경로를 유지하고 이력서 설명에서는 회사명을 뺀다', () => {
  assert.deepEqual(aboutDestinations.map(({ href, desc }) => [href, desc]), [
    ['/about-me/resume', '실무 경력과 핵심 기술, 주요 업무에서 맡은 역할을 정리했습니다. 웹·앱 개발과 시스템 운영 경험을 바탕으로 쌓아 온 역량을 확인할 수 있습니다.'],
    ['/about-me/cover-letter', '문제를 발견하고 해결해 온 과정과, 엔지니어로서의 가치관을 형성한 경험을 담았습니다.'],
    ['/about-me/research', '하드웨어 구성과 소프트웨어 최적화, 두 영역을 함께 고려한 SIMD·AVX2 활용 경험을 정리했습니다. AI 에이전트 오케스트레이션의 실험 과정과 결과도 담았습니다.'],
    ['/about-me/log', '개발과 일상에서 얻은 기술적 배움, 문제 해결 과정의 고민, 프로젝트 회고를 기록합니다.'],
  ]);
});

test('프로젝트 공개 상태는 문서·데모·실행 화면·스냅샷을 구분하고 링크를 보존한다', () => {
  assert.deepEqual(aboutProjects.map(({ status }) => status), [
    '설계 문서 공개', '데모·설계 문서 공개', '실행 화면 공개', '문서·코드 스냅샷 공개',
  ]);
  assert.deepEqual(aboutProjects.flatMap(({ links = [] }) => links.map(({ href }) => href)), [
    'https://github.com/s-work-agency/ssw-infra-public',
    'https://github.com/s-work-agency/ssw-e-commerce-demo-public',
    'https://demo.ecommerce.sworkagency.com/',
    'https://admin.ecommerce.sworkagency.com/',
    'https://s-work-agency.github.io/ssw-algorithm-archive-public/',
  ]);
  assert.equal(aboutProjects[2].desc, 'Colab에서 오픈웨이트 모델을 실행하고, Cloudflare Tunnel을 통해 외부 서비스와 연결하는 런처입니다. 엔진·컨텍스트·배치 등 실행 옵션을 조절할 수 있습니다.');
  assert.doesNotMatch(aboutProjects[2].desc, /현재|포트폴리오|이커머스/);
  assert.match(aboutArchiveProjects[1].desc, /정부24에서 조회한 토지대장 정보를 주소·지번 기준으로 원본 엑셀 행에 매핑/);
});

test('과거 작업을 AI 협업 프로젝트보다 먼저 배치하고 마지막 안내는 한 문장으로만 표시한다', async () => {
  const page = await readFile(new URL('../../app/about-me/page.tsx', import.meta.url), 'utf8');
  const anchors = ['id="portfolio-overview"', 'aboutDestinations.map', 'id="past-work-archive"', 'id="featured-projects"', '<AgentExperimentGallery />', '상세 이력서를 확인해 보세요'];
  const positions = anchors.map((anchor) => page.indexOf(anchor));
  assert.ok(positions.every((position, index) => position >= 0 && (!index || position > positions[index - 1])));
  assert.match(page, />\s*AI 협업 프로젝트\s*<\/h3>/);
  assert.doesNotMatch(page, />\s*주요 프로젝트\s*<\/h3>/);
  for (const anchor of ['id="past-work-archive"', 'id="featured-projects"']) {
    assert.equal(page.split(anchor).length - 1, 1);
  }
  assert.ok(page.includes('하드웨어의 성능과 한계를 직접 측정하는 취미에서 출발해, 컴퓨팅 시스템 전반의 동작 원리를 탐구해 왔습니다. 소프트웨어 개발에서는 객체지향과 설계 원칙, 디자인 패턴을 실제 문제 해결에 효과적으로 활용하는 방법을 고민해 왔습니다. 지금은 AI 에이전트와 협업하며 개발 과정의 생산성을 높이는 소프트웨어 엔지니어입니다.'));
  assert.ok(page.includes('요구사항과 운영 환경에 맞춰 구조와 기술을 선택하고, AI 에이전트의 구현 결과를 검토·테스트하며 진행한 프로젝트입니다.'));
  assert.doesNotMatch(page, /첫걸음|일목요연하게/);
  assert.match(page, /minmax\(min\(100%, 280px\), 1fr\)/);
  const cta = page.slice(page.indexOf('{/* Bottom CTA'));
  assert.doesNotMatch(cta, /<p\b/);
  assert.match(cta, /href="\/about-me\/resume"/);
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
  const source = await readFile(new URL('./AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.match(source, /<h3 id="agent-experiments-heading">AI 활용 실험<\/h3>/);
  assert.doesNotMatch(source, /<h4>\{active\.title\}<\/h4>|<dl aria-label="사용 모델">/);
  assert.match(source, /<strong>\{item\.title\}<\/strong>/);
  assert.match(source, /aria-label="실험 분류"/);
  assert.match(source, /aria-label="실험 바로 선택"/);
  assert.match(source, /onKeyDown=\{\(event\) => handleKey\(event, itemIndex\)\}/);
  assert.match(source, /<ExperimentAudio title=\{active\.title\} audio=\{active\.audio\}/);
  assert.match(source, /active\.demoUrl && <a href=\{active\.demoUrl\}/);
  assert.match(source, /gallery=\{\{ images, placeholder:/);
  assert.match(source, /hideInlineCaption=\{Boolean\(currentImage && imageWithoutRepeatedCaption\(currentImage, credits\)/);
  const carousel = await readFile(new URL('./ProjectMediaCarousel.tsx', import.meta.url), 'utf8');
  assert.match(carousel, /hideInlineCaption = false/);
  assert.match(carousel, /const inlineCaption = hideInlineCaption \? undefined : currentImage.caption/);
  assert.match(carousel, /<p>\{currentImage.caption \?\? currentImage.alt\}<\/p>/);
});

test('AI 실험 안내는 첫 문장과 요청한 두 문단으로 구성하고 결과물 나열 문장은 제외한다', async () => {
  const source = await readFile(new URL('./AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  const intro = source.match(/id=\{AGENT_EXPERIMENT_INTRO_ANCHOR\}[^>]*>([\s\S]*?)<\/div>/)?.[1];
  assert.ok(intro);
  assert.deepEqual([...intro.matchAll(/<p className=\{styles\.intro\}>(.*?)<\/p>/g)].map((match) => match[1]), [
    'AI 모델이 어떤 작업을 어느 수준까지 수행할 수 있는지 직접 실험하고 있습니다.',
    '개발을 중심으로 경험을 쌓아 온 만큼, 디자인과 시각적 표현은 상대적으로 익숙하지 않은 영역이었습니다. 하지만 AI와 함께 작업하면서 혼자서는 구현하기 어려웠던 아이디어를 구체화하고, 부족했던 부분을 보완할 수 있다는 가능성을 느꼈습니다.',
    '그 가능성을 실제 작업으로 연결하려면 모델이 잘하는 일과 한계를 이해하는 것이 중요하다고 생각합니다. 다양한 과제를 직접 시도하며, 작업과 상황에 따라 어떤 맥락을 어떻게 제공해야 원하는 결과에 가까워지는지 알아가고 있습니다.',
  ]);
});
