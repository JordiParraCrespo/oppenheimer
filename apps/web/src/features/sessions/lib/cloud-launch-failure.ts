import { AppError } from '@oppenheimer/frontend-core';

/**
 * What the reader can do about a cloud launch that failed:
 *
 * - `connect`: no key is stored for the vendor (`CLOUD_AGENTS_004`).
 * - `reconnect`: the vendor refused the key it holds, revoked or the wrong
 *   kind (`CLOUD_AGENTS_005`); the status still says connected, so only a
 *   new key fixes it.
 * - `unavailable`: the vendor did not answer (`CLOUD_AGENTS_006`), and
 *   `limited`: it asked us to slow down (`007`); the same send again may go
 *   through.
 * - `refused`: the vendor declined the launch as asked (`CLOUD_AGENTS_010`),
 *   with its own sentence when it gave one.
 */
export type CloudLaunchFailureKind =
  | 'connect'
  | 'reconnect'
  | 'unavailable'
  | 'limited'
  | 'refused';

export interface CloudLaunchFailure {
  kind: CloudLaunchFailureKind;
  /** The vendor's own words, on a refusal that gave some; null otherwise. */
  vendorSays: string | null;
  /**
   * The reference a bug report quotes, kept only where a bug report is the
   * way forward (an outage, a refusal); a failure the reader fixes
   * themselves (a key, a rate limit) carries none.
   */
  correlationId: string | undefined;
}

const KINDS: Record<string, CloudLaunchFailureKind> = {
  CLOUD_AGENTS_004: 'connect',
  CLOUD_AGENTS_005: 'reconnect',
  CLOUD_AGENTS_006: 'unavailable',
  CLOUD_AGENTS_007: 'limited',
  CLOUD_AGENTS_010: 'refused',
};

const REFERENCED: ReadonlySet<CloudLaunchFailureKind> = new Set(['unavailable', 'refused']);

/** A cloud launch's failure, or null for one the composer's generic alert speaks for. */
export function cloudLaunchFailure(error: unknown): CloudLaunchFailure | null {
  if (!(error instanceof AppError)) return null;
  const kind = KINDS[error.code];
  if (!kind) return null;
  return {
    kind,
    vendorSays: kind === 'refused' ? vendorSentence(error.problem?.detail) : null,
    correlationId: REFERENCED.has(kind) ? error.correlationId : undefined,
  };
}

/**
 * The vendor's own words from the problem's `detail`, which the API's
 * gateway writes as `<Vendor>: <sentence>` (`refusalOf` in
 * `apps/api/src/cloud-agents/infrastructure/cursor-cloud-agents.gateway.ts`);
 * a detail that is only a status ("Cursor answered 402") says nothing the
 * reader can use.
 */
function vendorSentence(detail: string | undefined): string | null {
  const match = detail?.match(/^[^:]+:\s*(.+)$/s);
  const sentence = match?.[1]?.trim();
  return sentence ? sentence : null;
}
