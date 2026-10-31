import type { CodexEnvironmentsMessage } from '@oppenheimer/shared/protocol';

/** A host's Codex cloud environments as its runner listed them (`codex.environments` without its envelope). */
export type HostCodexEnvironments = Omit<CodexEnvironmentsMessage, 'type' | 'commandId'>;

/**
 * What asking a host for its Codex environments came back with: the list, the
 * reason nothing was asked (no link, or a runner that does not list them), no
 * answer in time, or the runner's refusal with its catalog code.
 */
export type HostCodexEnvironmentsOutcome =
  | { kind: 'listed'; listing: HostCodexEnvironments }
  | { kind: 'host_offline' }
  | { kind: 'not_supported' }
  | { kind: 'timed_out' }
  | { kind: 'failed'; code: string; detail?: string };

/**
 * What the module that owns the runner link implements so the composer can
 * offer a Codex cloud session's environments (`product/next-steps/cloud-agents.md`,
 * "Which Codex environment"). Like `HostFoldersPort` it waits for the runner's
 * answer, and nothing is cached: the host reads them with its own ChatGPT
 * sign-in, which the control plane never holds.
 */
export interface HostCodexEnvironmentsPort {
  /** The environments of the host's ChatGPT account, those linked to `repository` marked. */
  list(hostId: string, repository: string): Promise<HostCodexEnvironmentsOutcome>;
}
