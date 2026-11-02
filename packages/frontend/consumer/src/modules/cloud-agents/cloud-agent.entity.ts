import type { CloudAgentProviderId } from '@oppenheimer/shared/schemas/cloud-agent';

/**
 * The reader's keys for the vendors that run a cloud session
 * (`product/next-steps/cloud-agents.md`). A cloud session itself is a session
 * (`SessionEntity`, place `cloud`); this is whether the reader can start one,
 * on which vendors, and on which models.
 */

/** One vendor, and whether the reader can start a cloud session on it. */
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
  /** Whether the reader can start a cloud session on at least one vendor. */
  available: boolean;
  providers: CloudAgentProviderStatus[];
}

export interface CloudAgentModel {
  id: string;
  label: string;
}
