/**
 * Whether a credential is older than its account's cutoff, the moment of the
 * last password reset (`credential_cutoff`). Everything issued before it, or
 * issued by something that was, is refused: a reset is how a real owner takes
 * an account back, and a credential that survived it would keep the other
 * person in.
 *
 * `issuedAt` is when the chain of credentials behind this one began (an API
 * token minted with another inherits that one's), so a token minted by a
 * pre-reset token in a request that raced the reset is still refused. An
 * unknown `issuedAt` under a cutoff is refused too: this check fails closed.
 */
export function predatesCutoff(issuedAt: Date | null, cutoff: Date | null): boolean {
  if (!cutoff) return false;
  if (!issuedAt || Number.isNaN(issuedAt.getTime())) return true;
  return issuedAt.getTime() < cutoff.getTime();
}
