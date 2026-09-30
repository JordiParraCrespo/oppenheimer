import type { CredentialOwner } from '../domain/scope-context.types';

/**
 * The account a credential acts on behalf of, as it exists right now. A port
 * so that `auth` depends on no feature module; `users` binds the adapter.
 *
 * "Active owner or nothing": a deleted or deactivated account takes every
 * credential it ever issued down with it, and the caller learns only that
 * their credential is not usable.
 */
export interface CredentialOwnerPort {
  findActiveOwner(userId: string): Promise<CredentialOwner | null>;

  /**
   * The owner, or the opaque `INVALID_CREDENTIAL` (`TOKEN_003`) — the same
   * answer as an unknown token, so a missing, deactivated or banned owner is
   * indistinguishable from outside. What every credential resolver asks.
   */
  requireActiveOwner(userId: string): Promise<CredentialOwner>;
}
