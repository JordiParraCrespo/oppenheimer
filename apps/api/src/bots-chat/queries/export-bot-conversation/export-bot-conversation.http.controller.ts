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
import { BotConversationExportResponseDto } from '../../dtos/bot-message.response.dto';
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
      'Every message of the conversation, oldest first, streamed as it is read: `GET /bots/:id/conversation` holds only the newest.',
  })
  @ApiResponse({ status: 200, type: BotConversationExportResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  async export(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
  ): Promise<StreamableFile> {
    const pages = await this.queryBus.execute<
      ExportBotConversationQuery,
      AsyncIterable<BotMessageEntity[]>
    >(new ExportBotConversationQuery(scope, botId));
    return new StreamableFile(Readable.from(this.json(pages)), {
      type: 'application/json; charset=utf-8',
    });
  }

  /** `{ "messages": [...] }`, written a page at a time. */
  private async *json(pages: AsyncIterable<BotMessageEntity[]>): AsyncIterable<string> {
    yield '{"messages":[';
    let first = true;
    for await (const page of pages) {
      for (const message of page) {
        yield `${first ? '' : ','}${JSON.stringify(this.mapper.toResponse(message))}`;
        first = false;
      }
    }
    yield ']}';
  }
}
