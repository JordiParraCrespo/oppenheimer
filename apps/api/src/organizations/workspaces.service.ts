import type { IncomingHttpHeaders } from 'node:http';
import { Injectable } from '@nestjs/common';
import type { CreateWorkspaceDto, UpdateWorkspaceDto } from '@oppenheimer/shared';
import { auth } from '../auth/infrastructure/better-auth.config';
import { betterAuthHeaders } from '../auth/infrastructure/better-auth.util';
import type {
  WorkspaceMemberResponseDto,
  WorkspaceResponseDto,
} from './dtos/workspace.response.dto';
import {
  mapWorkspace,
  mapWorkspaceMember,
  mapWorkspaceMembers,
  mapWorkspaces,
} from './organization.mappers';
import { invokeOrganizationApi } from './organization-error.mapper';

/**
 * Delegating façade over the Better Auth organization plugin's team endpoints.
 * "Workspaces" are Better Auth teams scoped to an organization.
 */
@Injectable()
export class WorkspacesService {
  private headers(headers: IncomingHttpHeaders): Headers {
    return betterAuthHeaders(headers);
  }

  async create(
    headers: IncomingHttpHeaders,
    dto: CreateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.createTeam({
        body: { name: dto.name, organizationId: dto.organizationId },
        headers: this.headers(headers),
      }),
    );
    return mapWorkspace(result);
  }

  async update(
    headers: IncomingHttpHeaders,
    teamId: string,
    dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.updateTeam({
        body: { teamId, data: { name: dto.name } },
        headers: this.headers(headers),
      }),
    );
    return mapWorkspace(result);
  }

  async remove(headers: IncomingHttpHeaders, teamId: string): Promise<void> {
    await invokeOrganizationApi(() =>
      auth.api.removeTeam({ body: { teamId }, headers: this.headers(headers) }),
    );
  }

  async setActive(
    headers: IncomingHttpHeaders,
    teamId: string,
  ): Promise<WorkspaceResponseDto | null> {
    const result = await invokeOrganizationApi(() =>
      auth.api.setActiveTeam({
        body: { teamId },
        headers: this.headers(headers),
      }),
    );
    return result ? mapWorkspace(result) : null;
  }

  async listForOrganization(
    headers: IncomingHttpHeaders,
    organizationId?: string,
  ): Promise<WorkspaceResponseDto[]> {
    const result = await invokeOrganizationApi(() =>
      auth.api.listOrganizationTeams({
        query: organizationId ? { organizationId } : {},
        headers: this.headers(headers),
      }),
    );
    return mapWorkspaces(result);
  }

  async listForCaller(headers: IncomingHttpHeaders): Promise<WorkspaceResponseDto[]> {
    const result = await invokeOrganizationApi(() =>
      auth.api.listUserTeams({ headers: this.headers(headers) }),
    );
    return mapWorkspaces(result);
  }

  async listMembers(
    headers: IncomingHttpHeaders,
    teamId: string,
  ): Promise<WorkspaceMemberResponseDto[]> {
    const result = await invokeOrganizationApi(() =>
      auth.api.listTeamMembers({
        query: { teamId },
        headers: this.headers(headers),
      }),
    );
    return mapWorkspaceMembers(result);
  }

  async addMember(
    headers: IncomingHttpHeaders,
    teamId: string,
    userId: string,
  ): Promise<WorkspaceMemberResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.addTeamMember({
        body: { teamId, userId },
        headers: this.headers(headers),
      }),
    );
    return mapWorkspaceMember(result);
  }

  async removeMember(headers: IncomingHttpHeaders, teamId: string, userId: string): Promise<void> {
    await invokeOrganizationApi(() =>
      auth.api.removeTeamMember({
        body: { teamId, userId },
        headers: this.headers(headers),
      }),
    );
  }
}
