import { z } from 'zod';
import { codingAgentSchema, promptSchema } from './primitives.js';
import { sessionLaunchSchema } from './session.schema.js';

/**
 * A session's terminal windows as the console reads them
 * (`GET/POST /sessions/{id}/windows`, `DELETE /sessions/{id}/windows/{window}`):
 * the tmux windows of its session on the host. Window 0 is the agent; 1 and up
 * are the plain shells, or the second agents, the session pane opens in its
 * worktree. Nothing is stored: each read asks the host's runner.
 */

/**
 * One window: its tmux index (what an attach ticket's `window` names), its
 * name, and whether it is the session's agent. Only window 0 is: a second
 * agent opened in a window is named by its catalog id and is not the one the
 * session's state is read from.
 */
export const sessionTerminalWindowSchema = z.object({
  index: z.number().int().min(0),
  name: z.string(),
  agent: z.boolean(),
});

export type SessionTerminalWindow = z.infer<typeof sessionTerminalWindowSchema>;

/** Whether the host answered: `host_offline` and `not_supported` come with no windows. */
export const sessionWindowsStateSchema = z.enum(['listed', 'host_offline', 'not_supported']);

export type SessionWindowsState = z.infer<typeof sessionWindowsStateSchema>;

/** `GET /sessions/{id}/windows`. */
export const sessionWindowsResponseSchema = z.object({
  state: sessionWindowsStateSchema,
  windows: z.array(sessionTerminalWindowSchema),
});

export type SessionWindowsResponse = z.infer<typeof sessionWindowsResponseSchema>;

/**
 * A coding agent a session can start in a window of its own worktree, beside
 * the agent in window 0: every catalog agent but `shell`, which is what a
 * window without one already is.
 */
export const sessionWindowAgentSchema = codingAgentSchema.exclude(['shell']);

export type SessionWindowAgent = z.infer<typeof sessionWindowAgentSchema>;

/**
 * `POST /sessions/{id}/windows`: a plain shell, or with `agent` that coding
 * agent started in the new window. `model`, `effort` and `permission` are how
 * it starts, the fields and bounds of a new session's launch, and `prompt`
 * its first task; all four mean something only with `agent`. Each one absent is the session's own: its
 * permission level always, its model and effort only when `agent` is the
 * session's agent.
 */
export const openSessionWindowBodySchema = sessionLaunchSchema.extend({
  agent: sessionWindowAgentSchema.optional(),
  /**
   * The agent's first task, bounded as a new session's (trimmed, 2 KB of
   * UTF-8), and meaningful only with `agent`: the host starts the agent on it.
   */
  prompt: promptSchema.optional(),
});

export type OpenSessionWindowBody = z.infer<typeof openSessionWindowBodySchema>;

/** `POST /sessions/{id}/windows`: the window it opened, and every window after it. */
export const openedSessionWindowResponseSchema = z.object({
  window: sessionTerminalWindowSchema,
  windows: z.array(sessionTerminalWindowSchema),
});

export type OpenedSessionWindowResponse = z.infer<typeof openedSessionWindowResponseSchema>;

/** `DELETE /sessions/{id}/windows/{window}`: the windows left. */
export const closedSessionWindowResponseSchema = z.object({
  windows: z.array(sessionTerminalWindowSchema),
});

export type ClosedSessionWindowResponse = z.infer<typeof closedSessionWindowResponseSchema>;
