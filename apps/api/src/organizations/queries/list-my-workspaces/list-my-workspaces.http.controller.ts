import { Controller, Get, Req, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentScope } from '../../../auth/decorators/current-scope.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import type { ScopeContext } from '../../../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { WorkspaceProblemResponses } from '../../decorators/workspace-problem-responses.decorator';
import { WorkspaceResponseDto } from '../../dtos/workspace.response.dto';
import { ListMyWorkspacesQuery } from './list-my-workspaces.query';

@ApiTags('Workspaces')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@WorkspaceProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('workspaces')
export class ListMyWorkspacesHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('mine')
  @Version('1')
  @RequireScopes('workspaces:read')
  @CheckPolicies({ action: 'read', subject: 'Workspace' })
  @ApiOperation({ summary: "List the caller's workspaces" })
  @ApiResponse({ status: 200, type: [WorkspaceResponseDto] })
  listMine(
    @Req() req: Request,
    @CurrentScope() scope: ScopeContext | null,
  ): Promise<WorkspaceResponseDto[]> {
    return this.queryBus.execute<ListMyWorkspacesQuery, WorkspaceResponseDto[]>(
      new ListMyWorkspacesQuery({ headers: req.headers, resourceScope: scope?.resourceScope }),
    );
  }
}
