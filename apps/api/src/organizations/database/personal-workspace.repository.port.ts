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
   * The owner's sessions that point at no organization are pointed at the new
   * one in the same breath. A session opened before the workspace existed —
   * which is every session sign-up itself returns — would otherwise carry no
   * active organization, and an org-scoped role grant is only in a caller's
   * ability while their session names the organization it was granted in.
   *
   * The "already belongs" test is part of this operation rather than a check a
   * caller makes first, because a check outside the transaction is not a rule:
   * two provisions racing for the same account would both pass it and both
   * write. Unlikely at sign-up, and certain the first time the seed runs
   * against a live API.
   *
   * The test is **membership**, not ownership, and that is a decision rather
   * than an accident: an account that already belongs somewhere is left alone.
   * In the MVP the two are the same rule, because nothing but sign-up can
   * place an account in an organization. They come apart the day an invitation
   * can, and `product/versions/mvp/08-auth.md` records that the teams slice
   * decides then whether an invitee also gets a workspace of their own.
   */
  provision(workspace: PersonalWorkspaceEntity): Promise<boolean>;
}
