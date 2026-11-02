import type { AutomationPausedReason, AutomationSkipReason } from '@oppenheimer/shared/automations';

/**
 * What a refused session create means for a run (§Q5). The owner's access is
 * checked at dispatch by the same command a person's session goes through, so
 * its refusals are the vocabulary: a host the owner can no longer use pauses
 * the automation — it would fail every hour otherwise — and so does a retired
 * project. Anything not listed is not a refusal but a fault, and is retried.
 */
export interface RunRefusal {
  reason: AutomationSkipReason;
  pause: AutomationPausedReason | null;
}

const REFUSALS: Readonly<Record<string, RunRefusal>> = {
  // The host is gone, unpaired, or no longer the owner's.
  HOSTS_001: { reason: 'not_launchable', pause: 'host_unpaired' },
  // The host's runner cannot start the agent, or cannot start it in the cloud.
  SESSIONS_011: { reason: 'agent_unavailable', pause: null },
  SESSIONS_037: { reason: 'agent_unavailable', pause: null },
  // The revision names an agent this build cannot run unattended.
  AUTOMATIONS_005: { reason: 'agent_unavailable', pause: null },
  SESSIONS_006: { reason: 'not_launchable', pause: 'project_archived' },
  PROJECTS_001: { reason: 'not_launchable', pause: 'project_archived' },
  PROJECTS_004: { reason: 'not_launchable', pause: 'project_archived' },
  // The installation or repository is no longer reachable.
  GITHUB_001: { reason: 'not_launchable', pause: null },
  GITHUB_010: { reason: 'not_launchable', pause: null },
  // The owner has no key for the automation's vendor, or the vendor refused
  // it: every run would fail the same way until the owner adds one.
  CLOUD_AGENTS_004: { reason: 'not_launchable', pause: 'cloud_key_missing' },
  CLOUD_AGENTS_005: { reason: 'not_launchable', pause: 'cloud_key_missing' },
  // This server keeps no vendor keys at all.
  CLOUD_AGENTS_003: { reason: 'not_launchable', pause: null },
  // The vendor refused this launch (a plan out of usage, a repository it cannot reach).
  CLOUD_AGENTS_010: { reason: 'not_launchable', pause: null },
};

export function runRefusalOf(code: string | undefined): RunRefusal | null {
  return code ? (REFUSALS[code] ?? null) : null;
}
