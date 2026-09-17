import type { PersonalWorkspaceEntity } from '../domain/personal-workspace.entity';

/**
 * Port for provisioning the workspace an account lives in. Implemented by the
 * TypeORM adapter in `personal-workspace.repository.ts`.
 *
 * Deliberately narrower than `RepositoryPort`: this aggregate is written once,
 * at sign-up, and never loaded to be mutated — the roster operations that
 * would edit an organization go through Better Auth's own API, which owns
 * these tables (see `organizations.service.ts`). A port declaring `save`,
 * `delete` and two flavours of `findAll` would be five methods no caller has,
 * each an invitation to write the second mechanism that disagrees with the
 * first. It grows the day something needs more.
 */
export interface PersonalWorkspaceRepositoryPort {
  /**
   * Whether the account already belongs to an organization.
   *
   * What makes provisioning idempotent: sign-up and the seed both run it, and
   * an account invited into someone else's workspace must not collect a second
   * one it never asked for.
   */
  belongsToAnyOrganization(userId: string): Promise<boolean>;

  /** Write the organization, the owner membership and the role grant as one. */
  insert(workspace: PersonalWorkspaceEntity): Promise<void>;
}
