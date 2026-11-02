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
      'Its newest `limit` messages, oldest first, with the turns they belong to and any turn still queued or running, and how many messages it holds in all. The whole chat is `GET /bots/:id/conversation/export`.',
  })
  @ApiResponse({ status: 200, type: BotConversationResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  async find(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Query() query: FindBotConversationRequest,
  ): Promise<BotConversationResponseDto> {
    const conversation = await this.queryBus.execute<FindBotConversationQuery, BotConversation>(
      new FindBotConversationQuery(scope, botId, query.limit),
    );
    return {
      messages: conversation.messages.map((message) => this.messages.toResponse(message)),
      turns: conversation.turns.map((turn) => this.turns.toResponse(turn)),
      messageCount: conversation.messageCount,
      storedTextBlocks: Object.fromEntries(conversation.storedTextBlocks),
    };
  }
}
