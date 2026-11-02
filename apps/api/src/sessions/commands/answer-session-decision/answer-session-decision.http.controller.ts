import {
  Body,
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
import { Throttle } from '@nestjs/throttler';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { SessionCommandResult } from '../../domain/session-command.types';
import type { WorkSessionEntity } from '../../domain/work-session.entity';
import { SessionResponseDto } from '../../dtos/session.response.dto';
import { FindSessionQuery } from '../../queries/find-session/find-session.query';
import { WorkSessionMapper } from '../../work-session.mapper';
import { AnswerSessionDecisionCommand } from './answer-session-decision.command';
import { AnswerSessionDecisionRequest } from './answer-session-decision.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class AnswerSessionDecisionHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: WorkSessionMapper,
  ) {}

  @Post(':id/decision')
  @HttpCode(HttpStatus.OK)
  @Version('1')
  // Input to the session's terminal, like a paste: the same policy and scope.
  @CheckPolicies({ action: 'update', subject: 'Session' })
  @RequireScopes('sessions:write')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Answer what a session’s agent waits on',
    description:
      'Answers the session’s pending `decision` — a question the agent asked, or a permission dialog — by typing into its terminal the keys a person would. The body names the decision by its `id`: a question takes one answer per question (`picks` by option index, and `other` for words of your own), a permission one `option` by index. Answers the session, its decision cleared.',
  })
  @ApiResponse({ status: 200, type: SessionResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  @ApiProblemResponse({ status: 409, description: 'That session is closed', code: 'SESSIONS_005' })
  @ApiProblemResponse({ status: 409, description: 'That session is stopped', code: 'SESSIONS_014' })
  @ApiProblemResponse({
    status: 409,
    description: 'Already answered or changed',
    code: 'SESSIONS_032',
  })
  @ApiProblemResponse({ status: 422, description: 'The answer does not fit', code: 'SESSIONS_033' })
  @ApiProblemResponse({ status: 503, description: 'The host is offline', code: 'SESSIONS_034' })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async answer(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AnswerSessionDecisionRequest,
  ): Promise<SessionResponseDto> {
    const { sessionId } = await this.commandBus.execute<
      AnswerSessionDecisionCommand,
      SessionCommandResult
    >(new AnswerSessionDecisionCommand({ scope, sessionId: id, answer: body }));
    const session = await this.queryBus.execute<FindSessionQuery, WorkSessionEntity>(
      new FindSessionQuery({ scope, sessionId }),
    );
    return this.mapper.toResponse(session);
  }
}
