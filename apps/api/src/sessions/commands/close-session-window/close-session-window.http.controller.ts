import {
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { ClosedSessionWindowResponse } from '@oppenheimer/shared';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { ClosedSessionWindowResponseDto } from '../../dtos/session.response.dto';
import { CloseSessionWindowCommand } from './close-session-window.command';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class CloseSessionWindowHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id/windows/:window')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Session' })
  @RequireScopes('sessions:write')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Close a terminal in a session',
    description:
      "Closes one of the session's shells (a tmux window from 1 up) on its host, and answers with the windows left. Window 0 is the agent and is refused: close the session instead.",
  })
  @ApiParam({ name: 'window', type: Number, description: 'The tmux window index, from 1 up.' })
  @ApiResponse({ status: 200, type: ClosedSessionWindowResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  @ApiProblemResponse({
    status: 404,
    description: 'The session has no such terminal',
    code: 'SESSIONS_058',
  })
  @ApiProblemResponse({ status: 409, description: 'That session is closed', code: 'SESSIONS_005' })
  @ApiProblemResponse({
    status: 409,
    description: "This host's runner cannot open or close a session's terminals",
    code: 'SESSIONS_056',
  })
  @ApiProblemResponse({
    status: 409,
    description: "The agent's window cannot be closed; close the session instead",
    code: 'SESSIONS_057',
  })
  @ApiProblemResponse({
    status: 409,
    description: "The host refused to change the session's terminals",
    code: 'SESSIONS_059',
  })
  @ApiProblemResponse({ status: 503, description: 'The host is offline', code: 'SESSIONS_016' })
  @ApiProblemResponse({ status: 504, description: 'No answer in time', code: 'SESSIONS_031' })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async close(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('window', ParseIntPipe) window: number,
  ): Promise<ClosedSessionWindowResponseDto> {
    return this.commandBus.execute<CloseSessionWindowCommand, ClosedSessionWindowResponse>(
      new CloseSessionWindowCommand({ scope, sessionId: id, window }),
    );
  }
}
