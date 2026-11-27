import type { DomainEvent } from '@oppenheimer/backend-ddd';

/**
 * The OAuth (MCP) grants Better Auth's provider keeps for an account: its
 * access and refresh tokens (`oauthAccessToken`) and the consents that let a
 * client skip the consent screen (`oauthConsent`). The kernel issues these, so
 * it is the kernel that revokes them.
 */
export interface OAuthGrantRepositoryPort {
  /**
   * Delete every grant and consent `userId` holds, and stage `owed` on the
   * outbox in the same transaction, so the revocation and what it owes other
   * modules commit together. Resolves how many tokens were deleted.
   */
  revokeAllForUser(userId: string, owed: readonly DomainEvent[]): Promise<number>;
}
