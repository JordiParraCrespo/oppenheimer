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
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { SessionCommandResult } from '../../domain/session-command.types';
import type { WorkSessionEntity } from '../../domain/work-session.entity';
import { SentSessionPromptResponseDto } from '../../dtos/session.response.dto';
import { FindSessionQuery } from '../../queries/find-session/find-session.query';
import { WorkSessionMapper } from '../../work-session.mapper';
import { SendSessionPromptCommand } from './send-session-prompt.command';
import { SendSessionPromptRequest } from './send-session-prompt.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class SendSessionPromptHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: WorkSessionMapper,
  ) {}

  @Post(':id/prompt')
  @HttpCode(HttpStatus.OK)
  @Version('1')
  // Input to the session's terminal, like a decision's answer: the same policy and scope.
  @CheckPolicies({ action: 'update', subject: 'Session' })
  @RequireScopes('sessions:write')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Send a follow-up prompt to a session’s agent',
    description:
      'Types `text` into the session’s agent and submits it, the way the chat view sends a message, recorded in the log as sent by the caller. Only while the agent waits at its prompt (the session’s state `idle` or `ready-for-review`): while it works, wait; when it asks something, answer its `decision`. Answers the `seq` its `prompt.sent` entry took, from which the agent’s answer follows in the log, and the session.',
  })
  @ApiResponse({ status: 200, type: SentSessionPromptResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  @ApiProblemResponse({ status: 409, description: 'That session is closed', code: 'SESSIONS_005' })
  @ApiProblemResponse({ status: 409, description: 'That session is stopped', code: 'SESSIONS_014' })
  @ApiProblemResponse({
    status: 409,
    description: 'The agent is not waiting for a prompt',
    code: 'SESSIONS_036',
  })
  @ApiProblemResponse({ status: 503, description: 'The host is offline', code: 'SESSIONS_016' })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async send(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendSessionPromptRequest,
  ): Promise<SentSessionPromptResponseDto> {
    const { sessionId, seq } = await this.commandBus.execute<
      SendSessionPromptCommand,
      SessionCommandResult
    >(
      new SendSessionPromptCommand({
        scope,
        sessionId: id,
        text: body.text,
        sender: { kind: 'person', userId },
      }),
    );
    const session = await this.queryBus.execute<FindSessionQuery, WorkSessionEntity>(
      new FindSessionQuery({ scope, sessionId }),
    );
    // The handler records the entry before it types, so a sent prompt always has one.
    return { seq: seq ?? 0, session: this.mapper.toResponse(session) };
  }
}
