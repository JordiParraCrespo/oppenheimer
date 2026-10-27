import { z } from 'zod';

/**
 * Cloud agents (`product/next-steps/cloud-agents.md`): a coding agent that
 * runs in a vendor's cloud rather than on a person's host. Started from New
 * session, it is a session like any other, in the place `cloud`
 * (`session.schema.ts`); this file is the vendors' half: who runs it, the
 * person's key for them, and what a run reports.
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
 * The coding agents that run only in a vendor's cloud, never on a host, so
 * they are not in the runner's launch catalog (`../agents/catalog`). A session
 * on one names it as its `agent`, as a host session names `claude-code`.
 */
export const CLOUD_AGENT_IDS = ['cursor'] as const;
export type CloudAgentId = (typeof CLOUD_AGENT_IDS)[number];

/** The agent each provider runs. A provider that ran a host agent too would name it here. */
export const CLOUD_PROVIDER_AGENT: Readonly<Record<CloudAgentProviderId, CloudAgentId>> =
  Object.freeze({ cursor: 'cursor' });

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

/** `PUT /cloud-agents/providers/:provider/credential`: the caller's key, replacing theirs. Never read back. */
export const putCloudAgentCredentialSchema = z.object({
  apiKey: z.string().trim().min(CLOUD_AGENT_KEY_MIN).max(CLOUD_AGENT_KEY_MAX),
});
export type PutCloudAgentCredentialDto = z.infer<typeof putCloudAgentCredentialSchema>;
