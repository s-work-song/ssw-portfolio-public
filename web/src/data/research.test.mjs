import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { aboutDestinations } from './about.ts';
import {
  researchPrimaryTabs,
  researchOptimizationTabs,
  researchPrimaryTabFromTab,
  researchTimelineItems,
} from './research.ts';

test('연구 카드와 주요 탭은 대상과 수행 내용을 설명하는 문구를 사용한다', () => {
  const card = aboutDestinations.find((item) => item.href === '/about-me/research');
  assert.equal(card.desc, 'CPU 오버클럭·RAID 0 구성, SIMD·AVX2·CUDA 기반 성능 최적화, AI 에이전트 오케스트레이션의 실험 과정과 결과를 정리한 기록입니다.');
  assert.deepEqual(researchPrimaryTabs.map((item) => item.label), [
    '연구·실험 이력 (Timeline)', '성능 최적화', '개발 도구 및 AI 활용',
  ]);
});

test('표현 변경 후에도 연구 탭 식별자와 분류 계약을 유지한다', () => {
  assert.deepEqual(researchPrimaryTabs.map((item) => item.id), ['overview', 'optimization', 'meta']);
  assert.deepEqual(researchOptimizationTabs.map((item) => item.id), ['optimization', 'cpu', 'memory', 'serialization']);
  for (const item of researchOptimizationTabs) assert.equal(researchPrimaryTabFromTab(item.id), 'optimization');
  assert.equal(researchPrimaryTabFromTab('overview'), 'overview');
  assert.equal(researchPrimaryTabFromTab('meta'), 'meta');
});

test('연구 이력의 시기와 항목 수를 유지하고 주관적 강조 표현을 제거한다', () => {
  assert.deepEqual(researchTimelineItems.map((item) => item.period), [
    '학창 시절', '학창 시절', '2022년', '2022년', '2022년',
    '2023년', '2023년', '2023년', '2023년', '2024년', '2024년', '2024년',
    '2025년', '2025년', '2025년', '2026–현재', '2026–현재',
  ]);
  assert.equal(researchTimelineItems[0].role, '하드웨어 성능 측정 및 최적화');
  const text = researchTimelineItems.map((item) => `${item.role} ${item.desc}`).join('\n');
  assert.doesNotMatch(text, /한계 돌파|대폭|깊게 탐구|가볍게|전면 도입|극복/);
});

test('연구 본문의 제목과 AI 질문을 맞추고 측정 수치는 유지한다', async () => {
  const panels = await readFile(new URL('../components/research/ResearchPanels.tsx', import.meta.url), 'utf8');
  const page = await readFile(new URL('../app/about-me/research/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(panels, /극대화|완전 차단|월등히|극심함|더 강력한|훨씬 이득|유기적인 협업/);
  assert.doesNotMatch(page, /엔지니어링 여정|상세 실험 보고서/);
  for (const heading of [
    '조건 분기와 SIMD 벡터화 성능 비교',
    'AoS·SoA 메모리 배치와 캐시 활용 비교',
    '생성형 AI 기반 개발 및 검증 실험',
  ]) {
    assert.ok(panels.includes(`「${heading}」`), `AI 질문: ${heading}`);
    assert.ok(panels.includes(`\n                  ${heading}`) || panels.includes(`\n                    ${heading}`), `제목: ${heading}`);
  }
  for (const value of ['5,341 μs', '11 μs', '485배', '461 μs', '587 μs', '27%', '68,502', '1/925', '60MB', '5분 이상', '1분 이내']) {
    assert.ok(panels.includes(value), value);
  }
});
