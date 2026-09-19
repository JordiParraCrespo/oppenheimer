import {
  Controller,
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
import type { WorkSessionEntity } from '../../domain/work-session.entity';
import { SessionResponseDto } from '../../dtos/session.response.dto';
import { WorkSessionMapper } from '../../work-session.mapper';
import { StopSessionCommand } from './stop-session.command';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class StopSessionHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly mapper: WorkSessionMapper,
  ) {}

  @Post(':id/stop')
  @Version('1')
  // `update Session`, not a verb of its own: the CASL model stays CRUD plus
  // `manage`, and what separates this from a read is the `sessions:write` scope.
  @CheckPolicies({ action: 'update', subject: 'Session' })
  @RequireScopes('sessions:write')
  @ApiOperation({
    operationId: 'stopSession',
    summary: 'Stop a session',
    description:
      'Ends the agent and the tmux session and leaves every checkout on disk, so a restart recreates window 0 in the same worktrees. Stopping is not closing: the session is exactly as unfinished as it was.',
  })
  @ApiResponse({ status: 200, type: SessionResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  @ApiProblemResponse({ status: 409, description: 'That session is closed', code: 'SESSIONS_005' })
  async stop(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SessionResponseDto> {
    const session = await this.commandBus.execute<StopSessionCommand, WorkSessionEntity>(
      new StopSessionCommand({ scope, sessionId: id }),
    );
    return this.mapper.toResponse(session);
  }
}
