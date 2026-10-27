import { z } from 'zod';

/**
 * Cloud agents (`product/next-steps/cloud-agents.md`): a coding agent that
 * runs in a vendor's cloud, launched and followed from the console, beside
 * the sessions on a person's own hosts.
 */

/**
 * The vendors a cloud agent can run on. A new one adds its id here and a
 * `CloudAgentProvider` in `apps/api/src/cloud-agents/application/`; nothing
 * else in this package changes.
 */
export const CLOUD_AGENT_PROVIDERS = ['cursor'] as const;
export type CloudAgentProviderId = (typeof CLOUD_AGENT_PROVIDERS)[number];
export const cloudAgentProviderSchema = z.enum(CLOUD_AGENT_PROVIDERS);

/** What each provider is called on screen. */
export const CLOUD_AGENT_PROVIDER_LABELS: Readonly<Record<CloudAgentProviderId, string>> =
  Object.freeze({ cursor: 'Cursor' });

/**
 * Where a cloud agent's latest run stands. `starting` and `running` are
 * still moving; the other four are where a run ends, and a follow-up starts
 * the agent again.
 */
export const CLOUD_AGENT_STATUSES = [
  'starting',
  'running',
  'finished',
  'failed',
  'cancelled',
  'expired',
] as const;
export type CloudAgentStatus = (typeof CLOUD_AGENT_STATUSES)[number];

/** Whether a run in `status` may still change on its own. */
export function cloudAgentIsActive(status: CloudAgentStatus): boolean {
  return status === 'starting' || status === 'running';
}

/** A provider key's length bounds: wide enough for every vendor's format. */
export const CLOUD_AGENT_KEY_MIN = 8;
export const CLOUD_AGENT_KEY_MAX = 512;
/** The longest prompt a launch or a follow-up carries. */
export const CLOUD_AGENT_PROMPT_MAX = 20_000;

/** `PUT /cloud-agents/providers/:provider/credential`: the caller's key, replacing theirs. Never read back. */
export const putCloudAgentCredentialSchema = z.object({
  apiKey: z.string().trim().min(CLOUD_AGENT_KEY_MIN).max(CLOUD_AGENT_KEY_MAX),
});
export type PutCloudAgentCredentialDto = z.infer<typeof putCloudAgentCredentialSchema>;

const promptSchema = z.string().trim().min(1).max(CLOUD_AGENT_PROMPT_MAX);

/**
 * `POST /cloud-agents`: what to do, in which repository, from which branch
 * or tag, on which model. No model is the vendor's own default; no starting
 * ref is the repository's default branch.
 */
export const launchCloudAgentSchema = z.object({
  provider: cloudAgentProviderSchema,
  prompt: promptSchema,
  repositoryUrl: z
    .string()
    .trim()
    .url()
    .max(500)
    .regex(/^https:\/\//),
  startingRef: z.string().trim().min(1).max(255).optional(),
  model: z.string().trim().min(1).max(100).optional(),
  /** Open a pull request when the agent finishes, rather than leave a branch. */
  autoCreatePr: z.boolean().default(false),
});
export type LaunchCloudAgentDto = z.infer<typeof launchCloudAgentSchema>;
/** What a launch form holds before the schema fills its defaults. */
export type LaunchCloudAgentInput = z.input<typeof launchCloudAgentSchema>;

/** `POST /cloud-agents/:id/follow-ups`: the next instruction, as a new run on the same agent. */
export const followUpCloudAgentSchema = z.object({
  prompt: promptSchema,
});
export type FollowUpCloudAgentDto = z.infer<typeof followUpCloudAgentSchema>;
