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
import { Throttle } from '@nestjs/throttler';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { OpenedSessionWindowResponse } from '@oppenheimer/shared';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { OpenedSessionWindowResponseDto } from '../../dtos/session.response.dto';
import { OpenSessionWindowCommand } from './open-session-window.command';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class OpenSessionWindowHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/windows')
  @Version('1')
  // A shell on the session's host is a terminal: `update Session`, like an attach ticket.
  @CheckPolicies({ action: 'update', subject: 'Session' })
  @RequireScopes('sessions:write')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Open a terminal in a session',
    description:
      "Opens a plain shell in the session's worktree, a new tmux window on its host, and answers with its index (mint an attach ticket for that `window` to stream it) and every window after it.",
  })
  @ApiResponse({ status: 201, type: OpenedSessionWindowResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  @ApiProblemResponse({ status: 409, description: 'That session is closed', code: 'SESSIONS_005' })
  @ApiProblemResponse({
    status: 409,
    description: "This host's runner cannot open or close a session's terminals",
    code: 'SESSIONS_056',
  })
  @ApiProblemResponse({
    status: 409,
    description: "The host refused to change the session's terminals",
    code: 'SESSIONS_059',
  })
  @ApiProblemResponse({ status: 503, description: 'The host is offline', code: 'SESSIONS_016' })
  @ApiProblemResponse({ status: 504, description: 'No answer in time', code: 'SESSIONS_031' })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async open(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OpenedSessionWindowResponseDto> {
    return this.commandBus.execute<OpenSessionWindowCommand, OpenedSessionWindowResponse>(
      new OpenSessionWindowCommand({ scope, sessionId: id }),
    );
  }
}
