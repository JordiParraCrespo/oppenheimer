import { Controller, Get, Param, ParseUUIDPipe, Req, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { WorkspaceProblemResponses } from '../../decorators/workspace-problem-responses.decorator';
import { WorkspaceMemberResponseDto } from '../../dtos/workspace.response.dto';
import { ListWorkspaceMembersQuery } from './list-workspace-members.query';

@ApiTags('Workspaces')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@WorkspaceProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('workspaces')
export class ListWorkspaceMembersHttpController {
  constructor(private readonly queryBus: QueryBus) {}

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
    return this.queryBus.execute<ListWorkspaceMembersQuery, WorkspaceMemberResponseDto[]>(
      new ListWorkspaceMembersQuery({ headers: req.headers, workspaceId: id }),
    );
  }
}
