import type { CloudAgentProviderId, CloudAgentStatus } from '@oppenheimer/shared';

/** What a vendor says about an agent's latest run. */
export interface CloudAgentRunState {
  runId: string;
  status: CloudAgentStatus;
  /** The branch the agent pushed, once it pushed one. */
  branch: string | null;
  pullRequestUrl: string | null;
  /** The agent's last reply, once the run ended. */
  summary: string | null;
}

/** Who a vendor key is, as the vendor says when it is stored. */
export interface CloudAgentKeyOwner {
  keyName: string;
  email: string | null;
  /** The vendor's id for the account; null for a key that names no person. */
  accountId: string | null;
}

/**
 * What a launch asks for. `id` is ours, the session's, chosen first, so the
 * vendor's agent and the session are one name and a retry names the same agent.
 */
export interface CloudAgentLaunch {
  id: string;
  prompt: string;
  repositoryUrl: string;
  startingRef: string | null;
  model: string | null;
}

/** An agent the vendor started, and its first run. */
export interface LaunchedCloudAgent {
  externalId: string;
  name: string;
  url: string | null;
  run: CloudAgentRunState;
}

export interface CloudAgentModel {
  id: string;
  label: string;
}

/**
 * One vendor that runs coding agents in its cloud
 * (`product/next-steps/cloud-agents.md`). Adding a vendor is a class
 * implementing this, its id in `CLOUD_AGENT_PROVIDERS` (`@oppenheimer/shared`),
 * and its place in `CloudAgentProviderRegistry`'s list in `cloud-agents.module.ts`;
 * the routes, the status the console reads and the console need nothing else.
 *
 * - `availableFor` is cheap (a row read and a config read) and never calls the
 *   vendor: the console asks it on every visit.
 * - `identify` is the one call made with a key that is not stored yet: it says
 *   whose the key is, or throws `CLOUD_AGENTS_005`.
 * - `grantFor` opens the caller's stored key for one call; it throws
 *   `CLOUD_AGENTS_004` when there is none.
 * - Every verb takes the grant and may throw the module's vendor codes
 *   (`CLOUD_AGENTS_005` to `007`, `010`), through its gateway's `UpstreamLimiter`.
 *
 * What a person follows up or stops, they do at the vendor: a cloud session's
 * row opens the agent's own page (`product/next-steps/cloud-agents.md`).
 */
export interface CloudAgentProvider<G = unknown> {
  readonly id: CloudAgentProviderId;
  availableFor(organizationId: string, userId: string): Promise<boolean>;
  identify(apiKey: string): Promise<CloudAgentKeyOwner>;
  grantFor(organizationId: string, userId: string): Promise<G>;
  launch(grant: G, launch: CloudAgentLaunch): Promise<LaunchedCloudAgent>;
  read(grant: G, externalId: string, runId: string): Promise<CloudAgentRunState>;
  models(grant: G): Promise<CloudAgentModel[]>;
  repositories(grant: G): Promise<string[]>;
}
