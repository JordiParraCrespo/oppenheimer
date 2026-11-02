import { Controller, Get, Req, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { ListWorkspacesQuery } from './list-workspaces.query';

@ApiTags('Workspaces')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@WorkspaceProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('workspaces')
export class ListWorkspacesHttpController {
  constructor(private readonly queryBus: QueryBus) {}

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
  list(@Req() req: Request & TenantRequest): Promise<WorkspaceResponseDto[]> {
    // The request's tenant: the `organizationId` query field, or the
    // session's organization — the one the request was authorized in.
    return this.queryBus.execute<ListWorkspacesQuery, WorkspaceResponseDto[]>(
      new ListWorkspacesQuery({
        headers: req.headers,
        organizationId: tenantOrganizationIdOf(req) ?? undefined,
      }),
    );
  }
}
