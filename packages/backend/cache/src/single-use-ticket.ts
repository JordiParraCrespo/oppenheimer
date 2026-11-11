import { randomBytes } from 'node:crypto';
import type { CacheService } from './cache.service';

/** A ticket minted by {@link issueSingleUseTicket}, and when it stops being redeemable. */
export interface SingleUseTicket {
  ticket: string;
  expiresAt: Date;
}

/**
 * Mint a single-use ticket for `claim`: 32 random bytes, base64url (unguessable,
 * and safe as a WebSocket subprotocol token), stored at `<prefix><ticket>` with
 * `setIfAbsent`, so two mints never collide. The consumer redeems it with
 * `take`, which reads and deletes in one command: one ticket, one redemption.
 *
 * Answers `null` when the claim was refused, which the caller turns into its
 * own error code; what a ticket buys, and where it is presented, is the
 * caller's.
 */
export async function issueSingleUseTicket<T>(
  cache: CacheService,
  prefix: string,
  claim: T,
  ttlSeconds: number,
): Promise<SingleUseTicket | null> {
  const ticket = randomBytes(32).toString('base64url');
  const claimed = await cache.setIfAbsent<T>(`${prefix}${ticket}`, claim, ttlSeconds);
  if (!claimed) return null;
  return { ticket, expiresAt: new Date(Date.now() + ttlSeconds * 1000) };
}
