import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { chatProviderFixture, providerSlice, readProviderSource, stripTypes } from '../state/chatProviderFixtures.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');

/** 실제 Provider의 open/close/popstate와 실제 요청 수명을 같은 ref로 연결한다. 브라우저·HTTP는 대체한다. */
function panelFixture(t, { mobile = false, animation = 'slide', deferPop = false, ...options } = {}) {
  const f = chatProviderFixture(t, { isOpen: false, ...options });
  const compiled = stripTypes(providerSlice(readProviderSource(), '  const open = useCallback(', '\n  /** 서버 채팅을 닫는다.'));
  const refs = { ...f.refs,
    mobileHistoryEntryRef: { current: false }, cleanupHistoryPopRef: { current: false },
    consumeHistoryOnCloseRef: { current: false }, pendingActionRouteRef: { current: null },
    closeTimerRef: { current: null }, closeAnimationEpochRef: { current: 0 },
  };
  const state = { open: false, closing: false, generation: 0, focus: true, epoch: 0, backCalls: 0, pushed: [], routes: [], timers: [], cleanup: [] };
  const events = new EventTarget();
  const entries = [{ nextRouterState: 'preserved' }];
  let backPending = false;
  const flushPop = () => {
    if (!backPending) return;
    backPending = false;
    if (entries.length > 1) entries.pop();
    f.window.history.state = entries.at(-1);
    events.dispatchEvent(new Event('popstate'));
  };
  Object.assign(f.window, {
    location: { ...f.window.location, href: 'http://fixture.invalid/about-me/research' },
    matchMedia: query => ({ matches: query.includes('prefers-reduced-motion') ? false : mobile }),
    addEventListener: (...args) => events.addEventListener(...args),
    removeEventListener: (...args) => events.removeEventListener(...args),
    requestAnimationFrame: callback => setTimeout(callback, 0),
    setTimeout: (callback, delay) => {
      const id = setTimeout(callback, delay);
      state.timers.push({ id, callback, delay });
      return id;
    },
    history: { state: entries[0], pushState(value) {
      entries.push(value); this.state = value; state.pushed.push(value);
    }, back() {
      state.backCalls++; backPending = true;
      if (!deferPop) setTimeout(flushPop, 0);
    } },
  });
  const context = { ...refs, window: f.window, useCallback: callback => callback,
    useEffect: effect => { state.cleanup.push(effect()); },
    closeAnimationEpoch: 0, setCloseAnimationEpoch: value => { state.epoch = value; },
    setPanelGeneration: update => { state.generation = typeof update === 'function' ? update(state.generation) : update; },
    setIsOpen: value => { state.open = value; }, setIsClosing: value => { state.closing = value; },
    setFocusInputOnOpen: value => { state.focus = value; },
    loadMarkdownRenderer: async () => {}, availability: 'online', refreshAvailability: async () => assert.fail('상태 API 호출 금지'),
    MOBILE_QUERY: '(max-width: 700px)', MOBILE_HISTORY_MARKER: '__portfolioChatOpen', MOBILE_EXIT_DURATION_MS: 260,
    DESKTOP_EXIT_DURATION_MS: { slide: 240, jelly: 620 }, effectiveChatAnimation: animation,
    navigateToActionTarget: (route, routeOptions) => { state.routes.push({ route, options: routeOptions }); },
  };
  const api = new Function(...Object.keys(context), `${compiled}\nreturn { open, close, toggle, completeCloseAnimation };`)(...Object.values(context));
  t.after(() => { for (const cleanup of state.cleanup) cleanup?.(); for (const timer of state.timers) clearTimeout(timer.id); });
  const sends = [];
  const chat = () => ({ availability: 'online', isLoading: f.state.loading, open: api.open,
    sendMessage: (...args) => { sends.push(args); return f.send(...args); },
    beginGuidedTourQuestion: () => false, completeGuidedTourQuestion() {} });
  const buttonSource = readFileSync(new URL('../../../../src/features/chat/ui/AskAiButton.tsx', import.meta.url), 'utf8');
  const loaded = { exports: {} };
  const buttonCode = ts.transpileModule(buttonSource, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  new Function('require', 'module', 'exports', buttonCode)(name => name === '../state/ChatContext'
    ? { useChat: chat } : name.endsWith('.module.css') ? { default: {} } : require(name), loaded, loaded.exports);
  return { ...f, ...api, refs, panel: state, flushPop, sends,
    ask: question => loaded.exports.AskAiButton({ question }).props.onClick(),
    finishAnimation: (epoch = state.epoch) => api.completeCloseAnimation(epoch),
  };
}

test('desktop close 중 두 번째 AskAi는 질문 한 번과 같은 서버 채팅을 유지하며 퇴장 완료 뒤 다시 연다', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = panelFixture(t);
  await f.ask('SIMD 질문');
  const originalGeneration = f.panel.generation;
  const session = f.state.turns[0].session;
  f.close();
  assert.equal(f.panel.generation, originalGeneration, '닫힘 연출 동안 DOM 수명은 유지한다');
  const oldTimer = f.panel.timers.at(-1).callback;
  const oldEpoch = f.panel.epoch;
  await f.ask('Benchmark 질문');
  assert.equal(f.panel.closing, true); assert.ok(f.refs.pendingOpenAfterCloseRef.current);
  assert.equal(f.state.turns.length, 2); assert.equal(f.state.turns[1].message, 'Benchmark 질문');
  assert.deepEqual(f.sends[1], ['Benchmark 질문', undefined, 'explanation']); assert.equal(f.state.turns[1].session, session);
  t.mock.timers.tick(1000);
  assert.equal(f.panel.open, true); assert.equal(f.panel.closing, false); assert.equal(f.panel.focus, false);
  assert.equal(f.panel.generation, originalGeneration + 1, '재열기는 이전 animationend의 DOM과 분리한다');
  assert.equal(f.refs.pendingOpenAfterCloseRef.current, null);
  oldTimer(); f.finishAnimation(oldEpoch);
  assert.equal(f.panel.open, true, '이전 timeout/animationend가 새 패널을 닫지 않는다');
  f.close();
  assert.equal(f.panel.closing, true);
  oldTimer(); f.finishAnimation(oldEpoch);
  assert.equal(f.panel.closing, true, '이전 close는 다음 close 수명을 앞당기지 않는다');
  f.finishAnimation();
  assert.equal(f.panel.open, false); assert.equal(f.state.turns.length, 2);
  assert.equal(f.refs.sessionRef.current, session, '패널을 닫아도 서버 채팅은 닫지 않는다');
  assert.deepEqual(f.state.closed, []); assert.equal(f.state.sessions.length, 1);
});

test('mobile close→AskAi는 popstate cleanup 뒤 marker를 하나만 다시 넣고 같은 서버 채팅을 유지한다', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = panelFixture(t, { mobile: true, deferPop: true });
  await f.ask('SIMD 질문'); const session = f.state.turns[0].session;
  f.close(); await f.ask('Benchmark 질문');
  const oldEpoch = f.panel.epoch;
  f.finishAnimation();
  assert.equal(f.panel.open, false); assert.equal(f.refs.cleanupHistoryPopRef.current, true);
  assert.equal(f.panel.backCalls, 1); assert.equal(f.panel.pushed.length, 1);
  f.flushPop();
  assert.equal(f.panel.open, true); assert.equal(f.panel.closing, false);
  assert.equal(f.refs.cleanupHistoryPopRef.current, false); assert.equal(f.panel.pushed.length, 2);
  assert.equal(f.window.history.state.__portfolioChatOpen, true);
  assert.equal(f.window.history.state.nextRouterState, 'preserved');
  f.finishAnimation(oldEpoch); t.mock.timers.tick(1000);
  assert.equal(f.panel.open, true); assert.equal(f.panel.backCalls, 1);
  assert.equal(f.state.turns.length, 2); assert.equal(f.state.turns[1].session, session);
});

test('mobile animation이 끝나 history.back 대기 중 들어온 AskAi도 popstate 뒤 열린다', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = panelFixture(t, { mobile: true, deferPop: true });
  await f.ask('첫 질문'); f.close(); f.finishAnimation();
  assert.equal(f.refs.cleanupHistoryPopRef.current, true);
  await f.ask('두 번째 질문');
  assert.equal(f.panel.open, false); assert.equal(f.state.turns.length, 2);
  f.flushPop(); assert.equal(f.panel.open, true); assert.equal(f.panel.pushed.length, 2);
});

test('기본 open은 닫힘 중 재열지 않고, 명시 close/reset/unmount는 예약된 AskAi 열기를 취소한다', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const plain = panelFixture(t); plain.open(); plain.close(); plain.open(); plain.finishAnimation();
  assert.equal(plain.panel.open, false);
  for (const cancel of ['close', 'reset', 'unmount']) {
    const f = panelFixture(t); await f.ask('첫 질문'); f.close(); await f.ask('다음 질문');
    if (cancel === 'close') f.close();
    if (cancel === 'reset') f.reset();
    if (cancel === 'unmount') f.refs.mountedRef.current = false;
    const opened = f.panel.open;
    f.finishAnimation(); t.mock.timers.tick(1000);
    assert.equal(f.panel.open, cancel === 'unmount' ? opened : false);
    assert.equal(f.state.turns.length, 2);
    if (cancel !== 'unmount') assert.equal(f.refs.pendingOpenAfterCloseRef.current, null);
    assert.deepEqual(f.state.closed, cancel === 'reset' ? [f.state.sessions[0]] : [], '새 대화만 서버 채팅을 닫는다');
  }
});

test('mobile 실제 뒤로가기는 예약 열기를 취소하며 이후 AskAi가 없으면 패널만 닫는다', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = panelFixture(t, { mobile: true, deferPop: true });
  await f.ask('첫 질문'); f.close(); await f.ask('두 번째 질문');
  f.window.history.back(); f.flushPop(); f.finishAnimation(); t.mock.timers.tick(1000);
  assert.equal(f.panel.open, false); assert.equal(f.refs.pendingOpenAfterCloseRef.current, null);
  assert.equal(f.panel.pushed.length, 1); assert.equal(f.panel.backCalls, 1);
});

test('mobile 예약된 페이지 이동은 history cleanup 뒤 한 번 이어지고 AskAi 전송을 복제하지 않는다', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = panelFixture(t, { mobile: true, deferPop: true });
  await f.ask('첫 질문'); f.close();
  f.refs.pendingActionRouteRef.current = { route: '/about-me/research#research-year-2025', options: { waitForLayout: true } };
  await f.ask('두 번째 질문'); f.finishAnimation(); f.flushPop(); t.mock.timers.tick(0);
  assert.equal(f.panel.routes.length, 1); assert.equal(f.panel.routes[0].route, '/about-me/research#research-year-2025');
  assert.equal(f.panel.open, true); assert.equal(f.state.turns.length, 2);
});

test('닫힘 중 AskAi 요청을 stop하면 재열기 뒤 중단된 실제 답변을 보존하고 질문을 다시 보내지 않는다', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = panelFixture(t, { outcomes: [{}, { wait: true }] });
  await f.ask('SIMD 질문'); const session = f.state.turns[0].session;
  f.close(); const question = f.ask('Benchmark 질문');
  await f.untilRequest(2); f.stop(); f.state.finish(); await question;
  f.finishAnimation(); t.mock.timers.tick(1000);
  assert.equal(f.panel.open, true); assert.equal(f.state.messages.at(-1).generationState, 'stopped');
  assert.equal(f.state.turns.length, 2); assert.equal(f.state.turns[1].session, session);
  assert.equal(f.refs.retryRef.current, null);
});

test('재열기마다 패널 DOM 수명을 바꾸므로 이전 native animationend를 새 패널과 공유하지 않는다', () => {
  const widget = readFileSync(new URL('../../../../src/features/chat/ui/ChatWidget.tsx', import.meta.url), 'utf8');
  assert.match(widget, /<section\s+key=\{panelGeneration\}\s+id="portfolio-chat-dialog"/u);
});
