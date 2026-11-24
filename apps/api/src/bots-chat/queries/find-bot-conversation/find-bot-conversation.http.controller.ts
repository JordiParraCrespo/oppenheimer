import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { BOT_CONVERSATION_PAGE_DEFAULT, BOT_CONVERSATION_PAGE_MAX } from '@oppenheimer/shared';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { BotMessageMapper } from '../../bot-message.mapper';
import { BotTurnMapper } from '../../bot-turn.mapper';
import { BotConversationResponseDto } from '../../dtos/bot-message.response.dto';
import { FindBotConversationQuery } from './find-bot-conversation.query';
import type { BotConversation } from './find-bot-conversation.query-handler';
import { FindBotConversationRequest } from './find-bot-conversation.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class FindBotConversationHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly messages: BotMessageMapper,
    private readonly turns: BotTurnMapper,
  ) {}

  @Get(':id/conversation')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({
    summary: "A bot's chat",
    description:
      'Its newest `limit` messages, oldest first, with the turns they belong to and any turn still queued or running, and how many messages it holds in all. With `before` (a message id, the oldest the reader holds), the `limit` messages just older than that one; `hasOlder` says whether more remain. The whole chat is `GET /bots/:id/conversation/export`.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    minimum: 1,
    maximum: BOT_CONVERSATION_PAGE_MAX,
    description: `How many messages; ${BOT_CONVERSATION_PAGE_DEFAULT} when absent.`,
  })
  @ApiQuery({
    name: 'before',
    required: false,
    type: String,
    format: 'uuid',
    description:
      'A message of this chat, the oldest the reader holds: the page is the messages just older than it.',
  })
  @ApiResponse({ status: 200, type: BotConversationResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  async find(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Query() query: FindBotConversationRequest,
  ): Promise<BotConversationResponseDto> {
    const conversation = await this.queryBus.execute<FindBotConversationQuery, BotConversation>(
      new FindBotConversationQuery(scope, botId, query.limit, query.before ?? null),
    );
    return {
      messages: conversation.messages.map((message) => this.messages.toResponse(message)),
      hasOlder: conversation.hasOlder,
      turns: conversation.turns.map((turn) => this.turns.toResponse(turn)),
      messageCount: conversation.messageCount,
      storedTextBlocks: Object.fromEntries(conversation.storedTextBlocks),
    };
  }
}
