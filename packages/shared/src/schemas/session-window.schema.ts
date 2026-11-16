import { z } from 'zod';

/**
 * A session's terminal windows as the console reads them
 * (`GET/POST /sessions/{id}/windows`, `DELETE /sessions/{id}/windows/{window}`):
 * the tmux windows of its session on the host. Window 0 is the agent; 1 and up
 * are the plain shells the session pane's Terminal tab opens in its worktree.
 * Nothing is stored: each read asks the host's runner.
 */

/** One window: its tmux index (what an attach ticket's `window` names), its name, and whether it is the agent's. */
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

/** `POST /sessions/{id}/windows`: the shell it opened, and every window after it. */
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
