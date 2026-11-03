import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('../../../../src/app/about-me/cover-letter/page.tsx', import.meta.url), 'utf8');
const layout = await readFile(new URL('../../../../src/app/about-me/layout.tsx', import.meta.url), 'utf8');

test('경력 전환 섹션은 자기소개서의 기존 서사 뒤에 배치하고 레이아웃으로 빼지 않는다', () => {
  const storyIndex = page.indexOf('id="cover-letter-story"');
  const turningPointIndex = page.indexOf('<CareerTurningPointPreview />');
  assert.ok(storyIndex >= 0 && turningPointIndex > storyIndex);
  assert.doesNotMatch(layout, /career-gap|career-turning-point/u);
});

