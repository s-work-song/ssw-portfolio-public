import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { agentExperiments } from '../../../src/features/experiments/data/agentExperiments.ts';
import { AGENT_EXPERIMENT_CATEGORY_ANCHORS } from '../../../src/features/experiments/data/agentExperimentNavigation.ts';
import { AGENT_EXPERIMENT_VIEW_ACTIONS, AGENT_EXPERIMENT_VIEW_TARGETS,
  PUBLIC_AGENT_EXPERIMENT_TARGETS, agentExperimentViewTargetForAnchor } from '../../../src/features/experiments/data/agentExperimentViewTargets.ts';
import { readActiveAgentExperiment, resolvePortfolioNavigationTarget,
  createTargetLayoutStabilityCheck } from '../../../src/features/portfolio-tools/experimentNavigation.ts';
import { experimentDomFixture, installGallerySelectionEffect } from './experimentNavigationFixtures.mjs';
import { PORTFOLIO_VIEW_ACTIONS, portfolioViewControlInput } from '../../../src/features/portfolio-tools/view.ts';
import { readPortfolioViewState, resolvePortfolioViewTarget } from '../../../src/features/webmcp/portfolioView.ts';
import { parseTurnEvent } from '../../../src/features/chat/transport/sse.ts';
import { CHAT_ACTION_TARGET_PREPARE_EVENT } from '../../../src/features/chat/navigation.ts';

test('실험 제목 핑은 카드 안쪽 곡률을 공유해 둥근 clipping 경계에서 잘리지 않는다', () => {
  const css = readFileSync(new URL('../../../src/features/experiments/ui/AgentExperimentGallery.module.css', import.meta.url), 'utf8');
  const stage = css.match(/\.stage\s*\{([^}]+)\}/u)?.[1] ?? '';
  assert.match(stage, /--experiment-stage-radius:\s*16px/u);
  assert.match(stage, /--experiment-stage-border-width:\s*1px/u);
  assert.match(stage, /border-radius:\s*var\(--experiment-stage-radius\)/u);
  assert.match(stage, /overflow:\s*hidden/u);
  // 공통 [data-chat-action-target]보다 구체적으로 지정하고 animated/static 모두 적용한다.
  const highlight = css.match(/\.experimentHeading:global\(\[data-chat-action-target\]\)\s*\{([^}]+)\}/u)?.[1] ?? '';
  assert.match(highlight, /border-radius:\s*calc\(var\(--experiment-stage-radius\) - var\(--experiment-stage-border-width\)\)\s+calc\(var\(--experiment-stage-radius\) - var\(--experiment-stage-border-width\)\)\s+0\s+0/u);
  assert.doesNotMatch(highlight, /(?:z-index|overflow|position|scroll-margin|padding):/u);
});

function useDom(t, id = 'svg-illustrations') {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const f = experimentDomFixture(undefined, id);
  globalThis.document = f.document;
  globalThis.window = { location: { hash: `#${id}` }, getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) };
  t.after(() => { globalThis.window = previousWindow; globalThis.document = previousDocument; });
  return f;
}

test('실험 이동 목록은 원문 순서·제목의 공개 27개만 담고 소개·7분류를 합쳐 35개다', () => {
  assert.deepEqual(PUBLIC_AGENT_EXPERIMENT_TARGETS,
    agentExperiments.filter(item => !item.hidden).map(({ id, title, category }) => ({ id, title, category })));
  assert.equal(PUBLIC_AGENT_EXPERIMENT_TARGETS.length, 27);
  assert.equal(AGENT_EXPERIMENT_VIEW_ACTIONS.length, 35);
  assert.equal(new Set(AGENT_EXPERIMENT_VIEW_ACTIONS).size, 35);
  // 성능 최적화 하위 탭(CPU·메모리·직렬화) 3개, 챗봇 구조 실험 카드 1개, SI 학습 활용 섹션 1개, 오픈웨이트 모델 실험 탭과 학습 데이터 카드 3개를 더해 79개다.
  assert.equal(PORTFOLIO_VIEW_ACTIONS.length, 79);
  for (const target of AGENT_EXPERIMENT_VIEW_TARGETS) {
    assert.deepEqual(portfolioViewControlInput.parse({ action: target.action }), { action: target.action });
    assert.throws(() => portfolioViewControlInput.parse({ action: target.action, target: 'all' }));
    const resolved = resolvePortfolioViewTarget(target.action);
    assert.equal(resolved.route, target.route);
    assert.equal(resolved.label, target.label);
    assert.equal(agentExperimentViewTargetForAnchor(target.anchor), target);
    const request = parseTurnEvent({ event: 'tool_request', data: JSON.stringify({ turnId: 'experiment-test',
      calls: [{ callId: `test-${target.action}`, name: 'control_portfolio_view', arguments: { action: target.action } }] }) });
    assert.deepEqual(portfolioViewControlInput.parse(request.calls[0].arguments), { action: target.action });
  }
  for (const [category, anchor] of Object.entries(AGENT_EXPERIMENT_CATEGORY_ANCHORS)) {
    const target = agentExperimentViewTargetForAnchor(anchor);
    assert.equal(target.label, category);
    assert.equal(target.itemId, PUBLIC_AGENT_EXPERIMENT_TARGETS.find(item => item.category === category).id);
  }
  for (const item of agentExperiments.filter(item => item.hidden)) {
    assert.equal(agentExperimentViewTargetForAnchor(item.id), undefined);
    assert.throws(() => portfolioViewControlInput.parse({ action: `agent-experiment-${item.id}` }));
    assert.equal(resolvePortfolioViewTarget(`agent-experiment-${item.id}`), undefined);
  }
  for (const action of ['agent-experiment-unknown', 'agent-experiments-2d', 'https://example.com']) {
    assert.throws(() => portfolioViewControlInput.parse({ action }));
  }
});

test('같은 분류의 미선택 메뉴 버튼과 다른 분류는 본문 도착 대상으로 인정하지 않는다', t => {
  const f = useDom(t, 'planet-defense');
  assert.ok(document.getElementById('oscillo-rhythm-game'), '같은 분류의 메뉴는 DOM에 존재한다');
  assert.equal(resolvePortfolioNavigationTarget('oscillo-rhythm-game'), null);
  assert.equal(resolvePortfolioNavigationTarget('modern-warfare-sample'), null);
  f.commit('oscillo-rhythm-game');
  assert.equal(resolvePortfolioNavigationTarget('oscillo-rhythm-game'), f.heading);
  assert.notEqual(resolvePortfolioNavigationTarget('oscillo-rhythm-game'), f.itemButtons['oscillo-rhythm-game']);
  assert.equal(resolvePortfolioNavigationTarget('agent-experiments-2d-games'), null, '분류는 첫 공개 항목 선택까지 필요하다');
  f.commit('planet-defense');
  assert.equal(resolvePortfolioNavigationTarget('agent-experiments-2d-games'), f.categoryButtons['agent-experiments-2d-games']);
  assert.equal(resolvePortfolioNavigationTarget('agent-experiments-intro'), f.intro);
});

test('갤러리·버튼·본문의 선택 일치와 숨김·커밋·진입 애니메이션을 모두 확인한다', t => {
  const f = useDom(t, 'modern-warfare-sample');
  assert.equal(readActiveAgentExperiment().item.id, 'modern-warfare-sample');
  f.article.dataset.agentExperimentId = 'planet-defense';
  assert.equal(resolvePortfolioNavigationTarget('modern-warfare-sample'), null);
  f.commit('modern-warfare-sample');
  for (const state of [{ articleHidden: true }, { articleVisible: false }, { rendered: false },
    { animations: [{ playState: 'running' }] }]) {
    const old = Object.fromEntries(Object.keys(state).map(key => [key, f.state[key]]));
    Object.assign(f.state, state);
    assert.equal(resolvePortfolioNavigationTarget('modern-warfare-sample'), null);
    Object.assign(f.state, old);
  }
  const button = f.itemButtons['modern-warfare-sample'];
  const readAttribute = button.getAttribute;
  button.getAttribute = () => 'false';
  assert.equal(readActiveAgentExperiment(), null);
  button.getAttribute = readAttribute;
  f.state.animations = [{ playState: 'finished' }];
  assert.equal(resolvePortfolioNavigationTarget('modern-warfare-sample'), f.heading);
});

test('현재 화면 조회는 수동 선택 후 남은 옛 실험 해시 대신 실제 공개 본문을 보고한다', t => {
  const f = useDom(t, 'modern-warfare-sample');
  window.location.hash = '#oscillo-rhythm-game';
  assert.equal(readPortfolioViewState('/about-me').anchor, 'modern-warfare-sample');
  window.location.hash = '#agent-experiments-2d-games';
  assert.equal(readPortfolioViewState('/about-me').anchor, 'agent-experiments-3d-games');
  f.state.rendered = false;
  assert.equal(readPortfolioViewState('/about-me').anchor, null);
  window.location.hash = '#agent-experiments-intro';
  assert.equal(readPortfolioViewState('/about-me').anchor, 'agent-experiments-intro');
});

test('목표 레이아웃은 자동 스크롤을 제외하고 100ms 안정화하며 크기·뷰포트·커밋 변경 시 다시 기다린다', () => {
  const scroller = { scrollTop: 0 };
  const f = experimentDomFixture(scroller);
  const stable = createTargetLayoutStabilityCheck();
  const check = (at, width = 1440) => stable(f.heading, at, scroller.scrollTop, width, 800);
  assert.equal(check(0), false);
  scroller.scrollTop = 400;
  assert.equal(check(99), false);
  assert.equal(check(100), true);
  f.state.documentTop += 100;
  assert.equal(check(110), false);
  assert.equal(check(210), true);
  f.state.width = 350;
  assert.equal(check(220, 375), false);
  assert.equal(check(320, 375), true);
  assert.equal(stable(null, 330, scroller.scrollTop), false);
  assert.equal(check(500, 375), false);
  assert.equal(check(600, 375), true);
  f.commit('planet-defense');
  assert.equal(check(700, 375), false);
});

test('실제 Gallery effect는 해시·뒤로/앞으로·같은 해시 prepare를 선택 전에 처리하고 중단·숨김은 무시한다', () => {
  const events = new EventTarget();
  const window = { location: { hash: '#oscillo-rhythm-game' },
    addEventListener: (...args) => events.addEventListener(...args),
    removeEventListener: (...args) => events.removeEventListener(...args) };
  const changes = [];
  const hook = installGallerySelectionEffect(window, id => changes.push(id));
  assert.equal(hook.selected.id, 'oscillo-rhythm-game');
  window.location.hash = '#agent-experiments-3d-games';
  events.dispatchEvent(new Event('hashchange'));
  assert.equal(hook.selected.id, 'flight-simulator-experiment');
  window.location.hash = '#modern-warfare-sample';
  events.dispatchEvent(new Event('popstate'));
  assert.equal(hook.selected.id, 'modern-warfare-sample');
  hook.selected.id = 'svg-illustrations';
  events.dispatchEvent(new CustomEvent(CHAT_ACTION_TARGET_PREPARE_EVENT, { detail: { anchor: 'modern-warfare-sample' } }));
  assert.equal(hook.selected.id, 'modern-warfare-sample');
  const controller = new AbortController();
  controller.abort();
  for (const detail of [{ anchor: 'oscillo-rhythm-game', signal: controller.signal },
    { anchor: 'fps-model-comparison' }, { anchor: 'blender-3d-assets' }, { anchor: 'https://example.com' }]) {
    events.dispatchEvent(new CustomEvent(CHAT_ACTION_TARGET_PREPARE_EVENT, { detail }));
    assert.equal(hook.selected.id, 'modern-warfare-sample');
  }
  assert.equal(hook.selected.category, '3D 게임 실험');
  assert.equal(hook.selected.model, 0);
  hook.cleanup();
  const count = changes.length;
  window.location.hash = '#oscillo-rhythm-game';
  events.dispatchEvent(new Event('hashchange'));
  events.dispatchEvent(new Event('popstate'));
  events.dispatchEvent(new CustomEvent(CHAT_ACTION_TARGET_PREPARE_EVENT, { detail: { anchor: 'oscillo-rhythm-game' } }));
  assert.equal(changes.length, count);
});

test('실제 Gallery 앞뒤·키보드 선택은 순환·포커스를 유지하고 링크 실행·음원 자동 재생을 추가하지 않는다', () => {
  const source = readFileSync(new URL('../../../src/features/experiments/ui/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('  function select(nextIndex:');
  const end = source.indexOf('\n  return (', start);
  assert.ok(start >= 0 && end > start);
  const ts = createRequire(import.meta.url)('typescript');
  const compiled = ts.transpileModule(source.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const experiments = agentExperiments.filter(item => !item.hidden && item.category === '2D 게임 실험');
  const selected = [];
  const focused = [];
  const context = { experiments, setSelectedId: id => selected.push(id), setSelectedModel: model => assert.equal(model, 0),
    itemRefs: { current: experiments.map((_, index) => ({ focus: options => focused.push([index, options]) })) } };
  const { select, handleKey } = new Function(...Object.keys(context), `${compiled}\nreturn { select, handleKey };`)(...Object.values(context));
  select(-1);
  select(experiments.length);
  for (const [key, index] of [['End', 0], ['Home', 2], ['ArrowRight', 2], ['ArrowLeft', 0]]) {
    let prevented = false;
    handleKey({ key, preventDefault: () => { prevented = true; } }, index);
    assert.equal(prevented, true);
  }
  assert.deepEqual(selected, ['oscillo-rhythm-game', 'planet-defense', 'oscillo-rhythm-game',
    'planet-defense', 'planet-defense', 'oscillo-rhythm-game']);
  assert.deepEqual(focused.map(([index]) => index), [2, 0, 0, 2]);
  assert.ok(focused.every(([, options]) => options.preventScroll));
  assert.doesNotMatch(source, /\bautoPlay\b|\.play\(\)|window\.open\(/u);
  assert.match(source, /<a href=\{active\.demoUrl\} target="_blank" rel="noopener noreferrer"/u);
});
