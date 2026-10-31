import type { ChatItemTodo, ChatToolItemType } from '@oppenheimer/shared/schemas/chat-item';

/**
 * What a tool call is, whichever chat it is in: a coding agent's session
 * transcript or a bot's chat (`product/next-steps/0.7-terminal-and-chat.md`).
 * One table of the tools the chat knows, one rule for MCP names, one rule
 * for what a call was pointed at and one for its name in words, so the two
 * chats never disagree about what `WebSearch` or `TodoWrite` is. The words a
 * chat says are its caller's (`t()`); this says which kind of call it is,
 * which glyph it wears and what it acted on.
 */

/** A tool call's kind: the verb a chat words it with. The tools are classified, never listed. */
export type ChatToolKind =
  | 'command'
  | 'read'
  | 'edit'
  | 'write'
  | 'search'
  | 'web'
  | 'todo'
  | 'agent'
  | 'plan'
  | 'question'
  | 'mcp'
  | 'other';

/** The glyph a call wears, by name: the app holds the icon each name draws. */
export type ChatToolIcon =
  | 'terminal'
  | 'file'
  | 'file-edit'
  | 'file-new'
  | 'search'
  | 'globe'
  | 'todo'
  | 'subagent'
  | 'plan'
  | 'question'
  | 'plug'
  | 'tool';

/**
 * Who defined the tools a call may come from: a coding agent's CLI (Claude
 * Code's `Bash`, `Read`, its MCP servers), or a bot, whose tools are a few
 * built-ins and Oppenheimer's own (`start_session`, `read_document`). It
 * decides only how a tool the table does not know is read.
 */
export type ChatToolOrigin = 'agent' | 'bot';

export interface ChatToolClass {
  kind: ChatToolKind;
  /** The chat item it becomes (`@oppenheimer/shared/schemas/chat-item`). */
  type: ChatToolItemType;
  icon: ChatToolIcon;
  /**
   * The tool in words, for a call the chat has no verb for: a bot's tool as
   * a phrase ("Read document"), a coding agent's as the CLI names it, an MCP
   * server's as `server · tool`.
   */
  label: string;
  /** What it acted on: a path, a command, a pattern, a URL, a query. */
  target: string | null;
  /** A web call that opens a page rather than searching for words. */
  opensPage: boolean;
}

/** The tools the chat knows, by the name each engine gives them. */
const KINDS: Record<string, ChatToolKind> = {
  Bash: 'command',
  BashOutput: 'command',
  KillShell: 'command',
  Read: 'read',
  NotebookRead: 'read',
  Edit: 'edit',
  MultiEdit: 'edit',
  NotebookEdit: 'edit',
  Write: 'write',
  Grep: 'search',
  Glob: 'search',
  LS: 'search',
  WebFetch: 'web',
  WebSearch: 'web',
  // The provider-run web search as the OpenAI engine names it.
  web_search: 'web',
  web_search_preview: 'web',
  TodoWrite: 'todo',
  todo_write: 'todo',
  Task: 'agent',
  Agent: 'agent',
  // A bot's subagents, run in parallel.
  delegate: 'agent',
  ExitPlanMode: 'plan',
  AskUserQuestion: 'question',
};

const PAGE_TOOLS: ReadonlySet<string> = new Set(['WebFetch']);

/** A web call that opens a page by its URL rather than searching for words. */
function opensPage(name: string): boolean {
  return PAGE_TOOLS.has(name);
}

const TYPES: Record<ChatToolKind, ChatToolItemType> = {
  command: 'command',
  read: 'file_read',
  edit: 'file_change',
  write: 'file_change',
  search: 'file_search',
  web: 'web_search',
  todo: 'todo_list',
  agent: 'subagent',
  plan: 'plan',
  question: 'question',
  mcp: 'mcp_tool_call',
  other: 'tool_call',
};

const ICONS: Record<ChatToolKind, ChatToolIcon> = {
  command: 'terminal',
  read: 'file',
  edit: 'file-edit',
  write: 'file-new',
  search: 'search',
  web: 'globe',
  todo: 'todo',
  agent: 'subagent',
  plan: 'plan',
  question: 'question',
  mcp: 'plug',
  other: 'tool',
};

/** The glyph a kind of call wears, on its row and on a group of only that kind. */
export function toolIcon(kind: ChatToolKind): ChatToolIcon {
  return ICONS[kind];
}

/** How an MCP tool's name reaches the chat: `mcp__<server>__<tool>`. */
const MCP_PREFIX = /^mcp__[^_]+(?:_[^_]+)*__/;
/** Oppenheimer's own tool server: Claude Code calls a bot's tools `mcp__oppenheimer__<name>`. */
const OWN_SERVER = 'mcp__oppenheimer__';

/** Where each kind reads what it acted on, in order; the first text wins. */
const TARGET_FIELDS: Partial<Record<ChatToolKind, readonly string[]>> = {
  command: ['command', 'bash_id', 'shell_id'],
  search: ['pattern', 'path'],
  web: ['url', 'query'],
  agent: ['subagent_type', 'description'],
};
const DEFAULT_TARGET_FIELDS = ['file_path', 'notebook_path', 'path', 'url', 'query', 'command'];

const TARGET_MAX = 80;

function textOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/**
 * A tool's name as words: the MCP prefix dropped, `snake_case`, `kebab-case`
 * and `camelCase` split, the first word capitalised ("read_document" and
 * "readDocument" are "Read document").
 */
export function humaniseToolName(name: string): string {
  const words = name
    .replace(MCP_PREFIX, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_\-.]+/)
    .filter(Boolean)
    .map((word) => (/^[A-Z0-9]+$/.test(word) && word.length > 1 ? word : word.toLowerCase()));
  const sentence = words.join(' ');
  return sentence ? sentence.charAt(0).toUpperCase() + sentence.slice(1) : name;
}

/** A text's first line, cut short, for a line that says what a call was pointed at. */
export function toolLine(text: string): string {
  const line = text.trim().split('\n')[0] ?? '';
  return line.length > TARGET_MAX ? `${line.slice(0, TARGET_MAX)}…` : line;
}

/**
 * The first of `keys` the input holds as text, as it was given; none when it
 * holds none of them. Every target and every field a chat reads off a
 * call's input goes through here.
 */
export function fieldOf(
  input: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = textOf(input[key]);
    if (value) return value;
  }
  return null;
}

/** The first text a call was given, whichever field it is in. */
function firstText(input: Readonly<Record<string, unknown>>): string | null {
  return Object.values(input).map(textOf).find(Boolean) ?? null;
}

/**
 * How each origin reads a name: the key the table is looked up by, the kind
 * of a tool the table does not know, what such a tool was pointed at, and a
 * tool's name in words. A coding agent's unknown tool is an MCP server's when
 * its name says so, else one of the CLI's, aimed at a known field and named
 * as the CLI names it. A bot's tools come through Oppenheimer's own server
 * (`mcp__oppenheimer__<name>`, under Claude) or bare (under OpenAI): its
 * unknown tool is one of ours, aimed at the first text it was given and
 * named in words.
 */
interface OriginPolicy {
  key: (name: string) => string;
  unknownKind: (name: string) => 'mcp' | 'other';
  unknownTarget: (input: Readonly<Record<string, unknown>>) => string | null;
  label: (name: string) => string;
}

const ORIGINS: Record<ChatToolOrigin, OriginPolicy> = {
  agent: {
    key: (name) => name,
    unknownKind: (name) => (name.startsWith('mcp__') ? 'mcp' : 'other'),
    unknownTarget: (input) => fieldOf(input, DEFAULT_TARGET_FIELDS),
    label: (name) => name.replace(/^mcp__/, '').replaceAll('__', ' · '),
  },
  bot: {
    key: (name) => (name.startsWith(OWN_SERVER) ? name.slice(OWN_SERVER.length) : name),
    unknownKind: (name) =>
      name.startsWith('mcp__') && !name.startsWith(OWN_SERVER) ? 'mcp' : 'other',
    unknownTarget: firstText,
    label: humaniseToolName,
  },
};

/**
 * What a call is, read off its tool's name and its input: the table's kind
 * and that kind's target fields for a tool it knows, the origin's reading
 * (`ORIGINS`) for one it does not.
 */
export function classifyTool(
  name: string,
  input: Readonly<Record<string, unknown>>,
  origin: ChatToolOrigin,
): ChatToolClass {
  const policy = ORIGINS[origin];
  const key = policy.key(name);
  const known = KINDS[key];
  const kind = known ?? policy.unknownKind(name);
  return {
    kind,
    type: TYPES[kind],
    icon: ICONS[kind],
    label: policy.label(name),
    target:
      known === undefined
        ? policy.unknownTarget(input)
        : fieldOf(input, TARGET_FIELDS[known] ?? DEFAULT_TARGET_FIELDS),
    opensPage: opensPage(key),
  };
}

const TODO_STATUSES: ReadonlySet<unknown> = new Set(['pending', 'in_progress', 'completed']);

/**
 * The task list a to-do call wrote (`TodoWrite`'s `todos`, in both chats),
 * each item's words trimmed and an item with none left out; a status it does
 * not know reads as pending. Empty when the input holds no list.
 */
export function todosOf(value: unknown): ChatItemTodo[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): ChatItemTodo[] => {
    if (typeof raw !== 'object' || raw === null) return [];
    const row = raw as Record<string, unknown>;
    const text = typeof row.content === 'string' ? row.content.trim() : '';
    if (!text) return [];
    const status = TODO_STATUSES.has(row.status)
      ? (row.status as ChatItemTodo['status'])
      : 'pending';
    return [{ text, status }];
  });
}
