import type { CloudAgentProviderId } from '@oppenheimer/shared';
import type {
  CloudAgentLaunch,
  CloudAgentRunState,
  LaunchedCloudAgent,
} from './cloud-agent-provider.port';

export type { CloudAgentLaunch, CloudAgentRunState, LaunchedCloudAgent };

/**
 * Whose key a call goes out on: the person who launched the session, in its
 * workspace. A session is read by whoever lists it, but its agent lives on
 * its launcher's account at the vendor.
 */
export interface CloudRunOwner {
  organizationId: string;
  userId: string;
}

/**
 * What the sessions module asks a vendor, on the owner's own key: start a
 * cloud session's agent, give it a next instruction, and say where its
 * latest run stands. Published by
 * this module (`CLOUD_RUNS`) so a session never names a vendor's gateway.
 *
 * Each throws this module's codes: `CLOUD_AGENTS_004` with no key stored,
 * `005`–`007` and `010` from the vendor.
 */
export interface CloudRunsPort {
  launch(
    owner: CloudRunOwner,
    provider: CloudAgentProviderId,
    launch: CloudAgentLaunch,
  ): Promise<LaunchedCloudAgent>;
  read(
    owner: CloudRunOwner,
    provider: CloudAgentProviderId,
    externalId: string,
    runId: string,
  ): Promise<CloudAgentRunState>;
  /** A next instruction to the agent, as a new run; `CLOUD_AGENTS_012` while one runs. */
  followUp(
    owner: CloudRunOwner,
    provider: CloudAgentProviderId,
    externalId: string,
    prompt: string,
  ): Promise<CloudAgentRunState>;
}
