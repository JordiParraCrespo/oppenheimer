import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
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
import type { WorkSessionEntity } from '../../domain/work-session.entity';
import { SessionResponseDto } from '../../dtos/session.response.dto';
import { FindSessionQuery } from '../../queries/find-session/find-session.query';
import { WorkSessionMapper } from '../../work-session.mapper';
import { RestartSessionCommand } from './restart-session.command';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class RestartSessionHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: WorkSessionMapper,
  ) {}

  @Post(':id/restart')
  // 200, not Nest's default 201 for a POST: this creates nothing. It acts on a
  // session that already exists and answers with that session. The Swagger
  // response below has always said 200 — the runtime did not, and the one test
  // that would have caught it was skipped for want of an installation.
  @HttpCode(HttpStatus.OK)
  @Version('1')
  // `update Session`, not a verb of its own: the CASL model stays CRUD plus
  // `manage`, and what separates this from a read is the `sessions:write` scope.
  @CheckPolicies({ action: 'update', subject: 'Session' })
  @RequireScopes('sessions:write')
  @ApiOperation({
    operationId: 'restartSession',
    summary: 'Restart a session',
    description:
      'Recreates window 0 in the worktrees the session already has — what a host reboot needs. It records a request: the session becomes open when the host says it did.',
  })
  @ApiResponse({ status: 200, type: SessionResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  @ApiProblemResponse({ status: 409, description: 'That session is closed', code: 'SESSIONS_005' })
  async restart(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SessionResponseDto> {
    const { sessionId, hints } = await this.commandBus.execute<
      RestartSessionCommand,
      SessionCommandResult
    >(new RestartSessionCommand({ scope, sessionId: id }));
    const session = await this.queryBus.execute<FindSessionQuery, WorkSessionEntity>(
      new FindSessionQuery({ scope, sessionId }),
    );
    return this.mapper.toResponse(session, { hints });
  }
}
