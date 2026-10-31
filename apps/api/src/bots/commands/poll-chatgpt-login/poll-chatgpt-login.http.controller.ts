import {
  Body,
  Controller,
  HttpCode,
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
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { ChatgptSignInMapper } from '../../chatgpt-sign-in.mapper';
import { ChatgptLoginStatusResponseDto } from '../../dtos/chatgpt-login.response.dto';
import { PollChatgptLoginCommand } from './poll-chatgpt-login.command';
import { PollChatgptLoginRequest } from './poll-chatgpt-login.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('model-providers')
export class PollChatgptLoginHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly mapper: ChatgptSignInMapper,
  ) {}

  @Post('chatgpt/login/poll')
  @Version('1')
  @HttpCode(200)
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  // The console polls every five seconds (`LIVE_POLL.chatgptLogin`), twelve a
  // minute; thirty leaves room for a second tab and still stops a loop.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Check on a ChatGPT sign-in',
    description:
      "Asks ChatGPT whether the person approved the code. `connected` means the sign-in is stored as the workspace's ChatGPT credential; `pending` means poll again after the interval.",
  })
  @ApiResponse({ status: 200, type: ChatgptLoginStatusResponseDto })
  @ApiProblemResponse({
    status: 400,
    description: 'Bots belong to an organization',
    code: 'BOTS_002',
  })
  @ApiProblemResponse({ status: 410, description: 'The ChatGPT sign-in expired', code: 'BOTS_018' })
  @ApiProblemResponse({
    status: 429,
    description: "ChatGPT's sign-in is busy, or this route's rate limit was reached",
    code: ['BOTS_019', 'RATE_001'],
  })
  @ApiProblemResponse({
    status: 502,
    description: "ChatGPT's sign-in could not be reached",
    code: 'BOTS_020',
  })
  @ApiProblemResponse({
    status: 503,
    description: 'Model providers are not configured on this server',
    code: 'BOTS_011',
  })
  async poll(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: PollChatgptLoginRequest,
  ): Promise<ChatgptLoginStatusResponseDto> {
    const connected = await this.commandBus.execute<PollChatgptLoginCommand, boolean>(
      new PollChatgptLoginCommand({ scope, flowId: body.flowId }),
    );
    return this.mapper.toLoginStatusResponse(connected);
  }
}
