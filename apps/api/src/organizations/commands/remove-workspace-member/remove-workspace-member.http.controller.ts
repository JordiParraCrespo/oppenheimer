import {
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { WorkspaceProblemResponses } from '../../decorators/workspace-problem-responses.decorator';
import { RemoveWorkspaceMemberCommand } from './remove-workspace-member.command';

@ApiTags('Workspaces')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@WorkspaceProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('workspaces')
export class RemoveWorkspaceMemberHttpController {
  constructor(private readonly commandBus: CommandBus) {}

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
    return this.commandBus.execute<RemoveWorkspaceMemberCommand, void>(
      new RemoveWorkspaceMemberCommand({ headers: req.headers, workspaceId: id, userId }),
    );
  }
}
