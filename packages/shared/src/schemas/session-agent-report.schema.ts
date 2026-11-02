import { z } from 'zod';

/**
 * The agent's own word on what it is doing, as it reported it through OSC
 * 7501, the Program Status Protocol (`product/research/lessons-from-herdr.md`).
 * The runner runs the agent under its `pty` wrapper, which answers the agent's
 * probe and keeps its reports, and sends the latest one as the `program`
 * object of an `agent.observed` entry beside the state it settled on.
 *
 * It is the agent saying it, never a guess from the screen: an observation
 * read off the screen carries none, and the fold clears it. `error` is kept
 * here although the state folds it into `done`, because the console says
 * "ended in an error" rather than "finished".
 */

/** The words a report may use; the protocol defines no others. */
export const SESSION_AGENT_REPORT_STATES = ['idle', 'working', 'done', 'blocked', 'error'] as const;

/** What a blocked agent may say it waits on. */
export const SESSION_AGENT_REPORT_KINDS = ['permission', 'question', 'auth'] as const;

/** The runner's own bound on a decoded title or message, in bytes. */
export const SESSION_AGENT_REPORT_TEXT_MAX = 500;

/** Absent is null: the runner leaves out what the agent did not say. */
const nullableText = z.string().max(SESSION_AGENT_REPORT_TEXT_MAX).nullable().default(null);

export const sessionAgentReportSchema = z.object({
  state: z.enum(SESSION_AGENT_REPORT_STATES),
  kind: z.enum(SESSION_AGENT_REPORT_KINDS).nullable().default(null),
  /** 0–100, on a working or blocked report that said. */
  progress: z.number().int().min(0).max(100).nullable().default(null),
  message: nullableText,
  title: nullableText,
});

export type SessionAgentReportState = (typeof SESSION_AGENT_REPORT_STATES)[number];
export type SessionAgentReportKind = (typeof SESSION_AGENT_REPORT_KINDS)[number];
export type SessionAgentReport = z.infer<typeof sessionAgentReportSchema>;
