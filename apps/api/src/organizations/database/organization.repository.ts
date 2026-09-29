import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { None, type Option, Some } from 'oxide.ts';
import type { Repository } from 'typeorm';
import type { Organization, Workspace, WorkspaceMember } from '../domain/organization.types';
import { OrganizationMapper } from '../organization.mapper';
import { OrganizationOrmEntity } from './organization.orm-entity';
import type { OrganizationRepositoryPort } from './organization.repository.port';
import { TeamOrmEntity } from './team.orm-entity';
import { TeamMemberOrmEntity } from './team-member.orm-entity';

/** TypeORM adapter behind `ORGANIZATION_REPOSITORY`. */
@Injectable()
export class OrganizationRepository implements OrganizationRepositoryPort {
  constructor(
    @InjectRepository(OrganizationOrmEntity)
    private readonly organizations: Repository<OrganizationOrmEntity>,
    @InjectRepository(TeamOrmEntity)
    private readonly teams: Repository<TeamOrmEntity>,
    @InjectRepository(TeamMemberOrmEntity)
    private readonly teamMembers: Repository<TeamMemberOrmEntity>,
  ) {}

  async findOrganization(organizationId: string): Promise<Option<Organization>> {
    const row = await this.organizations.findOne({ where: { id: organizationId } });
    return row ? Some(OrganizationMapper.toOrganization(row)) : None;
  }

  async findWorkspace(workspaceId: string): Promise<Option<Workspace>> {
    const row = await this.teams.findOne({ where: { id: workspaceId } });
    return row ? Some(OrganizationMapper.toWorkspace(row)) : None;
  }

  async findWorkspaceMember(workspaceId: string, userId: string): Promise<Option<WorkspaceMember>> {
    const row = await this.teamMembers.findOne({ where: { teamId: workspaceId, userId } });
    return row ? Some(OrganizationMapper.toWorkspaceMember(row)) : None;
  }
}
