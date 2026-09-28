import { Inject, Injectable } from '@nestjs/common';
import type { CredentialOwnerPort } from '../../auth/application/credential-owner.port';
import type { CredentialOwner } from '../../auth/domain/scope-context.types';
import type { UserRepositoryPort } from '../database/user.repository.port';
import { USER_REPOSITORY } from '../user.di-tokens';
import { UserMapper } from '../user.mapper';

/**
 * The auth kernel's `CREDENTIAL_OWNER` port, answered from this module's
 * aggregate.
 *
 * Every credential kind needs the account behind it, and the kernel must not
 * read another module's tables to get it — so it asks through a port and this
 * module binds the answer. Only an account that may still act is returned —
 * the rule is `isAccessAllowed`, the same one the session path asks: a
 * deleted, deactivated or currently banned owner takes every credential they
 * ever issued down with them, and the caller learns only that their
 * credential is not usable. Read per request, never cached, so a ban or a
 * deactivation takes effect on the credential's next call.
 */
@Injectable()
export class UserCredentialOwnerAdapter implements CredentialOwnerPort {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepositoryPort,
    private readonly mapper: UserMapper,
  ) {}

  async findActiveOwner(userId: string): Promise<CredentialOwner | null> {
    const found = await this.users.findOneById(userId);
    if (found.isNone()) return null;

    const owner = found.unwrap();
    if (!owner.mayAct(new Date())) return null;

    return this.mapper.toCredentialOwner(owner);
  }
}
