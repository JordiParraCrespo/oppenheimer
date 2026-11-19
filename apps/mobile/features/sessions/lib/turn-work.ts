import type { ChatTurn } from '@oppenheimer/frontend-consumer';

/**
 * What a turn did between the prompt and its words, for the line that folds
 * it: the tool calls and thoughts (each a step), and how long it took, from
 * its first line to its last. None when the turn only answered in words.
 */
export function workOf(turn: ChatTurn): { steps: number; ms: number | null } | null {
  const steps = turn.steps.filter(
    (step) => step.kind === 'tool' || step.kind === 'thinking',
  ).length;
  if (steps === 0) return null;
  const from = turn.prompt?.at ?? turn.startedAt;
  const to = turn.lastAt;
  return { steps, ms: from && to ? to.getTime() - from.getTime() : null };
}
