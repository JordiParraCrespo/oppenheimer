import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Session } from '../../auth/database/session.orm-entity';
import { AccessGrantOrmEntity } from '../../authz/database/access-grant.orm-entity';
import { MemberOrmEntity } from './member.orm-entity';
import type { OrganizationAccessRepositoryPort } from './organization-access.repository.port';

/** TypeORM adapter behind `ORGANIZATION_ACCESS`. */
@Injectable()
export class OrganizationAccessRepository implements OrganizationAccessRepositoryPort {
  constructor(
    @InjectRepository(AccessGrantOrmEntity)
    private readonly accessGrants: Repository<AccessGrantOrmEntity>,
    @InjectRepository(MemberOrmEntity)
    private readonly members: Repository<MemberOrmEntity>,
    @InjectRepository(Session)
    private readonly sessions: Repository<Session>,
  ) {}

  async revokeFor(userId: string, organizationId: string): Promise<void> {
    await this.accessGrants.delete({
      organizationId,
      principalType: 'user',
      principalId: userId,
    });

    const fallback = await this.members.findOne({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
    await this.sessions.update(
      { userId, activeOrganizationId: organizationId },
      {
        activeOrganizationId: fallback?.organizationId ?? null,
        activeTeamId: null,
      },
    );
  }
}
