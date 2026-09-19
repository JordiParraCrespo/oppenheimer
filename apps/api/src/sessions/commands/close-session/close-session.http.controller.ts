import {
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { CloseSessionCommand } from './close-session.command';
import { CloseSessionRequest } from './close-session.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class CloseSessionHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly mapper: WorkSessionMapper,
  ) {}

  @Delete(':id')
  @Version('1')
  @CheckPolicies({ action: 'delete', subject: 'Session' })
  @RequireScopes('sessions:write')
  @ApiOperation({
    operationId: 'closeSession',
    summary: 'Close a session',
    description:
      'Pushes each checkout’s branch, then removes the worktrees and prunes. The row is never deleted: its slug is the session’s directory name on the host and a retired name is never reissued, because the coding agents key their conversation state by working directory. Refuses when a checkout has unpushed work unless the loss is accepted.',
  })
  @ApiQuery({
    name: 'acceptUnpushedWork',
    required: false,
    type: Boolean,
    description: 'Accept losing work that is not pushed. The refusal is the default.',
  })
  @ApiResponse({ status: 200, type: SessionResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  async close(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CloseSessionRequest,
  ): Promise<SessionResponseDto> {
    const session = await this.commandBus.execute<CloseSessionCommand, WorkSessionEntity>(
      new CloseSessionCommand({
        scope,
        sessionId: id,
        acceptUnpushedWork: query.acceptUnpushedWork ?? false,
      }),
    );
    return this.mapper.toResponse(session);
  }
}
