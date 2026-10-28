import { CODING_AGENTS } from '@oppenheimer/shared/agents';
import type { RunnerCapability } from '@oppenheimer/shared/protocol';

/**
 * Whether a host can start a Claude Code cloud session now
 * (`product/versions/mvp/24-session-places.md` §7): it is online, its runner's
 * live link named `session.cloud`, and `claude` is on it. `null` is "not known
 * here": the host is online but this process holds no link for it, so the
 * create is not refused on that account and the dispatch decides.
 *
 * A host whose inventory lists no `claude` cannot, whatever its runner takes;
 * one whose runner reported no tools at all is not ruled out on that count.
 */
export function hostStartsCloud(host: {
  online: boolean;
  liveCapabilities: readonly RunnerCapability[] | null;
  probedTools: readonly string[] | null;
}): boolean | null {
  if (!host.online) return false;
  const claude = CODING_AGENTS['claude-code'].command;
  if (host.probedTools !== null && !host.probedTools.includes(claude)) return false;
  if (host.liveCapabilities === null) return null;
  return host.liveCapabilities.includes('session.cloud');
}
