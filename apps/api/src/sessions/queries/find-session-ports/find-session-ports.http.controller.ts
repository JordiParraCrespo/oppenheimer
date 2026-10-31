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
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { RequireFlag } from '../../../feature-flags/decorators/require-flag.decorator';
import { SessionPortsResponseDto } from '../../dtos/session.response.dto';
import { FindSessionPortsQuery } from './find-session-ports.query';
import type { SessionPortsRead } from './find-session-ports.query-handler';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class FindSessionPortsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id/ports')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Session' })
  @RequireScopes('sessions:read')
  @RequireFlag('session_browser_preview')
  // The Browser tab polls this while it waits for a dev server, each a round
  // trip to somebody's machine.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'List the ports a session listens on',
    description:
      "The TCP ports the session's own processes listen on, from 1024 up, asked of its host's runner now: what its Browser tab can open. Nothing is cached.",
  })
  @ApiResponse({ status: 200, type: SessionPortsResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  @ApiProblemResponse({ status: 409, description: 'That session is closed', code: 'SESSIONS_005' })
  @ApiProblemResponse({ status: 504, description: 'No answer in time', code: 'SESSIONS_031' })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SessionPortsResponseDto> {
    return this.queryBus.execute<FindSessionPortsQuery, SessionPortsRead>(
      new FindSessionPortsQuery({ scope, sessionId: id }),
    );
  }
}
