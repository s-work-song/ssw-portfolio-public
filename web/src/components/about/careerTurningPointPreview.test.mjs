import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(new URL('./CareerTurningPointPreview.tsx', import.meta.url), 'utf8');
const stylesheet = await readFile(new URL('./CareerTurningPointPreview.module.css', import.meta.url), 'utf8');
const page = await readFile(new URL('../../app/about-me/cover-letter/page.tsx', import.meta.url), 'utf8');
const layout = await readFile(new URL('../../app/about-me/layout.tsx', import.meta.url), 'utf8');

test('경력 전환 섹션은 자기소개서의 기존 서사와 가치관 사이에 배치한다', () => {
  const storyIndex = page.indexOf('id="cover-letter-story"');
  const turningPointIndex = page.indexOf('<CareerTurningPointPreview />');
  const valuesIndex = page.indexOf('Core Values');
  assert.ok(storyIndex >= 0 && turningPointIndex > storyIndex && valuesIndex > turningPointIndex);
  assert.doesNotMatch(layout, /career-gap|career-turning-point/u);
});

test('메이커 문단은 단순 구현을 넘어선 관점으로 시작하고 기존 설명을 유지한다', () => {
  const paragraph = page.match(/<h3\b[^>]*>스스로 문제를 정의하는 메이커<\/h3>\s*<p\b[^>]*>([\s\S]*?)<\/p>/u)?.[1].trim();
  assert.equal(paragraph, '단순히 구현하는 것을 넘어, 데이터의 직렬화 포맷을 비교 분석하고 자체적인 코드 제너레이터(Scaffold)를 구축하는 등, 생산성과 성능이라는 두 마리 토끼를 잡기 위해 끊임없이 고민하고 있습니다. 저는 주어지는 문제를 수동적으로 푸는 사람이 아니라, 스스로 문제를 정의하고 본질부터 파고듭니다.');
});

test('승인한 구직 사유를 세 가지 주제로 표시하고 초안 표시는 공개하지 않는다', () => {
  assert.match(component, /직장생활을 멈춘 이유/u);
  assert.match(component, /그 시간을 지나며 정리한 생각/u);
  assert.match(component, /다시 직장생활을 시작하려는 이유/u);
  assert.match(component, /직접 학습하고 실험하는 시간을 선택했습니다/u);
  assert.match(component, /GPT 챗봇을 처음 사용해 보고/u);
  assert.doesNotMatch(component, /챗봇을 직접 시험해 보면서/u);
  assert.match(component, /대규모 언어 모델\(LLM\)을 활용한 코드 제안 기능/u);
  assert.match(component, /LLM 코드 제안 기능의 개선을 기다리던 중/u);
  assert.doesNotMatch(component, /자동 완성/u);
  assert.match(component, /이후 직접 사용해 보면서/u);
  assert.match(component, /경력을 다시 이어 갈 시점/u);
  assert.match(component, /회사에서 승인한 AI 도구/u);
  assert.doesNotMatch(component, />초안<|draftBadge/u);
  assert.match(component, /aria-hidden="true"/u);
  assert.doesNotMatch(component, /Fable|Grok|GPT 5|미국 정부|100 달러|10~15|번아웃/u);
});

test('게임 개발과 개인적인 학습을 구분하고 AI 도구 경험을 네 문단으로 나눈다', () => {
  assert.match(component, /웹 개발 경력 이후 게임 개발을 시작하면서, 바로 재취업하기보다 개인적으로 해보고 싶었던/u);
  assert.doesNotMatch(component, /개인 게임 개발/u);
  const chapterCopy = component.match(/step: '02',[\s\S]*?paragraphs:\s*\[([\s\S]*?)\]/u)?.[1];
  assert.ok(chapterCopy);
  const paragraphs = [...chapterCopy.matchAll(/'([^']+)'/gu)].map((match) => match[1]);
  assert.deepEqual(paragraphs, [
    'GPT 챗봇을 처음 사용해 보고, 궁금한 것을 알아보고 독학하는 데 유용하겠다고 느꼈습니다.',
    '이후 IDE에서 대규모 언어 모델(LLM)을 활용한 코드 제안 기능을 접하며, 개발 도구가 충분히 유용해질 때까지 학습과 실험을 이어가고자 했습니다.',
    'LLM 코드 제안 기능의 개선을 기다리던 중, AI 에이전트가 코드를 수정하고 작업을 진행하는 에이전틱 코딩을 접했습니다.',
    '처음에는 위험성과 한계 때문에 거리를 두었지만, 이후 직접 사용해 보면서 실제 작업에 활용할 수 있다는 가능성을 느꼈습니다.',
  ]);
});

test('경력 전환 카드는 모바일에서 한 열로 바뀌고 기존 테마 토큰을 따른다', () => {
  assert.match(stylesheet, /repeat\(3, minmax\(0, 1fr\)\)/u);
  assert.match(stylesheet, /@media \(max-width: 760px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/u);
  assert.match(stylesheet, /background: var\(--bg-elev\)/u);
  assert.match(stylesheet, /focus-visible/u);
});
