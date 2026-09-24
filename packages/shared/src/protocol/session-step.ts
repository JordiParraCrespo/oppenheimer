import { z } from 'zod/v4';

/**
 * What a runner logs while it starts a session, and what the console reads back
 * off the session's log to draw the provisioning steps (01, 05).
 *
 * These are **event payloads**, not link messages: they ride `events.append` as
 * a `kind` and a JSON-string `payload`, and the control plane keeps them without
 * folding them. They live here, beside the messages, so the runner and the
 * console agree on one vocabulary: the Go twin is generated from this file
 * (`scripts/emit-session-step.cjs`), and a payload either side cannot parse is a
 * build failure rather than a step that stays pending forever.
 */

/** The kind a start step is logged as. */
export const SESSION_STEP_EVENT_KIND = 'session.step';

/** The kind a failed start is logged as; its payload is {@link sessionFailedPayloadSchema}. */
export const SESSION_FAILED_EVENT_KIND = 'session.failed';

/** The kind that says every step landed and window 0 is up. */
export const SESSION_STARTED_EVENT_KIND = 'session.started';

/**
 * The steps, in the order the host runs them. `host` is the create frame reaching
 * the runner and being accepted; the other three are the stages of create.
 */
export const SESSION_START_STEPS = ['host', 'clone', 'worktree', 'agent'] as const;

export const sessionStartStepSchema = z.enum(SESSION_START_STEPS);

export type SessionStartStepId = z.infer<typeof sessionStartStepSchema>;

/** A failure is not a status: it is `session.failed`, and the step in hand is the one that failed. */
export const SESSION_STEP_STATUSES = ['running', 'done'] as const;

export const sessionStepStatusSchema = z.enum(SESSION_STEP_STATUSES);

export type SessionStepStatus = z.infer<typeof sessionStepStatusSchema>;

export const sessionStepPayloadSchema = z.object({
  step: sessionStartStepSchema,
  status: sessionStepStatusSchema,
  /** On `done`: how long the step took, measured on the host. */
  durationMs: z.number().int().nonnegative().optional(),
});

export type SessionStepPayload = z.infer<typeof sessionStepPayloadSchema>;

/** What the runner says when a start fails. Both fields are optional: a reason may have neither. */
export const sessionFailedPayloadSchema = z.object({
  /** The host's own words, truncated to 500 characters. */
  detail: z.string().max(500).optional(),
  /** The problem code, when the failure had one (`SESS_004`, `TMUX_001`, …). */
  code: z.string().max(64).optional(),
});

export type SessionFailedPayload = z.infer<typeof sessionFailedPayloadSchema>;
