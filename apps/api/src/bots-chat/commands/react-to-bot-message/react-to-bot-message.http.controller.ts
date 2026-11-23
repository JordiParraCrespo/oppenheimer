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
import { BotMessageMapper } from '../../bot-message.mapper';
import type { BotMessageEntity } from '../../domain/bot-message.entity';
import { BotMessageResponseDto } from '../../dtos/bot-message.response.dto';
import { ReactToBotMessageCommand } from './react-to-bot-message.command';
import { ReactToBotMessageRequest } from './react-to-bot-message.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class ReactToBotMessageHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly mapper: BotMessageMapper,
  ) {}

  @Put(':id/messages/:messageId/reaction')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: 'React to a message in a bot’s chat',
    description:
      'Sets your reaction to a message of yours or of the bot’s: one emoji, replacing the one before; `null` takes it back. The bot is not woken by it.',
  })
  @ApiResponse({ status: 200, type: BotMessageResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Message not found', code: 'BOTS_044' })
  @ApiProblemResponse({
    status: 422,
    description: 'This message takes no reaction',
    code: 'BOTS_045',
  })
  async react(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
    @Body() body: ReactToBotMessageRequest,
  ): Promise<BotMessageResponseDto> {
    const message = await this.commandBus.execute<ReactToBotMessageCommand, BotMessageEntity>(
      new ReactToBotMessageCommand({ scope, botId, messageId, emoji: body.emoji }),
    );
    return this.mapper.toResponse(message);
  }
}
