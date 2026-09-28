import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { None, type Option, Some } from 'oxide.ts';
import { Brackets, In, type Repository, type SelectQueryBuilder } from 'typeorm';
import { RoleOrmEntity } from '../../roles/database/role.orm-entity';
import { UserRoleOrmEntity } from '../../roles/database/user-role.orm-entity';
import { UserOrmEntity } from '../../users/database/user.orm-entity';
import type { Membership, MembershipUser } from '../domain/membership.types';
import { type MembershipRow, OrganizationMapper } from '../organization.mapper';
import { MemberOrmEntity } from './member.orm-entity';
import type { MemberFilters, MemberRepositoryPort } from './member.repository.port';

/** `%` and `_` are wildcards in `ILIKE`; a search for them means the characters. */
function containsPattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

/** TypeORM adapter behind `MEMBER_REPOSITORY`. */
@Injectable()
export class MemberRepository implements MemberRepositoryPort {
  constructor(
    @InjectRepository(MemberOrmEntity)
    private readonly members: Repository<MemberOrmEntity>,
    @InjectRepository(UserOrmEntity)
    private readonly users: Repository<UserOrmEntity>,
  ) {}

  async findMembership(organizationId: string, userId: string): Promise<Option<Membership>> {
    const row = await this.membershipQuery()
      .where('member.organizationId = :organizationId', { organizationId })
      .andWhere('member.userId = :userId', { userId })
      .getRawOne<MembershipRow>();
    return row ? Some(OrganizationMapper.toMembership(row)) : None;
  }

  async findMembershipById(organizationId: string, memberId: string): Promise<Option<Membership>> {
    const row = await this.membershipQuery()
      .where('member.organizationId = :organizationId', { organizationId })
      .andWhere('member.id = :memberId', { memberId })
      .getRawOne<MembershipRow>();
    return row ? Some(OrganizationMapper.toMembership(row)) : None;
  }

  async findMembers(organizationId: string, filters: MemberFilters): Promise<Membership[]> {
    const query = this.membershipQuery()
      .where('member.organizationId = :organizationId', { organizationId })
      .orderBy('member.createdAt', 'ASC');

    if (filters.roleIds?.length) {
      // Any, not all: a member holding `admin` and `user` belongs under both.
      query.andWhere(
        (sub) =>
          `EXISTS ${this.assignedRoles(sub)
            .andWhere('assignment.roleId IN (:...roleIds)', { roleIds: filters.roleIds })
            .getQuery()}`,
      );
    }

    const search = filters.search?.trim();
    if (search) {
      query.setParameter('needle', containsPattern(search)).andWhere(
        new Brackets((match) =>
          match
            .where('account.name ILIKE :needle')
            .orWhere('account.email ILIKE :needle')
            .orWhere('member.role ILIKE :needle')
            // The team table's Role column shows an assigned role in preference
            // to the organization role, so a name on screen must be findable.
            .orWhere(
              (sub: SelectQueryBuilder<MemberOrmEntity>) =>
                `EXISTS ${this.assignedRoles(sub)
                  .innerJoin(RoleOrmEntity, 'role', 'role.id = assignment.roleId')
                  .andWhere('role.name ILIKE :needle')
                  .getQuery()}`,
            ),
        ),
      );
    }

    const rows = await query.getRawMany<MembershipRow>();
    return rows.map(OrganizationMapper.toMembership);
  }

  async findAccounts(userIds: string[]): Promise<MembershipUser[]> {
    if (userIds.length === 0) return [];
    const users = await this.users.find({ where: { id: In(userIds) } });
    return users.map(OrganizationMapper.toMembershipUser);
  }

  /** The member row joined to the account it belongs to, aliased as `MembershipRow`. */
  private membershipQuery(): SelectQueryBuilder<MemberOrmEntity> {
    return this.members
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
      .addSelect('account.emailVerified', 'userEmailVerified');
  }

  /** The member's role assignments that count in this organization. */
  private assignedRoles(
    sub: SelectQueryBuilder<MemberOrmEntity>,
  ): SelectQueryBuilder<UserRoleOrmEntity> {
    return sub
      .subQuery()
      .select('1')
      .from(UserRoleOrmEntity, 'assignment')
      .where('assignment.userId = member.userId')
      .andWhere(
        '(assignment.organizationId = member.organizationId OR assignment.organizationId IS NULL)',
      );
  }
}
