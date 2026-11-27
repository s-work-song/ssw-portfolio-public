import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { chatProviderFixture } from '../state/chatProviderFixtures.mjs';
import { ChatApiError, RATE_LIMITED_MESSAGE } from '../../../../src/features/chat/transport/sse.ts';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');

/** 실제 AskAi component를 렌더한다. 컨텍스트만 실제 Provider fixture의 현재 상태로 연결한다. */
function buttonFixture(context) {
  const source = readFileSync(new URL('../../../../src/features/chat/ui/AskAiButton.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => name === '../state/ChatContext'
    ? { useChat: context } : name.endsWith('.module.css') ? { default: {} } : require(name), loaded, loaded.exports);
  const props = { question: 'Hardware 최적화 연구를 설명해 줘', guidedTourTarget: 'research-cpu-question' };
  return {
    element: () => loaded.exports.AskAiButton(props),
    html: () => renderToStaticMarkup(React.createElement(loaded.exports.AskAiButton, props)),
    // native disabled button은 클릭 handler를 발생시키지 않는다.
    async click() { const element = this.element(); if (!element.props.disabled) await element.props.onClick(); },
  };
}

test('실제 AskAi 렌더는 Provider cooldown 중 클릭을 막고 만료 후 같은 채팅에 새 설명 질문을 한 번만 보낸다', async t => {
  const f = chatProviderFixture(t, { outcomes: [
    { error: new ChatApiError(RATE_LIMITED_MESSAGE, { code: 'rate_limited', httpStatus: 429, retryAfterMs: 65_000, retryable: true }) },
  ] });
  const sends = [];
  let opens = 0; let begins = 0; let completes = 0;
  const button = buttonFixture(() => ({ availability: 'online', isLoading: f.state.loading,
    retryWaitSeconds: f.state.retryWaitSeconds, open: () => { opens++; },
    sendMessage: (...args) => { sends.push(args); return f.send(...args); },
    beginGuidedTourQuestion: () => { begins++; return true; }, completeGuidedTourQuestion: () => { completes++; },
  }));
  await f.send('첫 번째 연구 질문');
  assert.equal(f.state.loading, false); assert.equal(f.state.turns.length, 1);
  assert.equal(f.state.retryWaitSeconds, 65); assert.equal(button.element().props.disabled, true);
  assert.match(button.html(), /disabled=""/u); assert.match(button.html(), /65초 후 질문할 수 있어요/u);
  await button.click();
  assert.equal(f.state.turns.length, 1); assert.equal(opens, 0); assert.equal(begins, 0); assert.equal(completes, 0);
  f.advanceTime(64_999);
  assert.equal(f.state.retryWaitSeconds, 1); assert.equal(button.element().props.disabled, true);
  await button.click(); assert.equal(f.state.turns.length, 1);
  f.advanceTime(1);
  assert.equal(f.state.retryWaitSeconds, 0); assert.equal(button.element().props.disabled, false);
  assert.equal(button.element().props.title, undefined); assert.doesNotMatch(button.html(), /disabled=""/u);
  assert.equal(f.state.turns.length, 1, 'deadline 만료만으로 자동 재전송하지 않는다');
  await button.click();
  assert.equal(f.state.turns.length, 2); assert.equal(opens, 1); assert.equal(begins, 1); assert.equal(completes, 1);
  assert.equal(f.state.turns[1].message, 'Hardware 최적화 연구를 설명해 줘');
  assert.deepEqual(sends, [['Hardware 최적화 연구를 설명해 줘', undefined, 'explanation']]);
  assert.equal(f.state.sessions.length, 1, '대기 뒤 질문도 같은 서버 채팅으로 이어 간다');
  assert.equal(f.state.turns[1].session, f.state.turns[0].session);
  assert.equal(f.state.messages.at(-1).generationState, 'complete');
  f.advanceTime(600_000); assert.equal(f.state.turns.length, 2);
});
