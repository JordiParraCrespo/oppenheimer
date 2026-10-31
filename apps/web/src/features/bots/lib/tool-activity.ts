import {
  type BotMessageEntity,
  type BotToolStep,
  classifyTool,
  toolLine,
} from '@oppenheimer/frontend-consumer';
import type { BotSubagentProgress } from '@oppenheimer/shared/schemas/bot';

/**
 * How the chat words a bot's tool calls (`25-bots.md` §3, the Bots frame's
 * trace): a line per call in plain verbs ("Searched the web for “bun vs
 * node”", "Updated its plan"), never the tools' own names, and, while one
 * runs, what it is doing now ("Searching the web for …"). The words are the
 * caller's (`t()`); this says which kind of call each is and what it was
 * pointed at.
 */

/** What one call did, as the chat says it. */
export type ToolAction =
  /** A web search, run by the provider; `query` is what it searched for. */
  | { kind: 'search'; query: string | undefined }
  /** The bot's to-do list, written again. */
  | { kind: 'plan' }
  /** Subagents run in parallel (`delegate`); `tasks` is how many it handed out. */
  | { kind: 'delegate'; tasks: number }
  /** Any other tool, by its name in words ("Read document") and what it was given. */
  | { kind: 'tool'; label: string; target: string | undefined };

/**
 * What a call did, read from the shared classification of its tool
 * (`classifyTool`, the one the session chat reads Claude Code's tools with):
 * a provider-run web search, the to-do list, `delegate`, or any other tool by
 * its name in words and the first text it was given.
 */
export function toolAction(step: Pick<BotToolStep, 'name' | 'input'>): ToolAction {
  const call = classifyTool(step.name, step.input, 'bot');
  if (call.kind === 'web' && !call.opensPage) {
    return { kind: 'search', query: call.target === null ? undefined : toolLine(call.target) };
  }
  if (call.kind === 'todo') return { kind: 'plan' };
  if (call.kind === 'agent') {
    return {
      kind: 'delegate',
      tasks: Array.isArray(step.input.tasks) ? step.input.tasks.length : 0,
    };
  }
  return {
    kind: 'tool',
    label: call.label,
    target: call.target === null ? undefined : toolLine(call.target),
  };
}

/**
 * The words over calls made together, by kind: a run of one kind says what
 * it did ("Searched the web 3 times"); a kind with no entry, or a mix, says
 * "Used 4 tools".
 */
const GROUP_SUMMARY = {
  search: 'bots.chat.activity.groupSearched',
} as const satisfies Partial<Record<ToolAction['kind'], string>>;

/** The one kind every call in a group shares; nothing for a mix or no calls. */
export function sharedKind(actions: readonly ToolAction[]): ToolAction['kind'] | undefined {
  const kinds = new Set(actions.map((action) => action.kind));
  return kinds.size === 1 ? [...kinds][0] : undefined;
}

/** The translation key for a group of calls' folded line; its `count` is the number of calls. */
export function groupSummary(
  actions: readonly ToolAction[],
): (typeof GROUP_SUMMARY)[keyof typeof GROUP_SUMMARY] | 'bots.chat.activity.group' {
  const kind = sharedKind(actions);
  return kind !== undefined && kind in GROUP_SUMMARY
    ? GROUP_SUMMARY[kind as keyof typeof GROUP_SUMMARY]
    : 'bots.chat.activity.group';
}

/**
 * What a running call is doing, as the turn's live line says it: the
 * translation key for its kind and what the words take ("Searching the web
 * for …", "Running 3 subagents", "Using Get session"). A new kind's words
 * are a case here.
 */
export function liveWords(action: ToolAction) {
  switch (action.kind) {
    case 'search':
      return action.query
        ? ({ key: 'bots.chat.activity.searchingFor', values: { query: action.query } } as const)
        : ({ key: 'bots.chat.activity.searching', values: {} } as const);
    case 'plan':
      return { key: 'bots.chat.activity.planning', values: {} } as const;
    case 'delegate':
      return { key: 'bots.chat.activity.delegating', values: { count: action.tasks } } as const;
    case 'tool':
      return { key: 'bots.chat.activity.using', values: { name: action.label } } as const;
  }
}

/**
 * What the turn's live line says, as a translation key and what its words
 * take: Waiting while it queues; a running `delegate` call whose children
 * have started ending, with how many are done; what the running call is
 * doing; Writing while its words stream; Thinking otherwise.
 */
export function liveLabel({
  queued,
  step,
  subagents,
  writing,
}: {
  queued: boolean;
  step: BotToolStep | undefined;
  subagents: readonly BotSubagentProgress[] | undefined;
  writing: boolean;
}) {
  if (queued) return { key: 'bots.chat.turn.queued', values: {} } as const;
  const done = (subagents ?? []).filter(
    (run) => run.state !== 'queued' && run.state !== 'running',
  ).length;
  if (subagents && done > 0) {
    return {
      key: 'bots.chat.activity.delegatingDone',
      values: { count: subagents.length, done },
    } as const;
  }
  if (step) return liveWords(toolAction(step));
  return writing
    ? ({ key: 'bots.chat.turn.writing', values: {} } as const)
    : ({ key: 'bots.chat.turn.thinking', values: {} } as const);
}

/** The call still running in a turn's work, if one is: the last with no output yet. */
export function runningStep(answer: readonly BotMessageEntity[]): BotToolStep | undefined {
  const steps = answer.flatMap((message) => (message.role === 'activity' ? message.steps : []));
  return [...steps].reverse().find((step) => step.output === null);
}

/** A call's output for reading: JSON indented, anything else as it came. */
export function readableOutput(output: string): string {
  const text = output.trim();
  if (!text.startsWith('{') && !text.startsWith('[')) return output;
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return output;
  }
}
