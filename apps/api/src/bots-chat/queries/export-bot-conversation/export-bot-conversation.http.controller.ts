import { Readable } from 'node:stream';
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  StreamableFile,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ApiAuthProblemResponses,
  ApiProblemResponse,
  NDJSON_CONTENT_TYPE,
  ndjsonLines,
} from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { BotMessageMapper } from '../../bot-message.mapper';
import type { BotMessageEntity } from '../../domain/bot-message.entity';
import { ExportBotConversationQuery } from './export-bot-conversation.query';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class ExportBotConversationHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: BotMessageMapper,
  ) {}

  @Get(':id/conversation/export')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({
    summary: "Export a bot's whole chat",
    description:
      'Every message of the conversation, oldest first, as newline-delimited JSON (`application/x-ndjson`): one message per line, each shaped as in `GET /bots/:id/conversation`, which holds only the newest. Lines are written as the chat is read, a page at a time, so a reader can handle each as it arrives.',
  })
  @ApiProduces(NDJSON_CONTENT_TYPE)
  @ApiResponse({ status: 200, description: 'One `BotMessageResponseDto` per line, oldest first' })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  async export(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
  ): Promise<StreamableFile> {
    const pages = await this.queryBus.execute<
      ExportBotConversationQuery,
      AsyncIterable<BotMessageEntity[]>
    >(new ExportBotConversationQuery(scope, botId));
    const lines = ndjsonLines(pages, (message) => this.mapper.toResponse(message));
    return new StreamableFile(Readable.from(lines), {
      type: `${NDJSON_CONTENT_TYPE}; charset=utf-8`,
    });
  }
}
