import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { WorkspaceResponseDto } from '../../dtos/workspace.response.dto';
import { RenameWorkspaceCommand } from './rename-workspace.command';
import { UpdateWorkspaceRequest } from './rename-workspace.request.dto';

@ApiTags('Workspaces')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@WorkspaceProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('workspaces')
export class RenameWorkspaceHttpController {
  constructor(private readonly commandBus: CommandBus) {}

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
    return this.commandBus.execute<RenameWorkspaceCommand, WorkspaceResponseDto>(
      new RenameWorkspaceCommand({ headers: req.headers, workspaceId: id, name: body.name }),
    );
  }
}
