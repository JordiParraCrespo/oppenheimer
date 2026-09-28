import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
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
import { FindWorkspaceMemberQuery } from '../../queries/find-workspace-member/find-workspace-member.query';
import { AddWorkspaceMemberCommand } from './add-workspace-member.command';
import { AddWorkspaceMemberRequest } from './add-workspace-member.request.dto';

@ApiTags('Workspaces')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@WorkspaceProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('workspaces')
export class AddWorkspaceMemberHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post(':id/members')
  @Version('1')
  @RequireScopes('workspaces:write')
  @CheckPolicies({ action: 'update', subject: 'Workspace' })
  @ApiOperation({ summary: 'Add a user to a workspace' })
  @ApiResponse({ status: 201, type: WorkspaceMemberResponseDto })
  async addMember(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AddWorkspaceMemberRequest,
  ): Promise<WorkspaceMemberResponseDto> {
    await this.commandBus.execute<AddWorkspaceMemberCommand, void>(
      new AddWorkspaceMemberCommand({ headers: req.headers, workspaceId: id, userId: body.userId }),
    );
    return this.queryBus.execute<FindWorkspaceMemberQuery, WorkspaceMemberResponseDto>(
      new FindWorkspaceMemberQuery({ workspaceId: id, userId: body.userId }),
    );
  }
}
