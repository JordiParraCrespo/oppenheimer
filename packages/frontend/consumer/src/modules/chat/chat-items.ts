import type {
  ChatItemStatus,
  ChatItemTodo,
  ChatToolItem,
} from '@oppenheimer/shared/schemas/chat-item';
import { type ChatToolClass, opensPage } from './chat-tools';

/**
 * Builds a tool call's chat item (`@oppenheimer/shared/schemas/chat-item`)
 * from its classification, whichever chat it came from: the adapters read
 * their own source's call, and this puts it in the one shape.
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
  command?: string | null;
  diff?: { additions: number; deletions: number } | null;
  todos?: readonly ChatItemTodo[] | null;
  plan?: string | null;
  questions?: readonly string[] | null;
  tasks?: number;
  /** The pattern a file search looked for, apart from where. */
  pattern?: string | null;
  path?: string | null;
}

/** A time as the model carries it. */
export function isoOf(at: Date | null | undefined): string | null {
  return at ? at.toISOString() : null;
}

/** `mcp__<server>__<tool>`, split; the whole name as the tool when it is not one. */
function mcpParts(name: string): { server: string; name: string } {
  const match = /^mcp__(.+?)__(.+)$/.exec(name);
  return match ? { server: match[1] ?? '', name: match[2] ?? name } : { server: '', name };
}

export function toolItem(
  tool: Pick<ChatToolClass, 'kind' | 'label' | 'target'>,
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
  switch (tool.kind) {
    case 'command':
      return { type: 'command', ...base, command: detail.command ?? tool.target };
    case 'read':
      return { type: 'file_read', ...base, path: detail.path ?? tool.target };
    case 'search':
      return {
        type: 'file_search',
        ...base,
        pattern: detail.pattern ?? tool.target,
        path: detail.path ?? null,
      };
    case 'edit':
    case 'write':
      return {
        type: 'file_change',
        ...base,
        path: detail.path ?? tool.target,
        kind: tool.kind,
        additions: detail.diff?.additions ?? 0,
        deletions: detail.diff?.deletions ?? 0,
      };
    case 'web': {
      const open = opensPage(call.tool);
      return {
        type: 'web_search',
        ...base,
        action: open ? 'open' : 'search',
        query: open ? null : tool.target,
      };
    }
    case 'todo':
      return { type: 'todo_list', ...base, todos: [...(detail.todos ?? [])] };
    case 'plan':
      return { type: 'plan', ...base, text: detail.plan ?? null };
    case 'question':
      return { type: 'question', ...base, questions: [...(detail.questions ?? [])] };
    case 'agent':
      return { type: 'subagent', ...base, tasks: detail.tasks ?? 1 };
    case 'mcp':
      return { type: 'mcp_tool_call', ...base, ...mcpParts(call.tool) };
    case 'other':
      return { type: 'tool_call', ...base };
  }
}
