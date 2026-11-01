import { z } from 'zod/v4';
import { codexEnvironmentRefSchema, commandIdSchema, gitRefSchema } from './primitives.js';

/**
 * Codex cloud environments on the link (`product/next-steps/cloud-agents.md`,
 * "Which Codex environment"): what the composer's picker lists for a Codex
 * cloud session, read by the host with its own ChatGPT sign-in. Part of
 * `protocolMessageSchema`, which is where every kind is listed.
 */

/** How many environments one `codex.environments` names at most. */
export const CODEX_ENVIRONMENTS_MAX = 100;

/**
 * The Codex environments the host's ChatGPT account can start a task in,
 * those linked to `repository` (`owner/name`) marked; absent, none is. Sent only to a runner
 * whose hello named `codex.environments`; answered by `codex.environments`
 * with the same `commandId`, or by `command.failed` (`SESS_009` Codex could
 * not answer: no CLI, no sign-in).
 */
export const codexEnvironmentsListSchema = z.object({
  type: z.literal('codex.environments.list'),
  commandId: commandIdSchema,
  repository: gitRefSchema.optional(),
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
 * the linked one with the most tasks, as Codex's own picker chooses; with none
 * linked, one labelled with the repository's full name, then its bare name;
 * absent when none is. `source` says where the list came from: `chatgpt`,
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
