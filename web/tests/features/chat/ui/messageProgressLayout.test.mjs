import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(new URL('../../../../src/features/chat/ui/MessageItem.tsx', import.meta.url));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');
const source = readFileSync(new URL('../../../../src/features/chat/ui/MessageItem.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText;
const loaded = { exports: {} };
new Function('require', 'module', 'exports', compiled)(name => {
  if (name === './ChatWidget.module.css') return { __esModule: true,
    default: new Proxy({}, { get: (_, key) => String(key) }) };
  if (name === '../constants') return { CHAT_QUICK_START_OPTION_BY_ACTION_ID: new Map() };
  if (name === '../streaming/StreamingText') return { StreamingText: ({ text }) => text };
  // 표시 정책은 실제 view-model(../view-model/messageViewModel.ts)을 그대로 쓴다. Provider·transport는 올리지 않는다.
  return require(name);
}, loaded, loaded.exports);

const baseProps = {
  activeQuickDestination: null, streamAnimation: 'none', includeComplement: false,
  suggestedQuestions: [], revealCompletionControls: false, slowResponse: false,
  canRetry: false, retryWaitSeconds: 0,
  onActivateAction() {}, onAskSuggestedQuestion() {}, onRetry() {},
};
const chip = { callId: 'theme', tool: 'set_portfolio_theme', label: '다크', status: 'applied' };
const message = (extra = {}) => ({ id: 'answer', role: 'assistant', kind: 'message',
  content: '', generationState: 'streaming', ...extra });
const render = (extra = {}, props = {}) => renderToStaticMarkup(React.createElement(
  loaded.exports.MessageItem, { ...baseProps, ...props, message: message(extra) }));

// Read the rendered parent/child structure, not TSX source ordering or visual classes alone.
function elements(html) {
  const stack = [];
  const nodes = [];
  for (const match of html.matchAll(/<(\/?)([a-z][a-z0-9]*)(\s[^>]*?)?>/giu)) {
    const [, closing, tag, attributes = ''] = match;
    if (closing) {
      const node = stack.pop();
      assert.equal(node?.tag, tag);
      node.end = match.index + match[0].length;
    } else {
      const node = { tag, attributes, start: match.index, parent: stack.at(-1) };
      nodes.push(node);
      if (!['br', 'hr', 'img', 'input', 'link', 'meta', 'wbr'].includes(tag)) stack.push(node);
    }
  }
  assert.equal(stack.length, 0);
  return nodes;
}

function assertExternalStatus(html, expectedBubble) {
  const nodes = elements(html);
  const article = nodes.find(node => node.tag === 'article');
  const statuses = nodes.filter(node => node.attributes.includes('role="status"'));
  assert.equal(statuses.length, 1, '활성 상태 알림은 한 번만 표시한다');
  assert.equal((html.match(/aria-live="polite"/gu) ?? []).length, 1);
  assert.equal(statuses[0].parent, article, '상태는 시각적 말풍선이 아닌 행의 직접 자식이다');
  const bubble = nodes.find(node => node.attributes.includes('data-chat-message-bubble="true"'));
  assert.equal(Boolean(bubble), expectedBubble);
  if (bubble) {
    assert.equal(bubble.parent, article);
    assert.ok(bubble.end <= statuses[0].start, '본문·도구·컨트롤 말풍선 다음에 상태를 둔다');
  }
  return { nodes, article, bubble };
}

test('첫 delta 전 생성은 빈 말풍선 없이 서버 진행 단계만 행의 상태로 표시한다', () => {
  for (const [extra, props, label] of [
    [{}, {}, '응답 생성 중'],
    [{ statusStage: 'answering' }, {}, '응답 생성 중'],
    [{ statusStage: 'searching' }, {}, '자료 찾는 중'],
    [{ statusStage: 'working' }, {}, '화면 조작 중'],
    [{ statusStage: 'searching' }, { slowResponse: true }, '평소보다 오래 걸리고 있어요'],
  ]) {
    const html = render(extra, props);
    assertExternalStatus(html, false);
    assert.ok(html.includes(label));
    assert.doesNotMatch(html, /messageText|answerSegments|markdownMessage/u);
    if (extra.statusStage) assert.match(html, new RegExp(`data-status-stage="${extra.statusStage}"`, 'u'));
  }
});

test('스트리밍 본문·도구 칩은 말풍선 안, 활성 안내는 항상 그 밖이다', () => {
  for (const extra of [
    { content: '첫 응답 조각' },
    { content: '둘째 응답 조각이 더해져 말풍선이 자랍니다.' },
    { toolResults: [chip] },
    { statusStage: 'working', toolResults: [chip, { ...chip, callId: 'nav', label: '연구 2025', status: 'started' }] },
    { statusStage: 'answering', content: '결과를 정리합니다.', toolResults: [chip] },
  ]) {
    const html = render(extra);
    const { nodes, bubble } = assertExternalStatus(html, true);
    for (const node of nodes.filter(node => /class="(?:modelProgress|toolResults|messageText)/u.test(node.attributes))) {
      assert.equal(node.parent, bubble, '사용자에게 남는 본문과 실행 결과는 말풍선 안에 둔다');
    }
    if (extra.content) assert.ok(html.includes(extra.content));
    if (extra.toolResults) assert.ok(html.includes('data-tool-status="applied"'));
    if (extra.toolResults?.length > 1) assert.ok(html.includes('data-tool-status="started">도구 호출 중… · 연구 2025'));
  }
});

test('완료·실패·중단·사용자는 활성 안내 없이 실제 본문과 상태/재시도 컨트롤을 유지한다', () => {
  for (const generationState of ['complete', 'failed', 'stopped']) {
    const html = render({ generationState, content: '보존할 실제 답변', toolResults: [chip] }, { canRetry: true });
    const nodes = elements(html);
    const article = nodes.find(node => node.tag === 'article');
    const bubble = nodes.find(node => node.attributes.includes('data-chat-message-bubble="true"'));
    assert.equal(bubble.parent, article);
    assert.ok(html.includes('보존할 실제 답변'));
    assert.ok(html.includes('data-tool-status="applied"'));
    assert.doesNotMatch(html, /generationBadge|generationDots|role="status"/u);
    if (generationState === 'failed') {
      assert.match(html, /role="alert"/u);
      assert.match(html, /다시 시도/u);
      assert.equal(nodes.find(node => node.tag === 'button').parent.parent, bubble);
    }
    if (generationState === 'stopped') assert.match(html, /응답 생성이 중단되었습니다/u);
  }
  const user = render({ role: 'user', generationState: undefined, content: '사용자 질문' });
  assert.match(user, /class="messageRow userMessageRow"/u);
  assert.match(user, /class="message userMessage"/u);
  assert.doesNotMatch(user, /generationBadge|generationDots/u);
});

test('행은 좌/우 정렬과 기존 최대 폭을 유지하고 모션 정책·점 애니메이션은 바꾸지 않는다', () => {
  const css = readFileSync(new URL('../../../../src/features/chat/ui/ChatWidget.module.css', import.meta.url), 'utf8');
  assert.match(css, /\.messageRow\s*\{[^}]*flex-direction: column;[^}]*max-width: 91%;[^}]*min-width: 0;/u);
  assert.match(css, /\.assistantMessageRow\s*\{\s*align-self: flex-start;/u);
  assert.match(css, /\.userMessageRow\s*\{\s*align-self: flex-end;/u);
  assert.match(css, /\.messageRow > \.message\s*\{[^}]*max-width: 100%;[^}]*min-width: 0;/u);
  assert.match(css, /\.message,\s*\.messageRow\s*\{\s*max-width: 94%;/u);
  assert.match(css, /\.generationBadge\s*\{[^}]*max-width: 100%;[^}]*margin: 0;[^}]*padding: 0;/u);
  assert.match(css, /\.generationDots span\s*\{[^}]*animation: generationDot 1\.2s ease-in-out infinite;/u);
  assert.match(css, /\.generationDots span:nth-child\(2\)\s*\{\s*animation-delay: 160ms;/u);
  assert.match(css, /\.generationDots span:nth-child\(3\)\s*\{\s*animation-delay: 320ms;/u);
  assert.match(css, /@keyframes generationDot\s*\{\s*0%, 60%, 100% \{ opacity: 0\.35; transform: translateY\(0\); \}\s*30% \{ opacity: 1; transform: translateY\(-3px\); \}/u);
  assert.match(css, /:global\(:root\[data-motion="off"\]\) \.generationDots span\s*\{\s*animation: none;/u);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*:global\(:root:not\(\[data-motion="on"\]\)\) \.generationDots span\s*\{\s*animation: none;/u);
});
