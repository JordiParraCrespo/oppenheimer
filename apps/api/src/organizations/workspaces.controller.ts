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
  Query,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { CheckPolicies } from '../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../auth/decorators/require-scopes.decorator';
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
  listMine(@Req() req: Request): Promise<WorkspaceResponseDto[]> {
    return this.workspaces.listForCaller(req.headers);
  }

  @Get()
  @Version('1')
  @RequireScopes('workspaces:read')
  @CheckPolicies({ action: 'read', subject: 'Workspace' })
  @ApiOperation({
    summary: "List an organization's workspaces (defaults to the active org)",
  })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiResponse({ status: 200, type: [WorkspaceResponseDto] })
  list(
    @Req() req: Request,
    @Query('organizationId') organizationId?: string,
  ): Promise<WorkspaceResponseDto[]> {
    return this.workspaces.listForOrganization(req.headers, organizationId);
  }

  @Post()
  @Version('1')
  @RequireScopes('workspaces:write')
  @CheckPolicies({ action: 'create', subject: 'Workspace' })
  @ApiOperation({ summary: 'Create a workspace' })
  @ApiResponse({ status: 201, type: WorkspaceResponseDto })
  create(@Req() req: Request, @Body() body: CreateWorkspaceRequest): Promise<WorkspaceResponseDto> {
    return this.workspaces.create(req.headers, body);
  }

  @Patch(':id')
  @Version('1')
  @RequireScopes('workspaces:write')
  @CheckPolicies({ action: 'update', subject: 'Workspace' })
  @ApiOperation({ summary: 'Rename a workspace' })
  @ApiResponse({ status: 200, type: WorkspaceResponseDto })
  update(
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
  remove(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.workspaces.remove(req.headers, id);
  }

  @Post(':id/set-active')
  @Version('1')
  @RequireScopes('workspaces:read')
  @CheckPolicies({ action: 'read', subject: 'Workspace' })
  @ApiOperation({ summary: 'Set the active workspace for the current session' })
  @ApiResponse({ status: 200, type: WorkspaceResponseDto })
  setActive(
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
