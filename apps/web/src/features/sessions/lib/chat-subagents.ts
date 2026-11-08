import type {
  ChatStep,
  ChatSubagent,
  ChatToolCall,
  ChatTurn,
} from '@oppenheimer/frontend-consumer';
import { firstLine } from './chat-blocks';

/**
 * How a subagent row reads its call: how the subagent stands, what it is
 * doing now, how it ended. A call whose subagent the host did not send (an
 * older host, Grok, a bot) reads the same off the call alone.
 */
export type SubagentRowState = 'running' | 'completed' | 'failed' | 'stopped';

/**
 * How the subagent stands: its own word when the host sent it, else the
 * call's. A call that failed failed its subagent, whatever it last said.
 */
export function subagentStateOf(call: ChatToolCall): SubagentRowState {
  if (call.status === 'failed') return 'failed';
  if (call.subagent) return call.subagent.state;
  return call.status === 'running' ? 'running' : 'completed';
}

/** The call it is making now, the newest one still open. */
export function subagentActivityOf(subagent: ChatSubagent | null): ChatToolCall | null {
  if (!subagent) return null;
  for (let index = subagent.steps.length - 1; index >= 0; index -= 1) {
    const step = subagent.steps[index];
    if (step?.kind === 'tool' && step.call.status === 'running') return step.call;
  }
  return null;
}

/** How it ended, in a line: its call's answer, else the last thing it said. */
export function subagentOutcomeOf(call: ChatToolCall): string | null {
  const answer = firstLine(call.output);
  // Codex's `spawn_agent` answers with the new thread, not with an outcome.
  if (answer && !answer.startsWith('{')) return answer;
  const said = [...(call.subagent?.steps ?? [])]
    .reverse()
    .find((step): step is Extract<ChatStep, { kind: 'reply' }> => step.kind === 'reply');
  return firstLine(said?.text ?? null);
}

/** When it started, and when it was last heard from, for its clock. */
export function subagentSpanOf(call: ChatToolCall): { from: Date | null; to: Date | null } {
  const from = call.subagent?.startedAt ?? call.startedAt;
  const to = call.subagent?.lastAt ?? call.finishedAt;
  return { from, to };
}

/** Its steps as a turn of their own, for the chat's blocks: open while it works. */
export function subagentTurnOf(subagent: ChatSubagent, running: boolean): ChatTurn {
  return {
    id: subagent.id,
    prompt: null,
    steps: subagent.steps,
    model: subagent.model,
    contextTokens: subagent.tokens,
    startedAt: subagent.startedAt,
    lastAt: subagent.lastAt,
    working: running,
  };
}
