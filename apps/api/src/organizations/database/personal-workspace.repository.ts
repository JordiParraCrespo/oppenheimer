import { Inject, Injectable } from '@nestjs/common';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { DataSource, IsNull } from 'typeorm';
import { Session } from '../../auth/database/session.orm-entity';
import type { UserRoleRepositoryPort } from '../../roles/database/user-role.repository.port';
import { USER_ROLE_REPOSITORY } from '../../roles/roles.di-tokens';
import { UserOrmEntity } from '../../users/database/user.orm-entity';
import type { PersonalWorkspaceEntity } from '../domain/personal-workspace.entity';
import { toPersonalWorkspaceRecords } from '../personal-workspace.mapper';
import { MemberOrmEntity } from './member.orm-entity';
import { OrganizationOrmEntity } from './organization.orm-entity';
import type { PersonalWorkspaceRepositoryPort } from './personal-workspace.repository.port';

/**
 * The grant goes through `UserRoleRepositoryPort` with this transaction's
 * manager, so the roles module stays the one writer of `user_role`.
 *
 * `OutboxService.transaction`, not `writeWithEvents`: that helper stages the
 * events whatever the write returns, which would announce a workspace never
 * provisioned. Events are staged on the branch that wrote, and the relay is
 * woken after commit only then.
 */
@Injectable()
export class PersonalWorkspaceRepository implements PersonalWorkspaceRepositoryPort {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoles: UserRoleRepositoryPort,
  ) {}

  async erase(organizationIds: readonly string[]): Promise<void> {
    if (organizationIds.length === 0) return;
    await this.dataSource.getRepository(OrganizationOrmEntity).delete([...organizationIds]);
  }

  async provision(workspace: PersonalWorkspaceEntity): Promise<boolean> {
    const records = toPersonalWorkspaceRecords(workspace);

    const provisioned = await this.outbox.transaction(async (manager) => {
      // Lock the account row, so two provisions for the same person serialize
      // here instead of both reading "no membership" and both writing one.
      // The account exists — sign-up just wrote it — which is what makes a row
      // lock possible at all; there is no membership row yet to lock.
      await manager
        .getRepository(UserOrmEntity)
        .createQueryBuilder('user')
        .setLock('pessimistic_write')
        .where('user.id = :id', { id: workspace.ownerId })
        .getOne();

      const memberships = await manager.countBy(MemberOrmEntity, { userId: workspace.ownerId });
      if (memberships > 0) return false;

      await manager.insert(OrganizationOrmEntity, records.organization);
      await manager.insert(MemberOrmEntity, records.member);
      await this.userRoles.assignRoleToUser(
        records.roleGrant.userId,
        records.roleGrant.roleId,
        records.roleGrant.organizationId,
        manager,
      );

      // Better Auth picks a session's organization when the row is written
      // (`session.create.before`), and the `user.create.after` hook this
      // command comes from runs after sign-up commits, so sign-up's session
      // holds `activeOrganizationId = null`: without this, the `owner` grant
      // stays out of its ability and every org-scoped route answers 403 until
      // the next sign-in.
      //
      // Only sessions that chose nothing are touched, and the team column is
      // left alone: a personal workspace has no team.
      await manager.update(
        Session,
        { userId: workspace.ownerId, activeOrganizationId: IsNull() },
        { activeOrganizationId: records.organization.id },
      );
      await this.outbox.stageEvents(manager, workspace.domainEvents);
      return true;
    });

    if (!provisioned) return false;
    workspace.clearEvents();
    return true;
  }
}
