import {
  PUBLIC_AGENT_EXPERIMENT_TARGETS, agentExperimentViewTargetForAnchor,
  type PublicAgentExperimentTarget,
} from '../experiments/data/agentExperimentViewTargets.ts';
import { AGENT_EXPERIMENT_CATEGORY_ANCHORS } from '../experiments/data/agentExperimentNavigation.ts';
import { isPortfolioTargetReady } from './viewTargetVisibility.ts';

interface ActiveExperiment {
  item: PublicAgentExperimentTarget;
  article: HTMLElement;
  categoryButton: HTMLElement;
  itemButton: HTMLElement;
}

/** URL만 믿지 않고 공개 카탈로그·선택 버튼·실제 본문이 같은 항목인지 확인한다. */
export function readActiveAgentExperiment(dom: Pick<Document, 'getElementById'> = document): ActiveExperiment | null {
  const gallery = dom.getElementById('agent-experiments');
  const item = PUBLIC_AGENT_EXPERIMENT_TARGETS.find((candidate) =>
    candidate.id === gallery?.dataset.activeExperimentId
      && candidate.category === gallery.dataset.activeExperimentCategory);
  if (!item) return null;
  const article = dom.getElementById('agent-experiment-stage')
    ?.querySelector<HTMLElement>('[data-agent-experiment-id]');
  const categoryButton = dom.getElementById(AGENT_EXPERIMENT_CATEGORY_ANCHORS[item.category]);
  const itemButton = dom.getElementById(item.id);
  if (article?.dataset.agentExperimentId !== item.id
    || article.dataset.agentExperimentCategory !== item.category
    || categoryButton?.getAttribute('aria-pressed') !== 'true'
    || itemButton?.getAttribute('aria-pressed') !== 'true') return null;
  return { item, article, categoryButton, itemButton };
}

/** 기존 작품 해시는 유지하되 메뉴 버튼이 아닌 실제 선택된 본문 헤더를 가리킨다. */
export function resolvePortfolioNavigationTarget(anchor: string,
  dom: Pick<Document, 'getElementById'> = document): HTMLElement | null {
  const destination = agentExperimentViewTargetForAnchor(anchor);
  if (!destination || destination.kind === 'intro') return dom.getElementById(anchor);
  const active = readActiveAgentExperiment(dom);
  if (!active || active.item.id !== destination.itemId || active.item.category !== destination.category
    || !isPortfolioTargetReady(active.article)
    || active.article.getAnimations().some((animation) => animation.playState === 'running')) return null;
  return destination.kind === 'category' ? active.categoryButton
    : active.article.querySelector<HTMLElement>('[data-agent-experiment-heading]');
}

/** 수동으로 선택을 바꾼 뒤에도 낡은 작품 해시를 현재 화면이라고 보고하지 않는다. */
export function readAgentExperimentAnchor(anchor: string,
  dom: Pick<Document, 'getElementById'> = document): string | null {
  const destination = agentExperimentViewTargetForAnchor(anchor);
  if (!destination || destination.kind === 'intro') return anchor;
  const active = readActiveAgentExperiment(dom);
  if (!active) return null;
  return destination.kind === 'category' ? AGENT_EXPERIMENT_CATEGORY_ANCHORS[active.item.category] : active.item.id;
}

/** 자동 스크롤 자체를 제외한 목표의 문서 좌표·크기가 잠깐 안정됐는지 확인한다. */
export function createTargetLayoutStabilityCheck(minimumStableMs = 100) {
  let previous: { target: HTMLElement; geometry: number[]; since: number } | undefined;
  return (target: HTMLElement | null, now: number, scrollTop: number, viewportWidth = 0, viewportHeight = 0): boolean => {
    if (!target) { previous = undefined; return false; }
    const rect = target.getBoundingClientRect();
    const geometry = [rect.top + scrollTop, rect.left, rect.width, rect.height, viewportWidth, viewportHeight];
    if (!geometry.every(Number.isFinite)) return false;
    if (!previous || previous.target !== target
      || geometry.some((value, index) => Math.abs(value - previous!.geometry[index]) > 1)) {
      previous = { target, geometry, since: now };
      return false;
    }
    return now - previous.since >= minimumStableMs;
  };
}
