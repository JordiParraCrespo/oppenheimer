import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Put,
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
import { SessionShareResponseDto } from '../../dtos/session-share.response.dto';
import {
  FindSessionShareQuery,
  type FoundSessionShare,
} from '../../queries/find-session-share/find-session-share.query';
import { SessionShareMapper } from '../../session-share.mapper';
import { PutSessionShareCommand } from './put-session-share.command';
import { PutSessionShareRequest } from './put-session-share.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class PutSessionShareHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: SessionShareMapper,
  ) {}

  @Put(':id/share')
  @Version('1')
  // Sharing a terminal is opening one for somebody else: `update Session`.
  @CheckPolicies({ action: 'update', subject: 'Session' })
  @RequireScopes('sessions:write')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Share this session’s terminal',
    description:
      'Named people, or anyone signed in with the address. `read` watches; `write` types, as you, for named people only and for 24 hours at most. Sharing again replaces the settings and keeps the address.',
  })
  @ApiResponse({ status: 200, type: SessionShareResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  @ApiProblemResponse({ status: 409, description: 'That session is closed', code: 'SESSIONS_005' })
  async put(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PutSessionShareRequest,
  ): Promise<SessionShareResponseDto> {
    await this.commandBus.execute(
      new PutSessionShareCommand({ scope, sessionId: id, userId, share: body }),
    );
    const found = await this.queryBus.execute<FindSessionShareQuery, FoundSessionShare | null>(
      new FindSessionShareQuery({ scope, sessionId: id }),
    );
    // Just written in the same scope; absent only if the session vanished between.
    if (!found) throw new Error('a session share was written and could not be read back');
    return this.mapper.toResponse(found.share, found.owner);
  }
}
