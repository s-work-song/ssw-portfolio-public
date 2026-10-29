import { aiWorkflowStages, type AiWorkflowStageId } from '../data/aiWorkflow.ts';

export function workflowStageFromHash(hash: string): AiWorkflowStageId {
  for (const stage of aiWorkflowStages) {
    if ([`#workflow-${stage.id}`, `#workflow-header-${stage.id}`, `#example-${stage.id}`].includes(hash)) return stage.id;
  }
  if (hash === '#workflow-tools-gallery-title') return 'tools';
  if (hash === '#workflow-tool-group-mcp' || hash === '#workflow-tool-group-cli') return 'tools';
  if (/^#story-orchestration(?:-(?:sessions|pre-notice|coordination))?$/u.test(hash)) return 'orchestration';
  return 'chat';
}

export function workflowStageIndexFromHash(hash: string): number {
  return aiWorkflowStages.findIndex(({ id }) => id === workflowStageFromHash(hash));
}

export function workflowStageIndexForKey(key: string, index: number): number | null {
  const count = aiWorkflowStages.length;
  if (key === 'ArrowLeft') return (index - 1 + count) % count;
  if (key === 'ArrowRight') return (index + 1) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}
