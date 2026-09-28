import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { isOrganizationAllowed } from '@oppenheimer/shared';
import type { Request } from 'express';
import { CheckPolicies } from '../auth/decorators/check-policies.decorator';
import { CurrentScope } from '../auth/decorators/current-scope.decorator';
import { OrganizationScoped } from '../auth/decorators/organization-scoped.decorator';
import { RequireScopes } from '../auth/decorators/require-scopes.decorator';
import { type TenantRequest, tenantOrganizationIdOf } from '../auth/domain/request-tenant.types';
import type { ScopeContext } from '../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../auth/guards/policies.guard';
import {
  AddWorkspaceMemberRequest,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
} from './dtos/organization.request.dto';
import { WorkspaceMemberResponseDto, WorkspaceResponseDto } from './dtos/workspace.response.dto';
import { WorkspacesService } from './workspaces.service';

/**
 * Workspace (Better Auth team) endpoints, delegating to the organization plugin.
 * Static routes are ordered before parameterized ones.
 */
@ApiTags('Workspaces')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@ApiProblemResponse({
  status: 404,
  description: 'The workspace, its organization, or the member does not exist',
  code: ['ORG_012', 'ORG_001', 'ORG_005'],
})
@ApiProblemResponse({
  status: 502,
  description: 'The organization service failed to handle the request',
  code: 'ORG_016',
})
@ApiProblemResponse({
  status: 403,
  description: 'The caller is not a member, or their org role does not allow managing workspaces',
  code: ['ORG_003', 'ORG_004'],
})
@ApiProblemResponse({
  status: 409,
  description: 'A workspace with that name exists, or a workspace limit was reached',
  code: ['ORG_013', 'ORG_014'],
})
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get('mine')
  @Version('1')
  @RequireScopes('workspaces:read')
  @CheckPolicies({ action: 'read', subject: 'Workspace' })
  @ApiOperation({ summary: "List the caller's workspaces" })
  @ApiResponse({ status: 200, type: [WorkspaceResponseDto] })
  async listMyWorkspaces(
    @Req() req: Request,
    @CurrentScope() scope: ScopeContext | null,
  ): Promise<WorkspaceResponseDto[]> {
    const workspaces = await this.workspaces.listForCaller(req.headers);
    // Same rule as `GET /organizations`: a collection names no organization
    // for `ScopesGuard`, so the token's restriction is applied per row.
    return workspaces.filter((workspace) =>
      isOrganizationAllowed(scope?.resourceScope, workspace.organizationId),
    );
  }

  @Get()
  @Version('1')
  @RequireScopes('workspaces:read')
  @OrganizationScoped('organizationId', 'query')
  @CheckPolicies({ action: 'read', subject: 'Workspace' })
  @ApiOperation({
    summary: "List an organization's workspaces (defaults to the active org)",
  })
  @ApiQuery({ name: 'organizationId', required: false, type: String })
  @ApiResponse({ status: 200, type: [WorkspaceResponseDto] })
  listWorkspaces(@Req() req: Request & TenantRequest): Promise<WorkspaceResponseDto[]> {
    // The request's tenant: the `organizationId` query field, or the
    // session's organization — the one the request was authorized in.
    return this.workspaces.listForOrganization(
      req.headers,
      tenantOrganizationIdOf(req) ?? undefined,
    );
  }

  @Post()
  @Version('1')
  @RequireScopes('workspaces:write')
  @OrganizationScoped('organizationId', 'body')
  @CheckPolicies({ action: 'create', subject: 'Workspace' })
  @ApiOperation({ summary: 'Create a workspace' })
  @ApiResponse({ status: 201, type: WorkspaceResponseDto })
  createWorkspace(
    @Req() req: Request & TenantRequest,
    @Body() body: CreateWorkspaceRequest,
  ): Promise<WorkspaceResponseDto> {
    return this.workspaces.create(req.headers, {
      ...body,
      organizationId: tenantOrganizationIdOf(req) ?? undefined,
    });
  }

  @Patch(':id')
  @Version('1')
  @RequireScopes('workspaces:write')
  @CheckPolicies({ action: 'update', subject: 'Workspace' })
  @ApiOperation({ summary: 'Rename a workspace' })
  @ApiResponse({ status: 200, type: WorkspaceResponseDto })
  updateWorkspace(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateWorkspaceRequest,
  ): Promise<WorkspaceResponseDto> {
    return this.workspaces.update(req.headers, id, body);
  }

  @Delete(':id')
  @Version('1')
  @RequireScopes('workspaces:write')
  @HttpCode(204)
  @CheckPolicies({ action: 'delete', subject: 'Workspace' })
  @ApiOperation({ summary: 'Delete a workspace' })
  @ApiResponse({ status: 204 })
  deleteWorkspace(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.workspaces.remove(req.headers, id);
  }

  @Post(':id/set-active')
  @Version('1')
  @RequireScopes('workspaces:read')
  @CheckPolicies({ action: 'read', subject: 'Workspace' })
  @ApiOperation({
    summary: 'Set the active workspace for the current session',
  })
  @ApiResponse({ status: 200, type: WorkspaceResponseDto })
  setActiveWorkspace(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WorkspaceResponseDto | null> {
    return this.workspaces.setActive(req.headers, id);
  }

  @Get(':id/members')
  @Version('1')
  @RequireScopes('workspaces:read')
  @CheckPolicies({ action: 'read', subject: 'Workspace' })
  @ApiOperation({ summary: 'List members of a workspace' })
  @ApiResponse({ status: 200, type: [WorkspaceMemberResponseDto] })
  listMembers(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WorkspaceMemberResponseDto[]> {
    return this.workspaces.listMembers(req.headers, id);
  }

  @Post(':id/members')
  @Version('1')
  @RequireScopes('workspaces:write')
  @CheckPolicies({ action: 'update', subject: 'Workspace' })
  @ApiOperation({ summary: 'Add a user to a workspace' })
  @ApiResponse({ status: 201, type: WorkspaceMemberResponseDto })
  addMember(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AddWorkspaceMemberRequest,
  ): Promise<WorkspaceMemberResponseDto> {
    return this.workspaces.addMember(req.headers, id, body.userId);
  }

  @Delete(':id/members/:userId')
  @Version('1')
  @RequireScopes('workspaces:write')
  @HttpCode(204)
  @CheckPolicies({ action: 'update', subject: 'Workspace' })
  @ApiOperation({ summary: 'Remove a user from a workspace' })
  @ApiResponse({ status: 204 })
  removeMember(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.workspaces.removeMember(req.headers, id, userId);
  }
}
