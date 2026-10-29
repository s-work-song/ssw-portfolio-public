'use client';

import type { KeyboardEvent } from 'react';
import { aiWorkflowStages, type AiWorkflowStageId } from '@/features/ai-workflow/data/aiWorkflow';
import { workflowStageIndexForKey } from '../navigation/workflowStageNavigation';
import styles from '../../../app/about-me/ai-workflow/AiWorkflow.module.css';

interface WorkflowStageNavProps {
  currentStageId: AiWorkflowStageId;
  onSelect: (id: AiWorkflowStageId) => void;
  position?: 'top' | 'bottom';
}

/** 기존 단계 카드 모양을 유지한 탭 선택 버튼입니다. */
export default function WorkflowStageNav({ currentStageId, onSelect, position = 'top' }: WorkflowStageNavProps) {
  const tabIdPrefix = position === 'top' ? 'workflow-tab' : 'workflow-bottom-tab';
  const label = position === 'top' ? 'SI 활용 단계 선택' : '본문 아래 SI 활용 단계 선택';

  function navigateByKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const next = workflowStageIndexForKey(event.key, index);
    if (next === null) return;
    event.preventDefault();
    const stage = aiWorkflowStages[next];
    document.getElementById(`${tabIdPrefix}-${stage.id}`)?.focus({ preventScroll: true });
    onSelect(stage.id);
  }

  return (
    <nav aria-label={label} className={styles.jumpNav}>
      <ol role="tablist" aria-label={label} aria-orientation="horizontal">
        {aiWorkflowStages.map((stage, index) => {
          const current = stage.id === currentStageId;
          return (
            <li key={stage.id} role="presentation">
              <button type="button" role="tab" id={`${tabIdPrefix}-${stage.id}`}
                aria-controls={`workflow-${stage.id}`} aria-selected={current}
                aria-current={current ? 'step' : undefined} tabIndex={current ? 0 : -1}
                onClick={() => onSelect(stage.id)} onKeyDown={(event) => navigateByKey(event, index)}>
                <span className={styles.jumpNumber}>{stage.number}</span>
                <span className={styles.jumpCopy}>
                  <span>{stage.shortTitle}</span>
                  <span className={styles.jumpDescription}>{stage.navDescription}</span>
                </span>
                {current
                  ? <span className={styles.jumpCurrent}>현재 단계</span>
                  : <span className={styles.jumpArrow} aria-hidden="true">↗</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
