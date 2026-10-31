import type {
  ChatItemStatus,
  ChatItemTodo,
  ChatToolItem,
} from '@oppenheimer/shared/schemas/chat-item';
import type { ChatToolClass, ChatToolKind } from './chat-tools';

/**
 * Builds a tool call's chat item (`@oppenheimer/shared/schemas/chat-item`)
 * from its classification, whichever chat it came from: the adapters read
 * their own source's call and what only it carries, and this puts them in
 * the one shape, a builder per kind.
 */

/** What every call has, read off its source. */
export interface ToolItemCall {
  id: string;
  /** The tool as the agent named it. */
  tool: string;
  status: ChatItemStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  output: string | null;
}

/** What only some kinds carry, when the source has it. */
export interface ToolItemDetail {
  diff?: { additions: number; deletions: number } | null;
  todos?: readonly ChatItemTodo[] | null;
  plan?: string | null;
  questions?: readonly string[] | null;
  /** How many subagents a call handed work to; one when the source does not say. */
  tasks?: number;
}

/** The part of a classification an item is built from. */
export type ToolItemClass = Pick<ChatToolClass, 'kind' | 'label' | 'target' | 'opensPage'>;

/** A time as the model carries it. */
export function isoOf(at: Date | null | undefined): string | null {
  return at ? at.toISOString() : null;
}

type Base = Extract<ChatToolItem, { type: 'tool_call' }>;

type Builder<K extends ChatToolKind> = (
  base: Omit<Base, 'type'>,
  tool: ToolItemClass & { kind: K },
  detail: ToolItemDetail,
) => ChatToolItem;

/** `mcp__<server>__<tool>`, split; the whole name as the tool when it is not one. */
function mcpParts(name: string): { server: string; name: string } {
  const match = /^mcp__(.+?)__(.+)$/.exec(name);
  return match ? { server: match[1] ?? '', name: match[2] ?? name } : { server: '', name };
}

/** One builder per kind: the item type it makes and where each of its fields comes from. */
const BUILDERS: { [K in ChatToolKind]: Builder<K> } = {
  // The command is what the call was aimed at.
  command: (base, tool) => ({ type: 'command', ...base, command: tool.target }),
  read: (base, tool) => ({ type: 'file_read', ...base, path: tool.target }),
  // A search is aimed at its pattern; where it looked is not kept apart.
  search: (base, tool) => ({ type: 'file_search', ...base, pattern: tool.target, path: null }),
  edit: (base, tool, detail) => fileChange(base, tool, detail),
  write: (base, tool, detail) => fileChange(base, tool, detail),
  // A page opened is aimed at its URL and has no query.
  web: (base, tool) => ({
    type: 'web_search',
    ...base,
    action: tool.opensPage ? 'open' : 'search',
    query: tool.opensPage ? null : tool.target,
  }),
  todo: (base, _tool, detail) => ({ type: 'todo_list', ...base, todos: [...(detail.todos ?? [])] }),
  plan: (base, _tool, detail) => ({ type: 'plan', ...base, text: detail.plan ?? null }),
  question: (base, _tool, detail) => ({
    type: 'question',
    ...base,
    questions: [...(detail.questions ?? [])],
  }),
  agent: (base, _tool, detail) => ({ type: 'subagent', ...base, tasks: detail.tasks ?? 1 }),
  mcp: (base) => ({ type: 'mcp_tool_call', ...base, ...mcpParts(base.tool) }),
  other: (base) => ({ type: 'tool_call', ...base }),
};

function fileChange(
  base: Omit<Base, 'type'>,
  tool: ToolItemClass & { kind: 'edit' | 'write' },
  detail: ToolItemDetail,
): ChatToolItem {
  return {
    type: 'file_change',
    ...base,
    path: tool.target,
    kind: tool.kind,
    additions: detail.diff?.additions ?? 0,
    deletions: detail.diff?.deletions ?? 0,
  };
}

export function toolItem(
  tool: ToolItemClass,
  call: ToolItemCall,
  detail: ToolItemDetail = {},
): ChatToolItem {
  const base = {
    id: call.id,
    status: call.status,
    startedAt: isoOf(call.startedAt),
    completedAt: isoOf(call.completedAt),
    tool: call.tool,
    label: tool.label,
    target: tool.target,
    output: call.output,
  };
  const build = BUILDERS[tool.kind] as Builder<ChatToolKind>;
  return build(base, tool, detail);
}
