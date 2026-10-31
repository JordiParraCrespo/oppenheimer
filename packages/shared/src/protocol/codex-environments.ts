import { z } from 'zod/v4';
import { FIELD_BOUNDS, PRINTABLE_PATTERN } from '../schemas/primitives.js';
import { commandIdSchema, gitRefSchema } from './primitives.js';

/**
 * Codex cloud environments on the link (`product/next-steps/cloud-agents.md`,
 * "Which Codex environment"): what the composer's picker lists for a Codex
 * cloud session, read by the host with its own ChatGPT sign-in. Part of
 * `protocolMessageSchema`, which is where every kind is listed.
 */

/** How many environments one `codex.environments` names at most. */
export const CODEX_ENVIRONMENTS_MAX = 100;

/**
 * A Codex environment as `codex cloud exec --env` takes it: its id, or its
 * label, which the CLI matches without regard to case. Printable text only; the
 * runner passes it as `--env=<value>`, so a leading dash is no flag.
 */
export const codexEnvironmentRefSchema = z
  .string()
  .trim()
  .min(FIELD_BOUNDS.codexEnvironment.min)
  .max(FIELD_BOUNDS.codexEnvironment.max)
  .regex(PRINTABLE_PATTERN);

/**
 * The Codex environments the host's ChatGPT account can start a task in,
 * those linked to `repository` (`owner/name`) marked. Sent only to a runner
 * whose hello named `codex.environments`; answered by `codex.environments`
 * with the same `commandId`, or by `command.failed` (`SESS_009` Codex could
 * not answer: no CLI, no sign-in).
 */
export const codexEnvironmentsListSchema = z.object({
  type: z.literal('codex.environments.list'),
  commandId: commandIdSchema,
  repository: gitRefSchema,
});

export type CodexEnvironmentsListMessage = z.infer<typeof codexEnvironmentsListSchema>;

/** One Codex environment, as its account lists it. */
export const codexEnvironmentSchema = z.object({
  id: codexEnvironmentRefSchema,
  /** The name its owner gave it on chatgpt.com/codex; absent when it has none. */
  label: z.string().max(200).optional(),
  /** Pinned on chatgpt.com/codex: the one Codex itself picks first. */
  pinned: z.boolean(),
  /** Linked to the repository the list was asked for. */
  repository: z.boolean(),
});

export type CodexEnvironment = z.infer<typeof codexEnvironmentSchema>;

/**
 * The environments, those linked to the repository first, then pinned, then
 * by label. `recommended` is the id the runner starts a task in when the
 * create names none: the only linked one, else the pinned linked one, else
 * the linked one with the most tasks, as Codex's own picker chooses; absent
 * when none is linked. `source` says where the list came from: `chatgpt`,
 * the account's environments as chatgpt.com lists them, or `tasks`, only those
 * the account's recent tasks ran in, when the host could not ask ChatGPT.
 */
export const codexEnvironmentsSchema = z.object({
  type: z.literal('codex.environments'),
  commandId: commandIdSchema,
  environments: z.array(codexEnvironmentSchema).max(CODEX_ENVIRONMENTS_MAX),
  recommended: codexEnvironmentRefSchema.optional(),
  source: z.enum(['chatgpt', 'tasks']),
});

export type CodexEnvironmentsMessage = z.infer<typeof codexEnvironmentsSchema>;
