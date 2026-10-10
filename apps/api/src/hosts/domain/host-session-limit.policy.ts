import { HOST_MAX_SESSIONS_CEILING } from '@oppenheimer/shared';

const BYTES_PER_SESSION = 2 * 1024 ** 3;

/** What the machine said about itself that bounds how many agents it can carry. */
export interface HostSize {
  cpus?: number | null;
  memoryTotalBytes?: number | null;
}

/**
 * The limit a host gets when nobody set one: one session per CPU and one per
 * 2 GiB of memory, whichever is fewer, and never below one. An agent is a few
 * hundred megabytes idle; what it runs (a build, a test suite) is what needs
 * the core and the rest of the memory.
 *
 * `null` when the runner has not reported either fact: a host that has not
 * described itself is not limited on a guess.
 */
export function derivedSessionLimit(size: HostSize): number | null {
  const byCpu = size.cpus ?? null;
  const byMemory =
    size.memoryTotalBytes != null ? Math.floor(size.memoryTotalBytes / BYTES_PER_SESSION) : null;
  if (byCpu === null && byMemory === null) return null;
  const limit = Math.min(byCpu ?? Number.POSITIVE_INFINITY, byMemory ?? Number.POSITIVE_INFINITY);
  return Math.min(Math.max(limit, 1), HOST_MAX_SESSIONS_CEILING);
}

/** The size facts out of a host's stored capabilities, whatever else they hold. */
export function hostSizeOf(capabilities: Record<string, unknown> | null): HostSize {
  const number = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
  return {
    cpus: number(capabilities?.cpus),
    memoryTotalBytes: number(capabilities?.memoryTotalBytes),
  };
}
