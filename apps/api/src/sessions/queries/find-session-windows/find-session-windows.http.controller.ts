import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { SessionWindowsResponse } from '@oppenheimer/shared';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { SessionWindowsResponseDto } from '../../dtos/session.response.dto';
import { FindSessionWindowsQuery } from './find-session-windows.query';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class FindSessionWindowsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id/windows')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Session' })
  @RequireScopes('sessions:read')
  // The Terminal tab reads this on open and after each change, a round trip
  // to somebody's machine each.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: "List a session's terminal windows",
    description:
      "The session's tmux windows, asked of its host's runner now: window 0 is the agent, 1 and up the plain shells its Terminal tab opened in its worktree. An attach ticket's `window` names one. Nothing is cached.",
  })
  @ApiResponse({ status: 200, type: SessionWindowsResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  @ApiProblemResponse({ status: 409, description: 'That session is closed', code: 'SESSIONS_005' })
  @ApiProblemResponse({ status: 504, description: 'No answer in time', code: 'SESSIONS_031' })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SessionWindowsResponseDto> {
    return this.queryBus.execute<FindSessionWindowsQuery, SessionWindowsResponse>(
      new FindSessionWindowsQuery({ scope, sessionId: id }),
    );
  }
}
