import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../../../../src/features/chat/ui/ChatWidget.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('ChatWidget.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

/** 실제 Widget effect와 의존성 배열을 실행한다. 같은 open 상태에서 DOM key만 교체되는 commit을 모의한다. */
function effectRunner(marker) {
  let selected;
  function visit(node) {
    if (ts.isCallExpression(node) && ['useEffect', 'useLayoutEffect'].includes(node.expression.getText(ast))
      && node.arguments[0]?.getText(ast).includes(marker)) selected = node;
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(selected, marker);
  const code = ts.transpileModule(selected.getText(ast), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText;
  let previous; let cleanup;
  const run = (effect, deps) => {
    if (previous && deps.every((value, index) => Object.is(value, previous[index]))) return;
    cleanup?.(); previous = deps; cleanup = effect();
  };
  return {
    render(context) { new Function('useEffect', 'useLayoutEffect', ...Object.keys(context), code)(run, run, ...Object.values(context)); },
    unmount() { cleanup?.(); cleanup = undefined; },
  };
}

/** 실제 Widget의 useCallback 본문을 꺼내 주어진 값으로 묶는다. */
function callbackOf(marker, context) {
  let selected;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useCallback'
      && node.arguments[0]?.getText(ast).includes(marker)) selected = node;
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(selected, marker);
  const code = ts.transpileModule(`const selected = ${selected.arguments[0].getText(ast)};`, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText;
  return new Function(...Object.keys(context), `${code}\nreturn selected;`)(...Object.values(context));
}

function environment() {
  let sequence = 0;
  const frames = new Map(); const timers = new Map(); const listeners = new Map();
  return { frames, timers,
    window: { requestAnimationFrame(callback) { frames.set(++sequence, callback); return sequence; },
      cancelAnimationFrame(id) { frames.delete(id); }, setTimeout(callback) { timers.set(++sequence, callback); return sequence; },
      clearTimeout(id) { timers.delete(id); }, performance: { now: () => 0 }, matchMedia: () => ({ matches: false }),
      addEventListener(name, callback) { listeners.set(name, callback); },
      removeEventListener(name, callback) { if (listeners.get(name) === callback) listeners.delete(name); },
    },
    flushFrames(now = 500) { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now)); },
    emit(name) { listeners.get(name)?.(); },
  };
}
const panel = () => ({ style: { removeProperty() {} }, offsetHeight: 100 });
const settle = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };

test('batched close→reopen에서 isOpen=true가 유지돼도 jelly engine은 이전 DOM을 destroy하고 새 DOM에만 연결한다', async () => {
  const env = environment(); const engines = [];
  class Engine {
    constructor(trigger, target) { this.panel = target; this.trigger = trigger; this.destroyed = false; engines.push(this); }
    open() { this.opened = true; } destroy() { this.destroyed = true; }
  }
  const context = { window: env.window, isDocked: false, isJelly: true, isOpen: true, panelGeneration: 1,
    wasDockedRef: { current: false }, panelRef: { current: panel() }, triggerRef: { current: panel() },
    externalTourChatButtonRef: { current: null }, jellyRef: { current: null },
    setJellySurfaceReady() {}, setJellyUnavailable() { assert.fail('새 엔진 실패 없음'); },
    require: () => ({ default: Engine }),
  };
  const runner = effectRunner('engine = new JellyPanel');
  runner.render(context); await settle();
  const old = engines[0]; assert.equal(old.opened, true);
  const nextPanel = panel(); context.panelRef.current = nextPanel; context.panelGeneration++;
  runner.render(context); await settle();
  assert.equal(engines.length, 2); assert.equal(old.destroyed, true);
  assert.equal(engines[1].panel, nextPanel); assert.equal(context.jellyRef.current, engines[1]);
  assert.equal(engines[1].opened, true);
  runner.unmount(); assert.equal(engines[1].destroyed, true); assert.equal(context.jellyRef.current, null);
});

test('교체 전 jelly lazy import가 늦게 완료돼도 이전 DOM 엔진을 생성하지 않는다', async () => {
  const env = environment(); const targets = []; let release;
  const oldLoad = new Promise(resolve => { release = resolve; }); let loads = 0;
  class Engine { constructor(_trigger, target) { targets.push(target); } open() {} destroy() {} }
  const context = { window: env.window, isDocked: false, isJelly: true, isOpen: true, panelGeneration: 1,
    wasDockedRef: { current: false }, panelRef: { current: panel() }, triggerRef: { current: panel() },
    externalTourChatButtonRef: { current: null }, jellyRef: { current: null }, setJellySurfaceReady() {}, setJellyUnavailable() {},
    require: () => ++loads === 1 ? oldLoad : { default: Engine },
  };
  const runner = effectRunner('engine = new JellyPanel'); runner.render(context); await settle();
  const nextPanel = panel(); context.panelRef.current = nextPanel; context.panelGeneration++;
  runner.render(context); await settle(); release({ default: Engine }); await settle();
  assert.deepEqual(targets, [nextPanel]); runner.unmount();
});

test('새 목록 DOM은 열림 여부가 같아도 바닥 고정을 초기화하고 같은 DOM의 사용자 스크롤 의도는 유지한다', () => {
  const calls = []; const nextList = {};
  const context = { isOpen: true, error: null, isLoading: false, messages: [], lastMessageLength: 0, panelGeneration: 1,
    wasOpenForScrollRef: { current: true }, scrollPanelGenerationRef: { current: 1 }, isBottomPinnedRef: { current: false },
    userMessageCount: 0, userMessageCountRef: { current: 0 }, lastListScrollTopRef: { current: 0 }, messageListRef: { current: null },
    schedulePinnedScroll: () => calls.push(nextList),
  };
  const runner = effectRunner('const justOpened ='); runner.render(context); assert.equal(calls.length, 0);
  context.panelGeneration++; runner.render(context);
  assert.equal(context.isBottomPinnedRef.current, true); assert.deepEqual(calls, [nextList]);
  context.isBottomPinnedRef.current = false; context.lastMessageLength++;
  runner.render(context); assert.equal(context.isBottomPinnedRef.current, false); assert.equal(calls.length, 1);
  context.userMessageCount++; context.messages = [{}]; runner.render(context);
  assert.equal(context.isBottomPinnedRef.current, true, '새 질문을 보내면 다시 바닥에 붙는다'); assert.equal(calls.length, 2);
});

test('목록을 위로 움직이면 문턱 안쪽이어도 바닥 고정을 풀고, 내용이 줄어 깎인 scrollTop은 풀지 않는다', () => {
  let cancels = 0; const list = { scrollHeight: 1000, clientHeight: 100, scrollTop: 900 };
  const context = { messageListRef: { current: list }, lastListScrollTopRef: { current: 0 }, isBottomPinnedRef: { current: true },
    preservePinUntilRef: { current: 0 }, cancelPinnedScroll: () => cancels++, BOTTOM_PIN_THRESHOLD_PX: 64 };
  const onScroll = callbackOf('const movedUp =', context);
  onScroll(); assert.equal(context.isBottomPinnedRef.current, true);
  list.scrollTop = 880; onScroll(); assert.equal(context.isBottomPinnedRef.current, false); assert.equal(cancels, 1);
  list.scrollTop = 890; onScroll(); assert.equal(context.isBottomPinnedRef.current, true, '바닥 근처로 내려오면 다시 고정');
  list.scrollHeight = 950; list.scrollTop = 850; onScroll(); assert.equal(context.isBottomPinnedRef.current, true);
});

test('휠을 위로 굴리거나 손가락을 아래로 끌면 scroll 이벤트 전에 고정을 풀고, 맨 위에서는 풀지 않는다', () => {
  const list = { scrollTop: 0 }; let intents = 0;
  const context = { messageListRef: { current: list }, isBottomPinnedRef: { current: true }, handleUserScrollIntent: () => intents++ };
  const release = callbackOf('list.scrollTop > 0', context);
  release(); assert.equal(context.isBottomPinnedRef.current, true); assert.equal(intents, 1);
  list.scrollTop = 300; release(); assert.equal(context.isBottomPinnedRef.current, false);

  const seen = [];
  const wheel = callbackOf('event.ctrlKey', { releasePinForUpwardScroll: () => seen.push('up'), handleUserScrollIntent: () => seen.push('intent') });
  wheel({ deltaY: -40, ctrlKey: false }); wheel({ deltaY: 40, ctrlKey: false }); wheel({ deltaY: -40, ctrlKey: true });
  assert.deepEqual(seen, ['up', 'intent', 'intent']);

  let releases = 0;
  const touchMove = callbackOf('TOUCH_SCROLL_UP_SLOP_PX', { touchStartYRef: { current: 100 }, TOUCH_SCROLL_UP_SLOP_PX: 6,
    releasePinForUpwardScroll: () => releases++ });
  touchMove({ touches: [{ clientY: 104 }] }); touchMove({ touches: [{ clientY: 60 }] }); assert.equal(releases, 0);
  touchMove({ touches: [{ clientY: 130 }] }); assert.equal(releases, 1);
});

test('외부투어 스크롤은 이전 목록을 붙잡은 frame/timer를 취소하고 새 목록만 조정한다', () => {
  const env = environment(); const old = { scrollHeight: 600, clientHeight: 100, scrollTop: 0 };
  const context = { window: env.window, guidedTourExternal: true, isOpen: true, isClosing: false, motion: 'on', panelGeneration: 1,
    messageListRef: { current: old }, isBottomPinnedRef: { current: false }, preservePinUntilRef: { current: 0 },
    TOUR_LAYOUT_TRANSITION_MS: 300,
  };
  const runner = effectRunner('const followShrinkingPanel ='); runner.render(context);
  const oldFrame = [...env.frames.keys()][0]; const oldTimer = [...env.timers.keys()][0];
  const next = { scrollHeight: 800, clientHeight: 100, scrollTop: 0 };
  context.messageListRef.current = next; context.panelGeneration++;
  runner.render(context); assert.equal(env.frames.has(oldFrame), false); assert.equal(env.timers.has(oldTimer), false);
  env.flushFrames(); assert.equal(old.scrollTop, 0); assert.equal(next.scrollTop, 700);
  runner.unmount(); assert.equal(env.frames.size, 0); assert.equal(env.timers.size, 0);
});

test('열기 포커스 frame은 DOM 세대 교체 시 정리되고 모바일 focusInput=false 정책을 유지한다', () => {
  const env = environment(); let oldFocus = 0; let newFocus = 0;
  const context = { window: env.window, availability: 'online', focusInputOnOpen: false,
    isOpen: true, isClosing: false, isMobile: false, panelGeneration: 1, wasOpenRef: { current: true },
    inputRef: { current: { focus: () => oldFocus++ } }, triggerRef: { current: { focus() {} } },
  };
  const runner = effectRunner('wasOpenRef.current = isOpen'); runner.render(context);
  const oldFrame = [...env.frames.keys()][0]; context.inputRef.current = { focus: () => newFocus++ }; context.panelGeneration++;
  runner.render(context); assert.equal(env.frames.has(oldFrame), false); assert.equal(env.frames.size, 1);
  env.flushFrames(); assert.equal(oldFocus, 0); assert.equal(newFocus, 1);
  context.isMobile = true; context.panelGeneration++; runner.render(context);
  assert.equal(env.frames.size, 0); runner.unmount();
});

test('이전 패널의 응답완료 포커스 기록·frame은 새 패널에 전달하지 않고 새 응답의 정상 복원은 유지한다', () => {
  const env = environment(); class FakeNode {}
  let focused = 0; const active = new FakeNode(); const body = new FakeNode();
  const context = { window: env.window, Node: FakeNode, document: { activeElement: active, body, documentElement: new FakeNode() },
    availability: 'online', isOpen: true, isClosing: false, isLoading: false, panelGeneration: 1,
    panelRef: { current: { contains: element => element === active } }, inputRef: { current: { focus: () => focused++ } },
    wasLoadingRef: { current: true }, focusPanelGenerationRef: { current: 1 }, focusWasInsidePanelDuringLoadingRef: { current: true },
  };
  const runner = effectRunner('const wasLoading = wasLoadingRef.current'); runner.render(context);
  assert.equal(env.frames.size, 1); context.panelRef.current = { contains: element => element === active }; context.panelGeneration++;
  context.document.activeElement = body; runner.render(context); env.flushFrames();
  assert.equal(focused, 0); assert.equal(context.focusWasInsidePanelDuringLoadingRef.current, false);
  context.isLoading = true; context.document.activeElement = active; runner.render(context);
  context.isLoading = false; runner.render(context); env.flushFrames();
  assert.equal(focused, 1); runner.unmount();
});

test('도구 복원 신호의 이전 focus frame도 DOM 교체 시 취소하고 새 신호만 새 입력창에 적용한다', () => {
  const env = environment(); let focused = 0;
  const context = { window: env.window, availability: 'online', isOpen: true, isClosing: false, panelGeneration: 1,
    inputRef: { current: { focus: () => focused++ } }, CHAT_ACTION_RESTORE_CHAT_INPUT_EVENT: 'restore-input',
  };
  const runner = effectRunner('const restoreChatInputFocus ='); runner.render(context); env.emit('restore-input');
  assert.equal(env.frames.size, 1); context.panelGeneration++; runner.render(context); env.flushFrames();
  assert.equal(focused, 0); env.emit('restore-input'); env.flushFrames(); assert.equal(focused, 1); runner.unmount();
});

test('ResizeObserver는 교체되지 않는 외부 guide DOM만 관측하므로 패널 세대만으로 불필요하게 재연결하지 않는다', () => {
  const env = environment(); const observers = []; const guide = {};
  class Observer { constructor() { observers.push(this); } observe(target) { this.target = target; } disconnect() { this.closed = true; } }
  const context = { window: env.window, ResizeObserver: Observer, guidedTourExternal: true, panelGeneration: 1,
    rootRef: { current: { style: { setProperty() {}, removeProperty() {} } } }, externalTourRef: { current: guide },
  };
  const runner = effectRunner('observer.observe(guide)'); runner.render(context); context.panelGeneration++; runner.render(context);
  assert.equal(observers.length, 1); assert.equal(observers[0].target, guide); assert.equal(observers[0].closed, undefined);
  runner.unmount(); assert.equal(observers[0].closed, true);
});
