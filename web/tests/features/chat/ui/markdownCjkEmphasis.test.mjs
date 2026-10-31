import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkCjkFriendly from 'remark-cjk-friendly';

/** 마크다운을 파싱해 굵게 처리된 글자들과 별표가 남은 글자를 돌려준다. */
function emphasis(markdown, plugins = [remarkCjkFriendly]) {
  const processor = unified().use(remarkParse).use(plugins);
  const tree = processor.runSync(processor.parse(markdown));
  const strong = [];
  const literal = [];
  const textOf = (node) => node.value ?? (node.children ?? []).map(textOf).join('');
  const walk = (node) => {
    if (node.type === 'strong') strong.push(textOf(node));
    else if (node.type === 'text' && node.value.includes('**')) literal.push(node.value);
    for (const child of node.children ?? []) walk(child);
  };
  walk(tree);
  return { strong, literal };
}

test('닫는 별표 앞이 문장부호이고 뒤에 한글 조사가 붙어도 굵게 처리한다', () => {
  const answer = '개발자는 Google Colab 환경에서 **LoRA(Low-Rank Adaptation)**를 사용했고, **자료(문서)**에서 찾은 **SI**는 그대로입니다.';
  // 플러그인이 없으면 CommonMark 규칙상 앞의 두 강조가 닫히지 않는다. 고치려는 증상이 실제로 있는지 먼저 확인한다.
  const before = emphasis(answer, []);
  assert.deepEqual(before.strong, ['SI']);
  assert.ok(before.literal.some((text) => text.includes('**LoRA(Low-Rank Adaptation)**')));

  assert.deepEqual(emphasis(answer), {
    strong: ['LoRA(Low-Rank Adaptation)', '자료(문서)', 'SI'],
    literal: [],
  });
});

test('영문·숫자 사이의 별표와 목록 기호는 기존 규칙대로 둔다', () => {
  const { strong } = emphasis('- 2*3*4는 곱셈이고 **Plain bold** stays.\n- 항목');
  assert.deepEqual(strong, ['Plain bold']);
});

test('채팅 답변 렌더러는 CJK 강조 플러그인을 렌더러와 함께 불러와 넘긴다', () => {
  const source = readFileSync(new URL('../../../../src/features/chat/ui/MessageItem.tsx', import.meta.url), 'utf8');
  assert.match(source, /import\("remark-cjk-friendly"\)/u);
  assert.match(source, /markdownPlugins = \[cjkFriendly\.default\];\s*markdownRenderer = module\.default;/u);
  assert.match(source, /<Renderer skipHtml remarkPlugins=\{markdownPlugins\} components=\{MARKDOWN_COMPONENTS\}>/u);
  const pkg = JSON.parse(readFileSync(new URL('../../../../package.json', import.meta.url), 'utf8'));
  // 게시 직후 버전을 피해 검증한 버전으로 고정한다.
  assert.equal(pkg.dependencies['remark-cjk-friendly'], '2.3.2');
});
