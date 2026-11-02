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
import { DeleteWorkspaceCommand } from './delete-workspace.command';

@ApiTags('Workspaces')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@WorkspaceProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('workspaces')
export class DeleteWorkspaceHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id')
  @Version('1')
  @RequireScopes('workspaces:write')
  @HttpCode(204)
  @CheckPolicies({ action: 'delete', subject: 'Workspace' })
  @ApiOperation({ summary: 'Delete a workspace' })
  @ApiResponse({ status: 204 })
  remove(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.commandBus.execute<DeleteWorkspaceCommand, void>(
      new DeleteWorkspaceCommand({ headers: req.headers, workspaceId: id }),
    );
  }
}
