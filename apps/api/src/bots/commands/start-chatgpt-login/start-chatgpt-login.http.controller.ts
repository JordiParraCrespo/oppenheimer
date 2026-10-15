import { Controller, HttpCode, Post, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { ChatgptLoginResponseDto } from '../../dtos/chatgpt-login.response.dto';
import { StartChatgptLoginCommand } from './start-chatgpt-login.command';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('model-providers')
export class StartChatgptLoginHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('chatgpt/login')
  @Version('1')
  @HttpCode(200)
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: 'Start signing the workspace in to ChatGPT',
    description:
      "ChatGPT's device code flow, as the Codex CLI runs it: the person types `userCode` on `verificationUrl` and the console polls with `flowId` until the sign-in is stored. Bots on the `chatgpt` provider then run on that ChatGPT subscription.",
  })
  @ApiResponse({ status: 200, type: ChatgptLoginResponseDto })
  @ApiProblemResponse({
    status: 400,
    description: 'Bots belong to an organization',
    code: 'BOTS_002',
  })
  @ApiProblemResponse({ status: 429, description: "ChatGPT's sign-in is busy", code: 'BOTS_017' })
  @ApiProblemResponse({
    status: 502,
    description: "ChatGPT's sign-in could not be reached",
    code: 'BOTS_018',
  })
  @ApiProblemResponse({
    status: 503,
    description: 'Model providers are not configured on this server',
    code: 'BOTS_011',
  })
  start(@CurrentAccessScope() scope: AccessScope): Promise<ChatgptLoginResponseDto> {
    return this.commandBus.execute<StartChatgptLoginCommand, ChatgptLoginResponseDto>(
      new StartChatgptLoginCommand({ scope }),
    );
  }
}
