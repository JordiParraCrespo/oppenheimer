import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentScope } from '../../../auth/decorators/current-scope.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import type { ScopeContext } from '../../../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { BotTurnMapper } from '../../bot-turn.mapper';
import type { BotTurnEntity } from '../../domain/bot-turn.entity';
import { BotTurnResponseDto } from '../../dtos/bot-turn.response.dto';
import { FindBotTurnQuery } from '../../queries/find-bot-turn/find-bot-turn.query';
import { SendBotMessageCommand } from './send-bot-message.command';
import { SendBotMessageRequest } from './send-bot-message.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class SendBotMessageHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: BotTurnMapper,
  ) {}

  @Post(':id/messages')
  @Version('1')
  @HttpCode(202)
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  @ApiOperation({
    summary: 'Send a bot a message',
    description:
      "A turn, queued on the bot's provider and model as they are now. Words, images uploaded with `POST /bots/:id/attachments` (`attachmentIds`), or both. It runs when the bot's turn before it ends; follow it on `GET /bots/:id/stream` and read the result from `GET /bots/:id/conversation`.",
  })
  @ApiResponse({ status: 202, type: BotTurnResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  @ApiProblemResponse({ status: 404, description: 'Image not found', code: 'BOTS_026' })
  @ApiProblemResponse({
    status: 409,
    description: "The bot's model provider has no key",
    code: 'BOTS_013',
  })
  @ApiProblemResponse({
    status: 409,
    description: 'The image can no longer be sent',
    code: 'BOTS_027',
  })
  @ApiProblemResponse({
    status: 422,
    description: "The bot's model does not read images",
    code: 'BOTS_028',
  })
  @ApiProblemResponse({
    status: 503,
    description: 'Model providers are not configured on this server',
    code: 'BOTS_011',
  })
  async send(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentScope() credential: ScopeContext | null,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Body() body: SendBotMessageRequest,
  ): Promise<BotTurnResponseDto> {
    const turnId = await this.commandBus.execute<SendBotMessageCommand, string>(
      new SendBotMessageCommand({
        scope,
        botId,
        content: body.content,
        attachmentIds: body.attachmentIds,
        timeZone: body.timeZone ?? null,
        // A token's scopes bound what the bot may do for it; a browser session has none.
        credentialScopes: credential ? credential.scopes : null,
      }),
    );
    const turn = await this.queryBus.execute<FindBotTurnQuery, BotTurnEntity>(
      new FindBotTurnQuery(scope, botId, turnId),
    );
    return this.mapper.toResponse(turn);
  }
}
