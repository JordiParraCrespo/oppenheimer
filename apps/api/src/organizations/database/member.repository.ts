import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { None, type Option, Some } from 'oxide.ts';
import type { Repository } from 'typeorm';
import { UserOrmEntity } from '../../users/database/user.orm-entity';
import type { Membership } from '../domain/membership.types';
import { toMembership } from '../membership.mapper';
import { MemberOrmEntity } from './member.orm-entity';
import type { MemberRepositoryPort } from './member.repository.port';

/** TypeORM adapter behind `MEMBER_REPOSITORY`: two indexed lookups. */
@Injectable()
export class MemberRepository implements MemberRepositoryPort {
  constructor(
    @InjectRepository(MemberOrmEntity)
    private readonly members: Repository<MemberOrmEntity>,
    @InjectRepository(UserOrmEntity)
    private readonly users: Repository<UserOrmEntity>,
  ) {}

  async findMembership(organizationId: string, userId: string): Promise<Option<Membership>> {
    const member = await this.members.findOne({ where: { organizationId, userId } });
    if (!member) return None;

    const user = await this.users.findOne({ where: { id: member.userId } });
    return Some(toMembership(member, user));
  }
}
