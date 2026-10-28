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
 *
 * Anything else is null, and the composer's generic alert speaks for it.
 */
export type CloudLaunchFailure =
  | { kind: 'connect' }
  | { kind: 'reconnect' }
  | { kind: 'unavailable'; correlationId?: string }
  | { kind: 'limited' }
  | { kind: 'refused'; vendorSays: string | null; correlationId?: string };

export function cloudLaunchFailure(error: unknown): CloudLaunchFailure | null {
  if (!(error instanceof AppError)) return null;
  switch (error.code) {
    case 'CLOUD_AGENTS_004':
      return { kind: 'connect' };
    case 'CLOUD_AGENTS_005':
      return { kind: 'reconnect' };
    case 'CLOUD_AGENTS_006':
      return { kind: 'unavailable', correlationId: error.correlationId };
    case 'CLOUD_AGENTS_007':
      return { kind: 'limited' };
    case 'CLOUD_AGENTS_010':
      return {
        kind: 'refused',
        vendorSays: vendorSentence(error.problem?.detail),
        correlationId: error.correlationId,
      };
    default:
      return null;
  }
}

/**
 * The vendor's own words from the problem's `detail`, which the API writes as
 * `<Vendor>: <sentence>`; a detail that is only a status ("Cursor answered
 * 402") says nothing the reader can use.
 */
function vendorSentence(detail: string | undefined): string | null {
  const match = detail?.match(/^[^:]+:\s*(.+)$/s);
  const sentence = match?.[1]?.trim();
  return sentence ? sentence : null;
}
