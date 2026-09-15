import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { MemberOrmEntity } from '../../organizations/database/member.orm-entity';
import type { OrganizationMembershipReaderPort } from './organization-membership.repository.port';

/** TypeORM adapter reading the Better Auth `member` table. */
@Injectable()
export class OrganizationMembershipRepository implements OrganizationMembershipReaderPort {
  constructor(
    @InjectRepository(MemberOrmEntity)
    private readonly repository: Repository<MemberOrmEntity>,
  ) {}

  async findOrganizationIdsForUser(userId: string): Promise<string[]> {
    const records = await this.repository.find({
      where: { userId },
      select: { organizationId: true },
    });
    return records.map((record) => record.organizationId);
  }
}
