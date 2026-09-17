import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxService } from '@oppenheimer/backend-ddd';
import type { Repository } from 'typeorm';
import { UserRoleOrmEntity } from '../../roles/database/user-role.orm-entity';
import type { PersonalWorkspaceEntity } from '../domain/personal-workspace.entity';
import { PersonalWorkspaceMapper } from '../personal-workspace.mapper';
import { MemberOrmEntity } from './member.orm-entity';
import { OrganizationOrmEntity } from './organization.orm-entity';
import type { PersonalWorkspaceRepositoryPort } from './personal-workspace.repository.port';

/**
 * TypeORM-backed adapter for the personal-workspace aggregate.
 *
 * The three inserts share one transaction, staged alongside the aggregate's
 * domain events on the transactional outbox, so the workspace, its owner and
 * the grant that opens it commit together or not at all.
 *
 * The role grant lands in `user_role`, which the roles module owns. It is
 * written here rather than through `UserRoleRepositoryPort` because atomicity
 * is the whole point of this aggregate: routing that one row through another
 * repository would put it in a second transaction, which is exactly the
 * half-provisioned workspace this boundary exists to make impossible. The
 * organization is new, so no cached ability can be stale and no `roleVersion`
 * bump is owed.
 */
@Injectable()
export class PersonalWorkspaceRepository implements PersonalWorkspaceRepositoryPort {
  constructor(
    @InjectRepository(MemberOrmEntity)
    private readonly members: Repository<MemberOrmEntity>,
    private readonly mapper: PersonalWorkspaceMapper,
    private readonly outbox: OutboxService,
  ) {}

  async belongsToAnyOrganization(userId: string): Promise<boolean> {
    return (await this.members.countBy({ userId })) > 0;
  }

  async insert(workspace: PersonalWorkspaceEntity): Promise<void> {
    const records = this.mapper.toPersistence(workspace);
    await this.outbox.writeWithEvents([workspace], async (manager) => {
      await manager.insert(OrganizationOrmEntity, records.organization);
      await manager.insert(MemberOrmEntity, records.member);
      await manager.insert(UserRoleOrmEntity, records.roleGrant);
    });
  }
}
