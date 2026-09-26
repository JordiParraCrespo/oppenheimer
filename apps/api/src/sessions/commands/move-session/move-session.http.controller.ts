import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { SessionCommandResult } from '../../domain/session-command.types';
import { SessionResponseDto } from '../../dtos/session.response.dto';
import { WorkSessionMapper } from '../../work-session.mapper';
import { MoveSessionCommand } from './move-session.command';
import { MoveSessionRequest } from './move-session.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class MoveSessionHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly mapper: WorkSessionMapper,
  ) {}

  @Post(':id/move')
  @HttpCode(200)
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Session' })
  @RequireScopes('sessions:write')
  @ApiOperation({
    operationId: 'moveSession',
    summary: 'Move a session to another project',
    description:
      'Only a project that includes every repository the session checked out can take it. The branch and the worktree stay where they are: the directory carries the slug of the project that created the session, and nothing on the host changes.',
  })
  @ApiResponse({ status: 200, type: SessionResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  @ApiProblemResponse({ status: 404, description: 'Project not found', code: 'PROJECTS_001' })
  @ApiProblemResponse({ status: 409, description: 'That session is closed', code: 'SESSIONS_005' })
  @ApiProblemResponse({ status: 409, description: 'That project is archived', code: 'SESSIONS_006' })
  @ApiProblemResponse({
    status: 409,
    description: 'That project does not include this session’s repository',
    code: 'SESSIONS_018',
  })
  async move(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MoveSessionRequest,
  ): Promise<SessionResponseDto> {
    const { session, hints } = await this.commandBus.execute<
      MoveSessionCommand,
      SessionCommandResult
    >(new MoveSessionCommand({ scope, sessionId: id, projectId: body.projectId }));
    return this.mapper.toResponse(session, { hints });
  }
}
