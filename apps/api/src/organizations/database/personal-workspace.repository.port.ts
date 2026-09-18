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
   * Write the organization, the owner membership and the role grant as one,
   * unless the account already belongs to an organization. Answers whether it
   * wrote.
   *
   * The "already belongs" test is part of this operation rather than a check a
   * caller makes first, because a check outside the transaction is not a rule:
   * two provisions racing for the same account would both pass it and both
   * write. Unlikely at sign-up, and certain the first time the seed runs
   * against a live API.
   */
  provision(workspace: PersonalWorkspaceEntity): Promise<boolean>;
}
