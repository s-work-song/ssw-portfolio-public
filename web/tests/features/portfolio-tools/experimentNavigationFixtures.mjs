import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { agentExperiments } from '../../../src/features/experiments/data/agentExperiments.ts';
import { AGENT_EXPERIMENT_CATEGORY_ANCHORS, agentExperimentForAnchor } from '../../../src/features/experiments/data/agentExperimentNavigation.ts';
import * as navigationContract from '../../../src/features/chat/navigation.ts';

/** 본문 커밋과 메뉴 선택을 분리해 조기 도착을 재현하는 테스트 전용 DOM이다. */
export function experimentDomFixture(scroller = { scrollTop: 0 }, initialId = 'svg-illustrations') {
  const visible = agentExperiments.filter(item => !item.hidden);
  const state = { selectedId: initialId, rendered: true, articleHidden: false, articleVisible: true,
    animations: [], documentTop: 1_500, width: 900, height: 92, focused: null };
  const element = (id, top = () => state.documentTop) => ({
    id, attributes: {}, dataset: {},
    closest: () => null, getClientRects: () => [{}], getAnimations: () => [],
    getBoundingClientRect() { const rectTop = top() - scroller.scrollTop;
      return { top: rectTop, bottom: rectTop + state.height, left: 40, width: state.width, height: state.height }; },
    focus() { state.focused = this; },
    getAttribute(name) { return this.attributes[name] ?? null; },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
  });
  const intro = element('agent-experiments-intro', () => 500);
  const gallery = element('agent-experiments');
  const stage = element('agent-experiment-stage');
  let article;
  let heading;
  const categoryButtons = Object.fromEntries(Object.entries(AGENT_EXPERIMENT_CATEGORY_ANCHORS).map(([category, id]) => {
    const button = element(id, () => state.documentTop - 160);
    button.getAttribute = name => name === 'aria-pressed' ? String(visible.find(item => item.id === state.selectedId)?.category === category) : button.attributes[name] ?? null;
    return [id, button];
  }));
  const itemButtons = Object.fromEntries(visible.map(item => {
    const button = element(item.id, () => state.documentTop - 80);
    button.getAttribute = name => name === 'aria-pressed' ? String(state.selectedId === item.id) : button.attributes[name] ?? null;
    return [item.id, button];
  }));
  const commit = id => {
    const item = visible.find(candidate => candidate.id === id);
    assert.ok(item);
    state.selectedId = id;
    gallery.dataset = { activeExperimentId: id, activeExperimentCategory: item.category };
    heading = element('');
    heading.dataset = { agentExperimentHeading: 'true' };
    article = element('');
    article.dataset = { agentExperimentId: id, agentExperimentCategory: item.category };
    article.closest = selector => selector.includes('[inert]') && state.articleHidden ? {} : null;
    article.getClientRects = () => state.articleVisible ? [{}] : [];
    article.getAnimations = () => state.animations;
    article.querySelector = selector => selector === '[data-agent-experiment-heading]' ? heading : null;
  };
  commit(initialId);
  stage.querySelector = selector => state.rendered && selector === '[data-agent-experiment-id]' ? article : null;
  const document = { getElementById: id => {
    if (!state.rendered) return null;
    if (id === gallery.id) return gallery;
    if (id === stage.id) return stage;
    if (id === intro.id) return intro;
    if (categoryButtons[id]) return categoryButtons[id];
    const activeCategory = visible.find(item => item.id === state.selectedId)?.category;
    return visible.some(item => item.id === id && item.category === activeCategory) ? itemButtons[id] : null;
  } };
  return { state, document, commit, intro, gallery, categoryButtons, itemButtons,
    get article() { return article; }, get heading() { return heading; } };
}

/** 실제 Gallery의 hash/prepare effect를 실행해 Provider와의 이벤트 순서를 검증한다. */
export function installGallerySelectionEffect(window, onSelect) {
  const source = readFileSync(new URL('../../../src/features/experiments/ui/AgentExperimentGallery.tsx', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  const start = source.indexOf('  useEffect(() => {\n    const selectAnchor');
  const end = source.indexOf('\n  if (!active)', start);
  assert.ok(start >= 0 && end > start);
  const ts = createRequire(import.meta.url)('typescript');
  const compiled = ts.transpileModule(source.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  let cleanup;
  const selected = { category: null, id: null, model: null };
  const context = { ...navigationContract, window,
    useEffect: effect => { cleanup = effect(); },
    agentExperimentForAnchor, visibleExperiments: agentExperiments.filter(item => !item.hidden),
    setCategory: category => { selected.category = category; },
    setSelectedId: id => { selected.id = id; onSelect?.(id); },
    setSelectedModel: model => { selected.model = model; },
  };
  new Function(...Object.keys(context), compiled)(...Object.values(context));
  return { selected, cleanup };
}
