import {
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { ClearBotConversationCommand } from './clear-bot-conversation.command';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class ClearBotConversationHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id/conversation')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: "Clear a bot's chat history",
    description:
      'Erases the conversation: every message, turn and Needs input card (a pending one ends with it) and the summary of older messages. The bot keeps its soul, instructions and memory. Refused while one of its turns is queued or running; stop it first.',
  })
  @ApiResponse({ status: 204 })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  @ApiProblemResponse({
    status: 409,
    description: 'A turn is queued or running',
    code: 'BOTS_022',
  })
  async clear(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
  ): Promise<void> {
    await this.commandBus.execute<ClearBotConversationCommand, string>(
      new ClearBotConversationCommand({ scope, botId }),
    );
  }
}
