import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { SessionChangesResponse } from '@oppenheimer/shared';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { SessionChangesResponseDto } from '../../dtos/session-changes.response.dto';
import { FindSessionChangesQuery } from './find-session-changes.query';
import { FindSessionChangesRequest } from './find-session-changes.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class FindSessionChangesHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id/changes')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Session' })
  @RequireScopes('sessions:read')
  // The Review reads this when it opens, when a turn ends and from its
  // button: git over every checkout on somebody's machine each time.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: "Read a session's changes",
    description:
      "What each of the session's checkouts changed, read with git on its host now: every changed file with its status, its line counts and its unified diff. `base` (the default) is everything since the branch left its base, commits and edits not committed yet; `uncommitted` only the edits not committed yet. Untracked files are included. A read is bounded: past 500 files a checkout counts the rest, and patches stop at 64 KiB a file and 256 KiB a read, the files keeping their counts; an answer that would not fit the host's link drops patches, then files, from its last checkout, counting them. Nothing is cached.",
  })
  @ApiQuery({
    name: 'scope',
    required: false,
    enum: ['base', 'uncommitted'],
    description: 'What to compare with; `base` when absent',
  })
  @ApiResponse({ status: 200, type: SessionChangesResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  @ApiProblemResponse({ status: 409, description: 'That session is closed', code: 'SESSIONS_005' })
  @ApiProblemResponse({ status: 504, description: 'No answer in time', code: 'SESSIONS_031' })
  async read(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FindSessionChangesRequest,
  ): Promise<SessionChangesResponseDto> {
    return this.queryBus.execute<FindSessionChangesQuery, SessionChangesResponse>(
      new FindSessionChangesQuery({ scope, sessionId: id, compare: query.scope }),
    );
  }
}
