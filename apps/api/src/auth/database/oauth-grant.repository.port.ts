import type { DomainEvent } from '@oppenheimer/backend-ddd';

/**
 * The OAuth (MCP) grants Better Auth's provider keeps for an account: its
 * access and refresh tokens (`oauthAccessToken`), the consents that let a
 * client skip the consent screen (`oauthConsent`) and the authorization codes
 * not yet exchanged (`verification`). The kernel issues these, so it is the
 * kernel that revokes them, with the account's credential cutoff.
 */
export interface OAuthGrantRepositoryPort {
  /**
   * In one transaction: set `userId`'s credential cutoff to `cutoff` (never
   * moving it back), delete every grant, consent and pending authorization
   * code it holds, and stage `owed` on the outbox, so the revocation and what
   * it owes other modules commit together. From the commit on, every scoped
   * credential issued before `cutoff` is refused, whenever `owed` is
   * delivered. Resolves how many tokens were deleted.
   */
  revokeAllForUser(userId: string, cutoff: Date, owed: readonly DomainEvent[]): Promise<number>;
}
