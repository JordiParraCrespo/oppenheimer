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
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { CloudChatReply } from '../../database/session-cloud-chat.repository.port';
import { CollectedCloudReplyResponseDto } from '../../dtos/session-cloud-chat.response.dto';
import { CollectCloudReplyCommand } from './collect-cloud-reply.command';
import { TakeCloudReplyRequest } from './collect-cloud-reply.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class CollectCloudReplyHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('cloud-replies/take')
  @HttpCode(HttpStatus.OK)
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Session' })
  @RequireScopes('cloud-chat:write')
  // Once per agent turn, which a long wait keeps few.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Collect the next reply for a Claude Code cloud session’s agent',
    description:
      'What the Stop hook in a Claude Code cloud session asks when its agent ends a turn: the oldest reply typed in its chat that no hook has collected, now marked collected. With none waiting, the request waits up to `wait` seconds for one, then answers `text: null`.',
  })
  @ApiOkResponse({ type: CollectedCloudReplyResponseDto })
  @ApiProblemResponse({
    status: 404,
    description: 'No cloud session of this workspace has that id',
    code: 'SESSIONS_053',
  })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async take(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: TakeCloudReplyRequest,
  ): Promise<CollectedCloudReplyResponseDto> {
    const reply = await this.commandBus.execute<CollectCloudReplyCommand, CloudChatReply | null>(
      new CollectCloudReplyCommand({
        scope,
        cloudSessionId: body.cloudSessionId,
        waitSeconds: body.wait,
      }),
    );
    return { text: reply?.text ?? null };
  }
}
