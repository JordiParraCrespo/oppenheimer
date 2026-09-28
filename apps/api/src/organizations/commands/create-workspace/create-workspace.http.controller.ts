import { Body, Controller, Post, Req, UseGuards, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { OrganizationScoped } from '../../../auth/decorators/organization-scoped.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import {
  type TenantRequest,
  tenantOrganizationIdOf,
} from '../../../auth/domain/request-tenant.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { WorkspaceProblemResponses } from '../../decorators/workspace-problem-responses.decorator';
import { WorkspaceResponseDto } from '../../dtos/workspace.response.dto';
import { CreateWorkspaceCommand } from './create-workspace.command';
import { CreateWorkspaceRequest } from './create-workspace.request.dto';

@ApiTags('Workspaces')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@WorkspaceProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('workspaces')
export class CreateWorkspaceHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @Version('1')
  @RequireScopes('workspaces:write')
  @OrganizationScoped('organizationId', 'body')
  @CheckPolicies({ action: 'create', subject: 'Workspace' })
  @ApiOperation({ summary: 'Create a workspace' })
  @ApiResponse({ status: 201, type: WorkspaceResponseDto })
  create(
    @Req() req: Request & TenantRequest,
    @Body() body: CreateWorkspaceRequest,
  ): Promise<WorkspaceResponseDto> {
    return this.commandBus.execute<CreateWorkspaceCommand, WorkspaceResponseDto>(
      new CreateWorkspaceCommand({
        headers: req.headers,
        name: body.name,
        organizationId: tenantOrganizationIdOf(req) ?? undefined,
      }),
    );
  }
}
