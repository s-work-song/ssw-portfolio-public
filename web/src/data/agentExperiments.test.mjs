import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { agentExperiments } from './agentExperiments.ts';

const visible = agentExperiments.filter((item) => !item.hidden);

test('공개 실험 다섯 항목에 확인된 제작 모델과 버전을 표시한다', () => {
  assert.deepEqual(Object.fromEntries(visible.map((item) => [
    item.id, item.modelCredits?.flatMap((credit) => credit.models),
  ])), {
    'svg-illustrations': ['GPT-6 Astra'],
    'planet-defense': ['GPT-5.6 Sol', 'GPT Image 2'],
    'aqua-guardian': ['GPT-5.6 Sol', 'GPT Image 2', 'Lyria 3'],
    'project-game-collection-platform': ['Fable 5', 'Opus 4.8', 'GPT-5.6 Sol', 'GPT Image 2'],
    'flight-simulator-experiment': ['Opus 5'],
  });
});

test('Planet Defense에는 배경음악을 넣지 않고 물고기 키우기에만 제작 경로를 표시한다', () => {
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
