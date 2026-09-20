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
 * TypeORM-backed adapter for the personal-workspace aggregate.
 *
 * Everything happens in one transaction, staged alongside the aggregate's
 * domain events on the transactional outbox: the test for an existing
 * membership, the organization, the membership itself, and the application
 * role grant. The workspace, its owner and the grant that opens it commit
 * together or not at all — and a concurrent provision for the same account
 * sees the first one's membership rather than racing past a check that was
 * already stale when it was read.
 *
 * The grant goes through `UserRoleRepositoryPort` with this transaction's
 * manager, not a second `INSERT` of our own. `user_role` belongs to the roles
 * module; borrowing its transaction is what lets one writer keep owning it
 * while the three rows still share a unit of work.
 *
 * The transaction is opened here rather than through `writeWithEvents` because
 * this write may decide not to happen: that helper stages the aggregate's
 * events whatever the write returns, which would announce a workspace that was
 * never provisioned. Events are staged explicitly, on the branch that wrote.
 *
 * The owner's open sessions are pointed at the new workspace in the same
 * transaction, because at sign-up they were written before it existed — see
 * `provision` below.
 */
@Injectable()
export class PersonalWorkspaceRepository implements PersonalWorkspaceRepositoryPort {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoles: UserRoleRepositoryPort,
  ) {}

  async provision(workspace: PersonalWorkspaceEntity): Promise<boolean> {
    const records = toPersonalWorkspaceRecords(workspace);

    const provisioned = await this.dataSource.transaction(async (manager) => {
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

      // The sessions the account already has were opened before this workspace
      // existed, and nothing else will ever tell them about it.
      //
      // Better Auth decides which organization a session lands in when the row
      // is written (`session.create.before` in `better-auth.config.ts`), and at
      // sign-up that happens first: the `user.create.after` hook this command
      // comes from is queued until after the sign-up transaction commits, so
      // sign-up's session row is written while the account still belongs
      // nowhere and keeps `activeOrganizationId = null` for its whole week.
      // `AbilityFactory` narrows role grants to the active organization, so the
      // org-scoped `owner` role this transaction just granted would not be in
      // the caller's ability and every org-scoped route would answer 403 until
      // they signed in again.
      //
      // Only sessions that chose nothing are touched, so a session that has
      // switched to another workspace keeps it, and the team column is left
      // alone — a personal workspace has no team for a session to point at.
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
    // Deliver now rather than at the relay's next poll; a failure here leaves
    // the row for that poll to reclaim, which is the point of the outbox.
    await this.outbox.wake();
    return true;
  }
}
