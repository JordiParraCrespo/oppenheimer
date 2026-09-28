import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { None, type Option, Some } from 'oxide.ts';
import { In, type Repository } from 'typeorm';
import { RoleOrmEntity } from '../../roles/database/role.orm-entity';
import { UserRoleOrmEntity } from '../../roles/database/user-role.orm-entity';
import { UserOrmEntity } from '../../users/database/user.orm-entity';
import type { AssignedRole, Membership, MembershipUser } from '../domain/membership.types';
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
    @InjectRepository(UserOrmEntity)
    private readonly users: Repository<UserOrmEntity>,
    @InjectRepository(UserRoleOrmEntity)
    private readonly userRoles: Repository<UserRoleOrmEntity>,
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

  async findAccounts(userIds: string[]): Promise<MembershipUser[]> {
    if (userIds.length === 0) return [];
    const users = await this.users.find({ where: { id: In(userIds) } });
    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
    }));
  }

  async findAssignedRoles(
    userIds: string[],
    organizationId: string,
  ): Promise<Map<string, AssignedRole[]>> {
    if (userIds.length === 0) return new Map();

    const rows = await this.userRoles
      .createQueryBuilder('assignment')
      .innerJoin(RoleOrmEntity, 'role', 'role.id = assignment.roleId')
      .select('assignment.userId', 'userId')
      .addSelect('role.id', 'id')
      .addSelect('role.name', 'name')
      .where('assignment.userId IN (:...userIds)', { userIds })
      .andWhere(
        '(assignment.organizationId = :organizationId OR assignment.organizationId IS NULL)',
        { organizationId },
      )
      .getRawMany<{ userId: string; id: string; name: string }>();

    // A row per assignment is what the join returns; a list per user is what
    // every caller wants.
    const byUser = new Map<string, AssignedRole[]>();
    for (const row of rows) {
      const userId = String(row.userId);
      byUser.set(userId, [
        ...(byUser.get(userId) ?? []),
        { id: String(row.id), name: String(row.name) },
      ]);
    }
    return byUser;
  }
}
