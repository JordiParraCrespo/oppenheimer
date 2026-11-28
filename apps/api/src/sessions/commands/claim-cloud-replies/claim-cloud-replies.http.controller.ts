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
import type { BrowserCloudReply } from '../../database/session-cloud-chat.repository.port';
import { ClaimedCloudRepliesResponseDto } from '../../dtos/session-cloud-chat.response.dto';
import { SessionCloudChatMapper } from '../../session-cloud-chat.mapper';
import { ClaimCloudRepliesCommand } from './claim-cloud-replies.command';
import { ClaimCloudRepliesRequest } from './claim-cloud-replies.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class ClaimCloudRepliesHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('cloud-replies/claim')
  @HttpCode(HttpStatus.OK)
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Session' })
  // Both: the person's sessions and their cloud chats. `sessions:write` alone
  // (an `opp` or MCP token) never reads or takes the replies they type.
  @RequireScopes('sessions:write', 'cloud-chat:write')
  // One open request at a time per extension, each held up to ten seconds.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Claim the replies waiting for your Claude Code cloud sessions',
    description:
      'What the browser extension asks, over and over: every reply the caller typed in a Claude Code cloud session’s chat that nothing has delivered yet, now claimed for the extension to post on claude.ai as the caller. With none waiting, the request waits up to `wait` seconds for one. A reply claude.ai refuses is handed back with `POST /v1/sessions/cloud-replies/{replyId}/release`.',
  })
  @ApiOkResponse({ type: ClaimedCloudRepliesResponseDto })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async claim(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @Body() body: ClaimCloudRepliesRequest,
  ): Promise<ClaimedCloudRepliesResponseDto> {
    const replies = await this.commandBus.execute<ClaimCloudRepliesCommand, BrowserCloudReply[]>(
      new ClaimCloudRepliesCommand({ scope, userId, waitSeconds: body.wait }),
    );
    return SessionCloudChatMapper.toClaimed(replies);
  }
}
