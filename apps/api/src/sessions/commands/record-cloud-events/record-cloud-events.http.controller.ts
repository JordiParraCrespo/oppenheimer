import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
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
import { RecordedCloudEventsResponseDto } from '../../dtos/session-cloud-chat.response.dto';
import { RecordCloudEventsCommand } from './record-cloud-events.command';
import type { RecordCloudEventsResult } from './record-cloud-events.command-handler';
import { RecordCloudEventsRequest } from './record-cloud-events.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class RecordCloudEventsHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('cloud-events')
  @HttpCode(HttpStatus.OK)
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'Session' })
  // Both: the person's sessions and their cloud chats. `sessions:write` alone
  // (an `opp` or MCP token) never reads or takes the replies they type.
  @RequireScopes('sessions:write', 'cloud-chat:write')
  // The extension reads each running session every few seconds, in batches.
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Send events of a Claude Code cloud session’s log on claude.ai',
    description:
      'What the browser extension reads from claude.ai with the person’s own sign-in: events of a Claude Code cloud session’s log, oldest first, each the transcript entry claude.ai keeps. They become the session’s chat in the console, replacing the transcript its hook sent. A session this workspace does not know yet is adopted, in the unassigned project; one closed here keeps nothing (`sessionId: null`). An event already held is skipped, so sending a batch again stores nothing twice.',
  })
  @ApiOkResponse({ type: RecordedCloudEventsResponseDto })
  @ApiProblemResponse({
    status: 409,
    description: 'The session with that id is not a Claude Code cloud session',
    code: 'SESSIONS_054',
  })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async record(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @Body() body: RecordCloudEventsRequest,
  ): Promise<RecordedCloudEventsResponseDto> {
    return this.commandBus.execute<RecordCloudEventsCommand, RecordCloudEventsResult>(
      new RecordCloudEventsCommand({
        scope,
        userId,
        cloudSessionId: body.cloudSessionId,
        title: body.title,
        events: body.events,
        from: body.from,
      }),
    );
  }
}
