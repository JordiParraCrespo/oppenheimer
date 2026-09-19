import type { CredentialOwner } from '../domain/scope-context.types';

/**
 * The account a credential acts on behalf of, as it exists right now.
 *
 * Every credential kind needs this and none of them should read the user
 * tables itself: the kernel resolves an OAuth grant's owner, and each
 * contributed resolver its own. It is a port rather than a repository import
 * so that `auth` depends on no feature module — `users` binds the adapter.
 *
 * Resolution is deliberately "active owner or nothing": a deleted or
 * deactivated account takes every credential it ever issued down with it, and
 * the caller learns only that their credential is not usable.
 */
export interface CredentialOwnerPort {
  /** The owner, or `null` if there is none that may still act. */
  findActiveOwner(userId: string): Promise<CredentialOwner | null>;
}
