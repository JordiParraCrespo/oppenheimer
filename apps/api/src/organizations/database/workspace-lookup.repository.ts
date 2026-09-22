import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { WorkspaceLookupPort } from '../application/workspace-lookup.port';
import { MemberOrmEntity } from './member.orm-entity';
import { OrganizationOrmEntity } from './organization.orm-entity';

/**
 * The read-only adapter behind `WORKSPACE_LOOKUP`: two indexed lookups, no
 * scope, because the callers hold a credential that already named the
 * workspace (a session row, an attach ticket) and are asking a fact about it.
 */
@Injectable()
export class WorkspaceLookupRepository implements WorkspaceLookupPort {
  constructor(
    @InjectRepository(OrganizationOrmEntity)
    private readonly organizations: Repository<OrganizationOrmEntity>,
    @InjectRepository(MemberOrmEntity)
    private readonly members: Repository<MemberOrmEntity>,
  ) {}

  async slugOf(organizationId: string): Promise<string | null> {
    const found = await this.organizations.findOne({
      where: { id: organizationId },
      select: { id: true, slug: true },
    });
    return found?.slug ?? null;
  }

  async isMember(organizationId: string, userId: string): Promise<boolean> {
    return this.members.exist({ where: { organizationId, userId } });
  }
}
