import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { None, type Option, Some } from 'oxide.ts';
import type { Repository } from 'typeorm';
import { UserOrmEntity } from '../../users/database/user.orm-entity';
import type { Membership } from '../domain/membership.types';
import { MemberOrmEntity } from './member.orm-entity';
import type { MemberRepositoryPort } from './member.repository.port';

/** One row of the member ⋈ user read, as the query aliases it. */
interface MembershipRow {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  createdAt: Date;
  userName: string;
  userEmail: string;
  userImage: string | null;
  userFirstName: string;
  userLastName: string;
  userIsActive: boolean;
  userEmailVerified: boolean;
}

/** TypeORM adapter behind `MEMBER_REPOSITORY`. */
@Injectable()
export class MemberRepository implements MemberRepositoryPort {
  constructor(
    @InjectRepository(MemberOrmEntity)
    private readonly members: Repository<MemberOrmEntity>,
  ) {}

  async findMembership(organizationId: string, userId: string): Promise<Option<Membership>> {
    // One query: the member row joined to the account it belongs to.
    const row = await this.members
      .createQueryBuilder('member')
      .innerJoin(UserOrmEntity, 'account', 'account.id = member.userId')
      .select('member.id', 'id')
      .addSelect('member.organizationId', 'organizationId')
      .addSelect('member.userId', 'userId')
      .addSelect('member.role', 'role')
      .addSelect('member.createdAt', 'createdAt')
      .addSelect('account.name', 'userName')
      .addSelect('account.email', 'userEmail')
      .addSelect('account.image', 'userImage')
      .addSelect('account.firstName', 'userFirstName')
      .addSelect('account.lastName', 'userLastName')
      .addSelect('account.isActive', 'userIsActive')
      .addSelect('account.emailVerified', 'userEmailVerified')
      .where('member.organizationId = :organizationId', { organizationId })
      .andWhere('member.userId = :userId', { userId })
      .getRawOne<MembershipRow>();
    if (!row) return None;

    return Some({
      id: row.id,
      organizationId: row.organizationId,
      userId: row.userId,
      role: row.role,
      createdAt: row.createdAt,
      user: {
        id: row.userId,
        name: row.userName,
        email: row.userEmail,
        image: row.userImage,
        firstName: row.userFirstName,
        lastName: row.userLastName,
        isActive: row.userIsActive,
        emailVerified: row.userEmailVerified,
      },
    });
  }
}
