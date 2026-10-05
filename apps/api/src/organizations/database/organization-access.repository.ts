import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Session } from '../../auth/database/session.orm-entity';
import { AccessGrantOrmEntity } from '../../authz/database/access-grant.orm-entity';
import type { UserRoleRepositoryPort } from '../../roles/database/user-role.repository.port';
import { USER_ROLE_REPOSITORY } from '../../roles/roles.di-tokens';
import { MemberOrmEntity } from './member.orm-entity';
import type { OrganizationAccessRepositoryPort } from './organization-access.repository.port';

/**
 * One transaction for the three writes, so a failure part way leaves the
 * person exactly as they were rather than with no roles but a session still
 * acting in the organization. The roles go through `UserRoleRepositoryPort`
 * with this transaction's manager — `user_role` stays the roles module's to
 * write — and the session selection is written here, on the session table,
 * for the same reason `PersonalWorkspaceRepository` writes it: a port on the
 * auth kernel could not join this transaction.
 */
@Injectable()
export class OrganizationAccessRepository implements OrganizationAccessRepositoryPort {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoles: UserRoleRepositoryPort,
  ) {}

  async revokeFor(userId: string, organizationId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.userRoles.setRolesForUser(userId, [], organizationId, manager);
      await manager.delete(AccessGrantOrmEntity, {
        organizationId,
        principalType: 'user',
        principalId: userId,
      });

      // Better Auth has already removed this membership, so every row left is
      // an organization the person is still in — and so may still act in.
      const fallback = await manager.findOne(MemberOrmEntity, {
        where: { userId },
        order: { createdAt: 'ASC' },
      });
      await manager.update(
        Session,
        { userId, activeOrganizationId: organizationId },
        { activeOrganizationId: fallback?.organizationId ?? null, activeTeamId: null },
      );
    });
  }
}
