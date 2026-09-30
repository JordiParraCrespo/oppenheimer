import type { PersonalWorkspaceEntity } from '../domain/personal-workspace.entity';

/**
 * Deliberately narrower than `RepositoryPort`: this aggregate is written once,
 * at sign-up, and never loaded to be mutated — the roster operations that
 * would edit an organization go through Better Auth's own API, which owns
 * these tables (see `infrastructure/organization-auth.port.ts`). A port declaring `save`,
 * `delete` and two flavours of `findAll` would be five methods no caller has,
 * each an invitation to write the second mechanism that disagrees with the
 * first. It grows the day something needs more.
 */
export interface PersonalWorkspaceRepositoryPort {
  /**
   * Write the organization, the owner membership and the role grant as one,
   * unless the account already belongs to an organization. Answers whether it
   * wrote.
   *
   * The owner's org-less sessions (every one sign-up returns) are pointed at
   * the new organization in the same transaction: a role grant is only in a
   * caller's ability while their session names its organization.
   *
   * The "already belongs" test is inside the operation because a check outside
   * the transaction lets two racing provisions both write, which is certain the
   * first time the seed runs against a live API. The test is membership, not
   * ownership, deliberately: an account that belongs somewhere is left alone.
   * `product/versions/mvp/08-auth.md` records that the teams slice decides
   * whether an invitee also gets a workspace of their own.
   */
  provision(workspace: PersonalWorkspaceEntity): Promise<boolean>;

  /**
   * Delete the given workspaces. Members, roles, invitations and GitHub
   * installations cascade; the sessions and projects in them are their
   * modules' to remove first (they refuse to lose their workspace).
   */
  erase(organizationIds: readonly string[]): Promise<void>;
}
