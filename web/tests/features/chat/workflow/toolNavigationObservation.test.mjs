import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { navigationPathMatches, observeToolNavigation } from '../../../../src/features/chat/workflow/toolNavigationObservation.ts';
import * as navigationContract from '../../../../src/features/chat/navigation.ts';
import { isPortfolioTargetAligned, isPortfolioTargetReady } from '../../../../src/features/portfolio-tools/viewTargetVisibility.ts';
import { createTargetLayoutStabilityCheck, resolvePortfolioNavigationTarget } from '../../../../src/features/portfolio-tools/experimentNavigation.ts';
import { AGENT_EXPERIMENT_VIEW_TARGETS, agentExperimentViewTargetForAnchor } from '../../../../src/features/experiments/data/agentExperimentViewTargets.ts';
import { experimentDomFixture, installGallerySelectionEffect } from '../../portfolio-tools/experimentNavigationFixtures.mjs';
import { readPortfolioViewState, resolvePortfolioViewTarget } from '../../../../src/features/webmcp/portfolioView.ts';
import { workflowStageFromHash } from '../../../../src/features/ai-workflow/navigation/workflowStageNavigation.ts';
import { chatProviderFixture } from '../state/chatProviderFixtures.mjs';

test('실제 Provider 새 질문은 낡은 hook 대신 요청 순간의 실제 경로로 화면 상태를 만든다', async t => {
  const currentPath = '/ssw-portfolio-public/about-me/research/';
  const currentView = { page: 'research', anchor: 'research-year-2026', researchTab: 'timeline',
    researchYear: '2026', researchDetails: { expanded: 0, total: 16, expandedYears: [] } };
  const f = chatProviderFixture(t, { pathname: currentPath });
  f.state.viewState = structuredClone(currentView);
  await f.send('여기 상세 펴');
  assert.equal(f.state.turns.length, 1);
  assert.equal(f.state.turns[0].message, '여기 상세 펴', '사용자 원문을 바꾸지 않는다');
  assert.deepEqual(f.state.turns[0].body.clientState.viewState, currentView);
  assert.equal(f.state.turns[0].body.clientState.uiSettings.theme, 'light');
  assert.deepEqual(f.state.viewReads, [currentPath]);
  assert.deepEqual(f.state.effects, []);
});

test('실제 Provider 이동 도구는 도착을 관측한 뒤 이동 후의 경로로 화면 상태를 다시 읽어 결과를 보낸다', async t => {
  const observed = [];
  const f = chatProviderFixture(t, {
    outcomes: [{ calls: [{ callId: 'nav-1', name: 'control_portfolio_view', arguments: { action: 'research-2025' } }] },
      { answer: '연구 2025로 이동했어요.' }],
    observeToolNavigation: options => {
      observed.push({ route: options.route, minimumDelayMs: options.minimumDelayMs, timeoutMs: options.timeoutMs });
      return { completion: Promise.resolve('arrived'), cancel() {} };
    },
    executeUiTool: (command, state) => {
      f.window.location.pathname = '/about-me/research';
      state.viewState = { ...state.viewState, page: 'research', anchor: 'research-year-2025' };
      return { ok: true, route: '/about-me/research#research-year-2025', label: '연구 여정 2025년' };
    },
  });
  await f.send('연구 2025로 가 줘');
  assert.deepEqual(observed, [{ route: '/about-me/research#research-year-2025', minimumDelayMs: 500, timeoutMs: 8_000 }]);
  assert.deepEqual(f.state.viewReads, ['/about-me', '/about-me', '/about-me/research'],
    '질문 시점·이동 전(previous)·결과 전송 시점의 실제 경로를 각각 읽는다');
  const [, results] = f.state.requests;
  assert.equal(results.kind, 'tool-results');
  assert.deepEqual(results.body.results, [{ callId: 'nav-1', ok: true, output: {
    action: 'research-2025', route: '/about-me/research#research-year-2025', label: '연구 여정 2025년',
    arrived: true, previous: { page: 'overview', anchor: null } } }]);
  assert.equal(results.body.clientState.viewState.anchor, 'research-year-2025');
  assert.equal(f.refs.pendingChatNavigationFocusRef.current, true, '앵커 이동 뒤 입력창 포커스 복원을 예약한다');
  assert.equal(f.refs.toolResultWatchersRef.current.size, 0, '끝난 도착 감시는 정리한다');
  const answer = f.state.messages.at(-1);
  assert.equal(answer.generationState, 'complete');
  assert.deepEqual(answer.toolResults.map(item => [item.callId, item.status, item.label]),
    [['nav-1', 'arrived', '연구 여정 2025년']]);
});

function fixture(overrides = {}) {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  const listeners = new Set();
  const controller = new AbortController();
  const state = { pathname: '/about-me', targetReady: false };
  const options = {
    route: '/settings', basePath: '', startedAt: 0, minimumDelayMs: 500,
    timeoutMs: 8000, signal: controller.signal, read: () => state, now: () => now,
    subscribe(callback) { listeners.add(callback); return () => listeners.delete(callback); },
    schedule(callback, delay) {
      const id = ++nextId;
      timers.set(id, { callback, at: now + delay });
      return () => timers.delete(id);
    },
    ...overrides,
  };
  const observation = observeToolNavigation(options);
  let completed;
  observation.completion.then(value => { completed = value; }, () => {});
  return {
    ...observation, state, controller, timers, listeners,
    get completed() { return completed; },
    async tick(until) {
      for (;;) {
        const first = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!first || first[1].at > until) break;
        now = first[1].at;
        timers.delete(first[0]);
        first[1].callback();
      }
      now = until;
      await Promise.resolve();
    },
    arrive(anchor) { for (const callback of listeners) callback(anchor); },
    jump(until) { now = until; const first = timers.values().next().value; first?.callback(); },
  };
}

test('650ms 설정 도착 재현: 옛 500ms 단발 판정은 실패하지만 실제 도착까지 기다린다', async () => {
  const f = fixture();
  await f.tick(500);
  // 이전 구현은 이 시점에 failed를 고정했다. 모바일 닫기 fallback도 560ms다.
  assert.equal(navigationPathMatches('/settings', f.state.pathname), false);
  assert.equal(f.completed, undefined);
  await f.tick(649);
  Object.assign(f.state, { pathname: '/settings', targetReady: true });
  await f.tick(650);
  assert.equal(await f.completion, 'arrived');
  assert.equal(f.timers.size, 0);
  assert.equal(f.listeners.size, 0);
});

test('경로가 먼저 도착해도 실제 설정 DOM 준비와 최소 500ms 관측을 기다린다', async () => {
  const f = fixture();
  f.state.pathname = '/settings';
  await f.tick(700);
  assert.equal(f.completed, undefined);
  f.state.targetReady = true;
  await f.tick(750);
  assert.equal(await f.completion, 'arrived');
  const already = fixture();
  Object.assign(already.state, { pathname: '/settings', targetReady: true });
  await already.tick(499);
  assert.equal(already.completed, undefined);
  await already.tick(500);
  assert.equal(await already.completion, 'arrived');
});

test('오래된 tool 시작 시각은 새 이동의 실제 도착 대기를 생략하거나 timeout을 당기지 않는다', async () => {
  const f = fixture({ startedAt: -30_000 });
  await f.tick(7500);
  assert.equal(f.completed, undefined);
  Object.assign(f.state, { pathname: '/settings', targetReady: true });
  await f.tick(7550);
  assert.equal(await f.completion, 'arrived');
});

test('미도착·잘못된 경로·숨긴 DOM은 기존 8초 상한에서 실패한다', async () => {
  for (const state of [
    { pathname: '/about-me', targetReady: true },
    { pathname: '/settings', targetReady: false },
  ]) {
    const f = fixture();
    Object.assign(f.state, state);
    await f.tick(7999);
    assert.equal(f.completed, undefined);
    await f.tick(8000);
    assert.equal(await f.completion, 'failed');
    assert.equal(f.timers.size, 0);
    assert.equal(f.listeners.size, 0);
  }
});

test('타이머가 지연되어 상한 이후에 읽힌 늦은 도착을 성공으로 바꾸지 않는다', async () => {
  const f = fixture();
  Object.assign(f.state, { pathname: '/settings', targetReady: true });
  f.jump(9000);
  assert.equal(await f.completion, 'failed');
});

test('basePath와 끝 슬래시는 허용하지만 접두사 유사 경로는 거부한다', async () => {
  assert.equal(navigationPathMatches('/settings/', '/ssw-portfolio-public/settings/', '/ssw-portfolio-public'), true);
  assert.equal(navigationPathMatches('/settings', '/ssw-portfolio-public/settings-old', '/ssw-portfolio-public'), false);
  assert.equal(navigationPathMatches('/settings', '/settings', '/ssw-portfolio-public'), false);
  const f = fixture({ basePath: '/ssw-portfolio-public' });
  Object.assign(f.state, { pathname: '/ssw-portfolio-public/settings/', targetReady: true });
  await f.tick(500);
  assert.equal(await f.completion, 'arrived');
});

test('앵커는 경로·준비된 DOM뿐 아니라 해당 앵커의 기존 도착 신호도 필요하다', async () => {
  const f = fixture({ route: '/about-me/resume#career' });
  Object.assign(f.state, { pathname: '/about-me/resume', targetReady: true });
  await f.tick(600);
  f.arrive('unrelated');
  await f.tick(650);
  assert.equal(f.completed, undefined);
  f.arrive('career');
  // 신호 뒤 숨겨지거나 전환 중인 DOM도 여전히 성공으로 보지 않는다.
  f.state.targetReady = false;
  await f.tick(700);
  assert.equal(f.completed, undefined);
  f.state.targetReady = true;
  await f.tick(750);
  assert.equal(await f.completion, 'arrived');
});

test('앵커 신호가 있어도 실제 경로가 다르거나 신호가 없으면 실패한다', async () => {
  for (const withEvent of [false, true]) {
    const f = fixture({ route: '/about-me/resume#career' });
    Object.assign(f.state, { pathname: withEvent ? '/about-me' : '/about-me/resume', targetReady: true });
    if (withEvent) f.arrive('career');
    await f.tick(8000);
    assert.equal(await f.completion, 'failed');
  }
});

test('중단·언마운트 취소·시작 전 중단은 AbortError와 함께 타이머·리스너를 정리한다', async () => {
  for (const cancel of [f => f.controller.abort(), f => f.cancel()]) {
    const f = fixture();
    const rejected = assert.rejects(f.completion, { name: 'AbortError' });
    await f.tick(300);
    cancel(f);
    await rejected;
    assert.equal(f.timers.size, 0);
    assert.equal(f.listeners.size, 0);
  }
  const controller = new AbortController();
  controller.abort();
  const f = fixture({ signal: controller.signal });
  await assert.rejects(f.completion, { name: 'AbortError' });
  assert.equal(f.timers.size, 0);
  assert.equal(f.listeners.size, 0);
});

test('Provider 연결은 실제 경로·설정 본문·기존 DOM 가시성과 앵커 이벤트를 유지한다', () => {
  const source = readFileSync(new URL('../../../../src/features/chat/state/ChatProvider.tsx', import.meta.url), 'utf8');
  assert.match(source, /observeToolNavigation\(\{/u);
  assert.match(source, /pathname: window\.location\.pathname/u);
  assert.match(source, /\[data-option="theme-mode"\]/u);
  assert.match(source, /targetReady: !!target && isPortfolioTargetReady\(target\)/u);
  assert.match(source, /CHAT_ACTION_TARGET_ARRIVED_EVENT, handleArrived/u);
  assert.match(source, /toolResultWatchersRef\.current\.add\(observation\.cancel\)/u);
});

/** 모사한 이동기가 아니라 Provider의 실제 콜백을 타입만 지워 DOM·RAF fixture에서 실행한다. */
function providerNavigationFixture(t, { motionSuppressed = true, mobile = false,
  pathname = '/about-me/research', hash = '#research-year-2025', experimentId } = {}) {
  const source = readFileSync(new URL('../../../../src/features/chat/state/ChatProvider.tsx', import.meta.url), 'utf8');
  const slice = (start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, `${start} 콜백을 찾을 수 있어야 한다`);
    return source.slice(from, to);
  };
  const callbacks = [
    slice('  const animateDocumentScroll = useCallback(', '\n  /** 패널 연출.'),
    slice('  const clearActionNavigation = useCallback(', '\n  // 예약한 경로'),
    slice('  const navigateRoute = useCallback(', '\n  // 이동 함수의 최신 구현'),
  ].join('\n');
  const ts = createRequire(import.meta.url)('typescript');
  const compiled = ts.transpileModule(callbacks, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const tasks = new Map();
  const scheduled = [];
  let now = 0;
  let nextId = 0;
  const schedule = (callback, delay) => {
    const id = ++nextId;
    const task = { id, callback, at: now + delay };
    tasks.set(id, task);
    scheduled.push(task);
    return id;
  };
  const events = new EventTarget();
  const arrivals = [];
  const abandoned = [];
  events.addEventListener(navigationContract.CHAT_ACTION_TARGET_ARRIVED_EVENT, event => arrivals.push(event.detail.anchor));
  events.addEventListener(navigationContract.CHAT_ACTION_TARGET_ABANDONED_EVENT, event => abandoned.push(event.detail.anchor));
  const state = { layoutAnimations: [], panelAnimations: [], closed: 0 };
  const scroller = { scrollTop: 1_000, scrollHeight: 10_000,
    scrollTo: ({ top }) => { scroller.scrollTop = top; } };
  const experiment = experimentId ? experimentDomFixture(scroller, experimentId) : null;
  const root = { scrollHeight: 10_000 };
  const timeline = { getAnimations: () => state.layoutAnimations };
  const targets = Object.fromEntries(['2025', '2026'].map((year, index) => [year, {
    id: `research-year-${year}`, documentTop: 1_180 + index * 1_000,
    getClientRects: () => [{}],
    getBoundingClientRect() {
      const top = this.documentTop - scroller.scrollTop;
      return { top, bottom: top + 100 };
    },
    closest: selector => selector === '#research-timeline' ? timeline : null,
    getAnimations: () => state.panelAnimations,
    focus: () => {}, setAttribute: () => {}, removeAttribute: () => {},
  }]));
  const windowFixture = {
    location: new URL(`http://localhost${pathname}${hash}`),
    performance: { now: () => now }, innerHeight: 800, innerWidth: 1440,
    history: { state: {}, pushState: (_state, _title, path) => {
      windowFixture.location = new URL(path, windowFixture.location.href);
    } },
    dispatchEvent: event => events.dispatchEvent(event),
    addEventListener: (...args) => events.addEventListener(...args),
    removeEventListener: (...args) => events.removeEventListener(...args),
    requestAnimationFrame: callback => schedule(callback, 16), cancelAnimationFrame: id => tasks.delete(id),
    setTimeout: schedule, clearTimeout: id => tasks.delete(id),
    getComputedStyle: element => ({ display: 'block', visibility: 'visible',
      scrollPaddingTop: element === root ? '84px' : '0', scrollMarginTop: '96px' }),
    matchMedia: () => ({ matches: mobile }), scrollTo: value => scroller.scrollTo(value),
  };
  const documentFixture = { scrollingElement: scroller, documentElement: root,
    getElementById: id => experiment?.document.getElementById(id) ?? targets[id.replace('research-year-', '')] ?? null };
  globalThis.window = windowFixture;
  globalThis.document = documentFixture;
  const refs = Object.fromEntries([
    'actionScrollFrameRef', 'actionTopScrollFrameRef', 'actionScrollTimerRef', 'actionPageEntryTimerRef',
    'pendingActionAnchorRef', 'pendingActionPathRef', 'pendingActionAwaitingPageEntryRef',
    'activeActionNavigationRouteRef', 'activeActionNavigationOptionsRef', 'actionNavigationAbortCleanupRef',
    'actionTargetHighlightTimerRef', 'highlightedActionTargetRef', 'pendingActionRouteRef',
    'pendingChatNavigationFocusRef',
  ].map(name => [name, { current: null }]));
  const context = {
    ...navigationContract, ...refs, window: windowFixture, document: documentFixture,
    process: { env: {} }, useCallback: callback => callback,
    actionNavigationTokenRef: { current: 0 }, actionScrollTokenRef: { current: 0 },
    isOpenRef: { current: true }, mobileHistoryEntryRef: { current: false },
    navigationPathMatches, isPortfolioTargetReady, isPortfolioTargetAligned,
    createTargetLayoutStabilityCheck, resolvePortfolioNavigationTarget, agentExperimentViewTargetForAnchor,
    motionSuppressed, pageTransition: 'none', pathname,
    router: { prefetch: () => {}, push: path => { windowFixture.location = new URL(path, windowFixture.location.href); } },
    restoreChatInputAfterNavigation: () => {}, logChatFailureLocally: () => {},
    scrollDurationForDistance: () => 120, easeInOutCubic: value => value, easeOutCubic: value => value,
    ACTION_TARGET_WAIT_TIMEOUT_MS: 3_000, SAFE_ROUTE_PATTERN: /^\/(?!\/)/u,
    MOBILE_QUERY: '(max-width: 700px)', MOBILE_HISTORY_MARKER: 'chat-mobile',
    beginMobileClose: () => { state.closed += 1; },
    HashChangeEvent: class extends Event { constructor(type) { super(type); } },
  };
  const api = new Function(...Object.keys(context), `${compiled}\nreturn {
    navigateToActionTarget, scrollToPendingActionAnchor, clearActionNavigation, navigateRoute };
  `)(...Object.values(context));
  t.after(() => {
    api.clearActionNavigation();
    if (refs.actionTargetHighlightTimerRef.current !== null) tasks.delete(refs.actionTargetHighlightTimerRef.current);
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  });
  return { ...api, refs, state, targets, arrivals, abandoned, scroller, window: windowFixture, document: documentFixture,
    tasks, scheduled, experiment, schedule,
    async tick(until) {
      for (;;) {
        const next = [...tasks.values()].sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!next || next.at > until) break;
        now = next.at;
        tasks.delete(next.id);
        next.callback(now);
        await Promise.resolve();
      }
      now = until;
      await Promise.resolve();
    },
  };
}

test('실제 Provider: 카드 커밋·높이 전환 뒤 정렬해 같은 연도 조기도착을 막는다', async t => {
  const f = providerNavigationFixture(t);
  let committed = false;
  f.navigateToActionTarget('/about-me/research#research-year-2025', { isTargetReady: () => committed });
  await f.tick(40);
  assert.deepEqual(f.arrivals, [], '옛 위치가 이미 정렬됐어도 카드 커밋 전에 도착하지 않는다');
  committed = true;
  f.state.layoutAnimations = [{ transitionProperty: 'grid-template-rows', playState: 'running' }];
  f.targets['2025'].documentTop = 600;
  await f.tick(300);
  assert.deepEqual(f.arrivals, []);
  f.state.layoutAnimations = [];
  f.targets['2025'].documentTop = 280;
  await f.tick(600);
  assert.deepEqual(f.arrivals, ['research-year-2025']);
  assert.equal(f.targets['2025'].getBoundingClientRect().top, 180);
  assert.equal(f.tasks.size, 0);
});

test('실제 Provider: 같은 경로의 오래된 animation 콜백·취소는 새 이동을 완료하거나 지우지 못한다', async t => {
  const f = providerNavigationFixture(t, { motionSuppressed: false });
  const oldController = new AbortController();
  let finishOldAnimation;
  f.state.panelAnimations = [{ animationName: 'about-page-enter', playState: 'running',
    finished: new Promise(resolve => { finishOldAnimation = resolve; }) }];
  const route = '/about-me/research#research-year-2025';
  f.navigateToActionTarget(route, { signal: oldController.signal });
  await f.tick(32);
  f.state.panelAnimations = [];
  let newReady = false;
  f.navigateToActionTarget(route, { isTargetReady: () => newReady });
  finishOldAnimation();
  oldController.abort();
  await f.tick(200);
  assert.deepEqual(f.arrivals, []);
  assert.equal(f.refs.activeActionNavigationRouteRef.current, route);
  newReady = true;
  await f.tick(400);
  assert.deepEqual(f.arrivals, ['research-year-2025']);
  assert.equal(f.refs.activeActionNavigationRouteRef.current, null);
});

test('실제 Provider: 진행 중 스크롤 취소 뒤 옛 RAF가 실행돼도 문서를 움직이지 않는다', async t => {
  const f = providerNavigationFixture(t, { motionSuppressed: false });
  const controller = new AbortController();
  f.targets['2025'].documentTop = 3_000;
  f.navigateToActionTarget('/about-me/research#research-year-2025', { signal: controller.signal });
  await f.tick(50);
  const oldFrame = f.scheduled.at(-1).callback;
  controller.abort();
  const stoppedAt = f.scroller.scrollTop;
  oldFrame(150);
  await f.tick(1_000);
  assert.equal(f.scroller.scrollTop, stoppedAt);
  assert.deepEqual(f.arrivals, []);
  assert.equal(f.tasks.size, 0);
});

test('실제 Provider: 사용자가 다른 해시·페이지로 이동하면 준비 대기 중인 옛 앵커로 되돌리지 않는다', async t => {
  for (const destination of ['#research-year-2026', '/about-me/resume']) {
    await t.test(destination, async t => {
      const f = providerNavigationFixture(t);
      let ready = false;
      f.navigateToActionTarget('/about-me/research#research-year-2025', { isTargetReady: () => ready });
      await f.tick(40);
      f.window.location = new URL(destination, f.window.location.href);
      const userUrl = f.window.location.href;
      ready = true;
      f.targets['2025'].documentTop = 400;
      await f.tick(500);
      assert.equal(f.window.location.href, userUrl);
      assert.equal(f.scroller.scrollTop, 1_000);
      assert.deepEqual(f.arrivals, []);
      assert.equal(f.tasks.size, 0);
    });
  }
});

test('실제 Provider: 모바일 닫기 대기에도 준비 조건·signal을 보존하고 취소한 예약은 이동하지 않는다', t => {
  const f = providerNavigationFixture(t, { mobile: true });
  const controller = new AbortController();
  const options = { signal: controller.signal, isTargetReady: () => false };
  f.navigateRoute('/about-me/research#research-year-2026', options);
  const pending = f.refs.pendingActionRouteRef.current;
  assert.equal(pending.options, options);
  assert.equal(f.state.closed, 1);
  controller.abort();
  f.navigateToActionTarget(pending.route, pending.options);
  assert.equal(f.window.location.hash, '#research-year-2025');
  assert.equal(f.tasks.size, 0);
});

test('실제 Provider + Gallery: 공개 27항목·7분류·소개를 선택·정렬·핑한 뒤 원래 앵커로 도착을 보고한다', async t => {
  const f = providerNavigationFixture(t, { pathname: '/about-me', hash: '', experimentId: 'svg-illustrations' });
  const hook = installGallerySelectionEffect(f.window, id => f.experiment.commit(id));
  t.after(hook.cleanup);
  const pingAtArrival = [];
  f.window.addEventListener(navigationContract.CHAT_ACTION_TARGET_ARRIVED_EVENT, event => {
    pingAtArrival.push(resolvePortfolioNavigationTarget(event.detail.anchor)?.getAttribute('data-chat-action-target'));
  });
  for (const [index, destination] of AGENT_EXPERIMENT_VIEW_TARGETS.entries()) {
    const startAt = index * 2_000;
    f.navigateToActionTarget(destination.route);
    await f.tick(startAt + 99);
    assert.equal(f.arrivals.length, index, `${destination.action}: 안정화 전에 도착하지 않는다`);
    await f.tick(startAt + 350);
    assert.equal(f.arrivals.at(-1), destination.anchor);
    assert.equal(pingAtArrival.at(-1), 'static', '모션 끔에서도 핑을 표시한 다음 arrived를 보낸다');
    const target = resolvePortfolioNavigationTarget(destination.anchor);
    assert.equal(target.getBoundingClientRect().top, 180);
    assert.equal(f.experiment.state.focused, target);
    if (destination.kind !== 'intro') assert.equal(f.experiment.state.selectedId, destination.itemId);
    if (destination.kind === 'item') assert.equal(target, f.experiment.heading);
    await f.tick(startAt + 2_000);
    assert.equal(target.getAttribute('data-chat-action-target'), null);
  }
  assert.equal(f.arrivals.length, 35);
  assert.equal(f.tasks.size, 0);
});

test('실제 Provider + Gallery: 같은 해시에서 같은/다른 분류를 수동 선택한 이력도 본문 커밋과 애니메이션을 기다린다', async t => {
  for (const initialId of ['planet-defense', 'svg-illustrations']) {
    await t.test(initialId, async t => {
      const f = providerNavigationFixture(t, { pathname: '/about-me', hash: '#oscillo-rhythm-game', experimentId: initialId });
      let selected;
      const hook = installGallerySelectionEffect(f.window, id => { selected = id; });
      t.after(hook.cleanup);
      selected = null;
      f.navigateToActionTarget('/about-me#oscillo-rhythm-game');
      assert.equal(selected, 'oscillo-rhythm-game', 'hashchange가 없어도 준비 이벤트로 다시 선택한다');
      await f.tick(300);
      assert.deepEqual(f.arrivals, []);
      assert.equal(f.scroller.scrollTop, 1_000);
      f.experiment.commit(selected);
      f.experiment.state.animations = [{ playState: 'running' }];
      await f.tick(500);
      assert.deepEqual(f.arrivals, []);
      f.experiment.state.animations = [];
      await f.tick(650);
      assert.deepEqual(f.arrivals, ['oscillo-rhythm-game']);
      assert.equal(f.experiment.heading.getAttribute('data-chat-action-target'), 'static');
      assert.equal(f.experiment.itemButtons[selected].getAttribute('data-chat-action-target'), null);
      assert.equal(f.experiment.state.selectedId, selected);
    });
  }
});

test('실제 Provider + Gallery: 다른 페이지에서 진입해 본문이 마운트된 뒤 선택하고 뷰포트 재배치 후에 도착한다', async t => {
  const f = providerNavigationFixture(t, { experimentId: 'svg-illustrations' });
  f.experiment.state.rendered = false;
  f.navigateToActionTarget('/about-me#modern-warfare-sample');
  await f.tick(100);
  assert.deepEqual(f.arrivals, []);
  assert.equal(f.window.location.pathname, '/about-me');
  f.experiment.state.rendered = true;
  const hook = installGallerySelectionEffect(f.window, id => f.experiment.commit(id));
  t.after(hook.cleanup);
  f.scrollToPendingActionAnchor();
  await f.tick(180);
  f.window.innerWidth = 390;
  f.experiment.state.width = 310;
  f.experiment.state.documentTop = 2_200;
  await f.tick(250);
  assert.deepEqual(f.arrivals, [], '리사이즈로 바뀐 본문 좌표가 안정될 때까지 기다린다');
  await f.tick(350);
  assert.deepEqual(f.arrivals, ['modern-warfare-sample']);
  assert.equal(f.experiment.heading.getBoundingClientRect().top, 180);
  assert.equal(readPortfolioViewState('/about-me').anchor, 'modern-warfare-sample');
});

test('실제 Provider: 휠·터치·새 클릭·스크롤 키가 예약 이동을 취소하고 늦은 커밋도 스크롤·포커스를 되돌리지 않는다', async t => {
  for (const eventType of ['wheel', 'touchmove', 'pointerdown', 'keydown']) {
    await t.test(eventType, async t => {
      const f = providerNavigationFixture(t, { pathname: '/about-me', hash: '', experimentId: 'planet-defense' });
      f.refs.pendingChatNavigationFocusRef.current = true;
      f.navigateToActionTarget('/about-me#oscillo-rhythm-game');
      await f.tick(40);
      const event = new Event(eventType);
      if (eventType === 'keydown') Object.defineProperty(event, 'key', { value: 'PageDown' });
      f.window.dispatchEvent(event);
      f.scroller.scrollTop = 1_234;
      f.experiment.commit('oscillo-rhythm-game');
      await f.tick(1_000);
      assert.equal(f.scroller.scrollTop, 1_234);
      assert.equal(f.experiment.state.focused, null);
      assert.equal(f.refs.pendingChatNavigationFocusRef.current, false);
      assert.deepEqual(f.arrivals, []);
      assert.deepEqual(f.abandoned, ['oscillo-rhythm-game'], '도착을 기다리던 쪽이 바로 알 수 있게 취소를 알린다');
      assert.equal(f.tasks.size, 0);
    });
  }
});

test('실제 Provider: 둘러보기 카드의 잠긴 버튼을 다시 눌러도 진행 중인 이동은 이어 간다', async t => {
  const f = providerNavigationFixture(t, { pathname: '/about-me', hash: '', experimentId: 'planet-defense' });
  f.navigateToActionTarget('/about-me#oscillo-rhythm-game');
  await f.tick(40);
  const tap = new Event('pointerdown');
  Object.defineProperty(tap, 'target', { value: { closest: selector => (selector === '[data-guided-tour-card]' ? {} : null) } });
  f.window.dispatchEvent(tap);
  f.experiment.commit('oscillo-rhythm-game');
  await f.tick(1_000);
  assert.deepEqual(f.abandoned, []);
  assert.deepEqual(f.arrivals, ['oscillo-rhythm-game']);
});

test('실제 Provider: 새 실험 요청과 명시적 중단은 옛 이동 콜백을 폐기하고 숨긴 본문에는 핑하지 않는다', async t => {
  const f = providerNavigationFixture(t, { pathname: '/about-me', hash: '', experimentId: 'planet-defense' });
  const old = new AbortController();
  f.navigateToActionTarget('/about-me#oscillo-rhythm-game', { signal: old.signal });
  await f.tick(40);
  const oldRetry = f.scheduled.at(-1).callback;
  const current = new AbortController();
  f.navigateToActionTarget('/about-me#modern-warfare-sample', { signal: current.signal });
  f.experiment.commit('modern-warfare-sample');
  f.experiment.state.articleHidden = true;
  old.abort();
  oldRetry(100);
  await f.tick(300);
  assert.deepEqual(f.arrivals, []);
  assert.equal(f.refs.activeActionNavigationRouteRef.current, '/about-me#modern-warfare-sample');
  f.experiment.state.articleHidden = false;
  await f.tick(450);
  assert.deepEqual(f.arrivals, ['modern-warfare-sample']);
  const cancelled = new AbortController();
  f.navigateToActionTarget('/about-me#oscillo-rhythm-game', { signal: cancelled.signal });
  cancelled.abort();
  f.experiment.commit('oscillo-rhythm-game');
  await f.tick(700);
  assert.deepEqual(f.arrivals, ['modern-warfare-sample']);
  assert.equal(f.experiment.heading.getAttribute('data-chat-action-target'), null);
});

test('실제 Provider: 05단계 이력에서도 si-levels는 소개 헤더로 도착하고 05단계를 목적지로 재사용하지 않는다', async t => {
  const f = providerNavigationFixture(t, { motionSuppressed: false,
    pathname: '/about-me/ai-workflow', hash: '#workflow-header-orchestration' });
  const intro = { ...f.targets['2025'], id: 'ai-workflow-intro', documentTop: 300,
    attributes: {}, setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; } };
  f.targets['ai-workflow-intro'] = intro;
  const panel = { id: 'workflow-orchestration', contains: () => false };
  f.document.querySelector = () => panel;
  assert.equal(workflowStageFromHash(f.window.location.hash), 'orchestration');
  f.navigateToActionTarget(resolvePortfolioViewTarget('si-levels').route);
  await f.tick(500);
  assert.equal(f.window.location.hash, '#ai-workflow-intro');
  assert.equal(workflowStageFromHash(f.window.location.hash), 'chat');
  assert.deepEqual(f.arrivals, ['ai-workflow-intro']);
  assert.equal(intro.attributes['data-chat-action-target'], 'true');
  assert.equal(readPortfolioViewState('/about-me/ai-workflow').anchor, 'ai-workflow-intro');
  const tabs = readFileSync(new URL('../../../../src/features/ai-workflow/ui/WorkflowStageTabs.tsx', import.meta.url), 'utf8');
  assert.match(tabs, /if \(!hash\.startsWith\('#workflow-'\) && !hash\.startsWith\('#example-'\) && !hash\.startsWith\('#story-'\)\) return;/u);
});
