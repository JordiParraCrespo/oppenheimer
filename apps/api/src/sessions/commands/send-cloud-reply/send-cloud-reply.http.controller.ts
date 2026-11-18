import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
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
import { SentCloudReplyResponseDto } from '../../dtos/session-cloud-chat.response.dto';
import { SendCloudReplyCommand } from './send-cloud-reply.command';
import { SendCloudReplyRequest } from './send-cloud-reply.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class SendCloudReplyHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/cloud-replies')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Session' })
  @RequireScopes('sessions:write')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Reply to a Claude Code cloud session’s agent',
    description:
      'Keeps `text` for the agent of a Claude Code cloud session this workspace launched. The Stop hook in that session collects it when the agent ends its turn, and the agent carries on with it. If no hook has taken it 15 seconds later, a host signed in to the claude.ai account the session runs on sends it with `claude -p … --cloud`, which wakes an idle session. Shown in the session’s chat as waiting until either.',
  })
  @ApiCreatedResponse({ type: SentCloudReplyResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  @ApiProblemResponse({ status: 409, description: 'That session is closed', code: 'SESSIONS_005' })
  @ApiProblemResponse({
    status: 409,
    description: 'This session has no cloud chat',
    code: 'SESSIONS_054',
  })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async send(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendCloudReplyRequest,
  ): Promise<SentCloudReplyResponseDto> {
    const replyId = await this.commandBus.execute<SendCloudReplyCommand, string>(
      new SendCloudReplyCommand({ scope, sessionId: id, authorId: userId, text: body.text }),
    );
    return { id: replyId };
  }
}
