import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import type { CredentialOwnerPort } from '../../auth/application/credential-owner.port';
import { AuthErrors } from '../../auth/domain/auth.errors';
import type { CredentialOwner } from '../../auth/domain/scope-context.types';
import type { UserRepositoryPort } from '../database/user.repository.port';
import { USER_REPOSITORY } from '../user.di-tokens';
import { UserMapper } from '../user.mapper';

/**
 * The auth kernel's `CREDENTIAL_OWNER` port, answered from this module's aggregate: the
 * kernel must not read another module's tables. Only an account that may still act is
 * returned (`isAccessAllowed`, the rule the session path asks), so a deleted,
 * deactivated or banned owner takes every credential they issued down with them. Read
 * per request, never cached, so a ban takes effect on the credential's next call.
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

  async requireActiveOwner(userId: string): Promise<CredentialOwner> {
    const owner = await this.findActiveOwner(userId);
    if (!owner) throw new AppError(AuthErrors.INVALID_CREDENTIAL);
    return owner;
  }
}
