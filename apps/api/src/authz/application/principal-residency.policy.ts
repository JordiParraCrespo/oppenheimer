import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AppError } from '@oppenheimer/backend-core';
import { IsNull, type Repository } from 'typeorm';
import { MemberOrmEntity } from '../../organizations/database/member.orm-entity';
import { TeamOrmEntity } from '../../organizations/database/team.orm-entity';
import { RoleOrmEntity } from '../../roles/database/role.orm-entity';
import type { AccessGrantPrincipalType } from '../domain/access-grant.entity';
import { AccessGrantErrors } from '../domain/access-grant.errors';

/**
 * Confirms the principal named by a grant belongs to the organization.
 *
 * Without this a grant could name a user, team or role from another tenant and
 * quietly bridge the two.
 */
@Injectable()
export class PrincipalResidencyChecker {
  constructor(
    @InjectRepository(MemberOrmEntity)
    private readonly members: Repository<MemberOrmEntity>,
    @InjectRepository(TeamOrmEntity)
    private readonly teams: Repository<TeamOrmEntity>,
    @InjectRepository(RoleOrmEntity)
    private readonly roles: Repository<RoleOrmEntity>,
  ) {}

  async assertBelongs(
    organizationId: string,
    principalType: AccessGrantPrincipalType,
    principalId: string,
  ): Promise<void> {
    if (await this.exists(organizationId, principalType, principalId)) return;

    throw new AppError(AccessGrantErrors.PRINCIPAL_OUTSIDE_ORGANIZATION, {
      detail: `${principalType} ${principalId} is not part of this organization`,
    });
  }

  private async exists(
    organizationId: string,
    principalType: AccessGrantPrincipalType,
    principalId: string,
  ): Promise<boolean> {
    if (principalType === 'user') {
      return this.members.existsBy({ organizationId, userId: principalId });
    }
    if (principalType === 'team') {
      return this.teams.existsBy({ organizationId, id: principalId });
    }
    // A role is addressable if it belongs to this organization, or is one of
    // the global templates every organization shares.
    const scoped = await this.roles.existsBy({ id: principalId, organizationId });
    return scoped || this.roles.existsBy({ id: principalId, organizationId: IsNull() });
  }
}
