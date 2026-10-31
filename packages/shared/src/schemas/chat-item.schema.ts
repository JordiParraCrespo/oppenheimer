import { z } from 'zod';

/**
 * One chat item model for every conversation the console draws
 * (`product/next-steps/0.7-terminal-and-chat.md`): a bot's chat and a coding
 * agent's session transcript read into the same turns of typed items.
 *
 * The shape is Codex's app-server protocol made small (thread → turn → item,
 * each item `in_progress` until its completed form, which is authoritative
 * over anything streamed before it) with Grok's habit of typing a tool call
 * by what it does (a search card, a file card) rather than by the tool's
 * name. A turn is what one message of yours started; its items are what
 * happened in it, in order. Times are ISO strings, null when the source did
 * not record one.
 */

export const CHAT_ITEM_STATUSES = ['in_progress', 'completed', 'failed'] as const;
export const chatItemStatusSchema = z.enum(CHAT_ITEM_STATUSES);
export type ChatItemStatus = z.infer<typeof chatItemStatusSchema>;

const at = z.string().datetime().nullable();

const itemBase = {
  id: z.string().min(1),
  status: chatItemStatusSchema,
  startedAt: at,
  completedAt: at,
};

/** What a tool call carries whatever it is: the tool's own name, its words, and its result. */
const callBase = {
  ...itemBase,
  /** The tool as the agent named it (`Bash`, `mcp__github__get_issue`, `start_session`). */
  tool: z.string().min(1),
  /** The tool in words, for a call the chat has no verb for. */
  label: z.string(),
  /** What it acted on, in a line: a path, a command, a pattern, a URL; null when it says none. */
  target: z.string().nullable(),
  /** What it returned, as text; null while it runs or when it returned nothing. */
  output: z.string().nullable(),
};

export const chatTodoSchema = z.object({
  text: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed']),
});
export type ChatItemTodo = z.infer<typeof chatTodoSchema>;

export const chatItemSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('user_message'),
    ...itemBase,
    text: z.string(),
    /** How many images or documents came with it. */
    attachments: z.number().int().min(0),
  }),
  z.object({ type: z.literal('agent_message'), ...itemBase, text: z.string() }),
  z.object({ type: z.literal('reasoning'), ...itemBase, text: z.string() }),
  z.object({
    type: z.literal('command'),
    ...callBase,
    command: z.string().nullable(),
  }),
  z.object({ type: z.literal('file_read'), ...callBase, path: z.string().nullable() }),
  z.object({
    type: z.literal('file_search'),
    ...callBase,
    pattern: z.string().nullable(),
    path: z.string().nullable(),
  }),
  z.object({
    type: z.literal('file_change'),
    ...callBase,
    path: z.string().nullable(),
    kind: z.enum(['edit', 'write']),
    additions: z.number().int().min(0),
    deletions: z.number().int().min(0),
  }),
  z.object({
    type: z.literal('web_search'),
    ...callBase,
    /** A search for words, or a page opened by its URL (Codex's `search` / `openPage`). */
    action: z.enum(['search', 'open']),
    query: z.string().nullable(),
  }),
  /** The agent's task list, written whole each time (Claude's `TodoWrite`, Codex's plan update). */
  z.object({ type: z.literal('todo_list'), ...callBase, todos: z.array(chatTodoSchema) }),
  /** A plan the agent proposes before it works (`ExitPlanMode`, Codex's plan item). */
  z.object({ type: z.literal('plan'), ...callBase, text: z.string().nullable() }),
  /** Questions the agent stopped on for you (`AskUserQuestion`, a bot's `ask_user`). */
  z.object({
    type: z.literal('question'),
    ...callBase,
    questions: z.array(z.string()),
  }),
  z.object({
    type: z.literal('mcp_tool_call'),
    ...callBase,
    server: z.string(),
    name: z.string(),
  }),
  /** A tool the chat has no card for: a bot's own (Codex's dynamic tool) or one it does not know. */
  z.object({ type: z.literal('tool_call'), ...callBase }),
  /** Work handed to subagents (`Task`, a bot's `delegate`); `tasks` is how many. */
  z.object({
    type: z.literal('subagent'),
    ...callBase,
    tasks: z.number().int().min(0),
  }),
  /** Something that happened in the conversation that nobody said: a stop, a compaction, a task ending. */
  z.object({
    type: z.literal('event'),
    ...itemBase,
    event: z.enum(['interrupted', 'compacted', 'task_ended', 'notice']),
    text: z.string().nullable(),
  }),
]);
export type ChatItem = z.infer<typeof chatItemSchema>;
export type ChatItemType = ChatItem['type'];

/** The item types that are tool calls: each has `tool`, `label`, `target` and `output`. */
export const CHAT_TOOL_ITEM_TYPES = [
  'command',
  'file_read',
  'file_search',
  'file_change',
  'web_search',
  'todo_list',
  'plan',
  'question',
  'mcp_tool_call',
  'tool_call',
  'subagent',
] as const satisfies readonly ChatItemType[];
export type ChatToolItemType = (typeof CHAT_TOOL_ITEM_TYPES)[number];
export type ChatToolItem = Extract<ChatItem, { type: ChatToolItemType }>;

export const CHAT_TURN_STATUSES = [
  'queued',
  'in_progress',
  'completed',
  'interrupted',
  'failed',
] as const;
export const chatTurnStatusSchema = z.enum(CHAT_TURN_STATUSES);
export type ChatTurnStatus = z.infer<typeof chatTurnStatusSchema>;

export const chatItemTurnSchema = z.object({
  id: z.string().min(1),
  status: chatTurnStatusSchema,
  startedAt: at,
  completedAt: at,
  items: z.array(chatItemSchema),
});
export type ChatItemTurn = z.infer<typeof chatItemTurnSchema>;
