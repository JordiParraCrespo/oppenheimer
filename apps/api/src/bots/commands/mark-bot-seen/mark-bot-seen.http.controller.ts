import {
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
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
import { MarkBotSeenCommand } from './mark-bot-seen.command';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class MarkBotSeenHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/seen')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: 'Say the owner is in a bot’s chat',
    description:
      'The console sends it when the chat opens. It resumes the routines the spend guard paused while the owner was away, and is written at most once a minute.',
  })
  @ApiResponse({ status: 204 })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  async markSeen(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
  ): Promise<void> {
    await this.commandBus.execute<MarkBotSeenCommand, string>(
      new MarkBotSeenCommand({ scope, botId }),
    );
  }
}
