import {
  type CloudAgentProviderId,
  type CloudAgentStatus,
  cloudAgentIsActive,
} from '@oppenheimer/shared/schemas/cloud-agent';

/**
 * A coding agent running in a vendor's cloud (`product/next-steps/cloud-agents.md`),
 * as the console draws it: what it was asked, where, and what the vendor last
 * said about its latest run.
 */
export class CloudAgentEntity {
  constructor(
    readonly id: string,
    readonly provider: CloudAgentProviderId,
    /** The vendor's own id for the agent. */
    readonly externalId: string,
    /** The agent's page at the vendor; null when the vendor gave none. */
    readonly url: string | null,
    readonly name: string,
    readonly prompt: string,
    readonly repositoryUrl: string,
    /** Null started from the repository's default branch. */
    readonly startingRef: string | null,
    /** Null runs on the vendor's own default. */
    readonly model: string | null,
    readonly autoCreatePr: boolean,
    readonly status: CloudAgentStatus,
    readonly branch: string | null,
    readonly pullRequestUrl: string | null,
    /** The agent's last reply, once its latest run ended. */
    readonly summary: string | null,
    /** When the vendor was last asked about the run. */
    readonly syncedAt: Date,
    readonly createdAt: Date,
  ) {}

  /** Whether its run may still change on its own: the console keeps asking while it does. */
  get isActive(): boolean {
    return cloudAgentIsActive(this.status);
  }

  /** `owner/name` of a GitHub URL, the URL itself for anything else. */
  get repositoryName(): string {
    return repositoryNameOf(this.repositoryUrl);
  }
}

/** `owner/name` of a GitHub repository URL, the URL itself for anything else. */
export function repositoryNameOf(url: string): string {
  const match = /^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(url);
  return match ? match[1] : url;
}

/** One vendor, and whether the reader can launch on it. */
export interface CloudAgentProviderStatus {
  id: CloudAgentProviderId;
  label: string;
  connected: boolean;
  keyName: string | null;
  keyHint: string | null;
  accountEmail: string | null;
  connectedAt: Date | null;
}

/** `GET /cloud-agents/status`. */
export interface CloudAgentStatusEntity {
  /** Whether this server can keep a vendor key at all. */
  configured: boolean;
  /** Whether the reader can launch on at least one vendor. */
  available: boolean;
  providers: CloudAgentProviderStatus[];
}

export interface CloudAgentModel {
  id: string;
  label: string;
}
