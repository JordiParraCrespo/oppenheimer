import {
  Controller,
  type MessageEvent,
  Param,
  ParseUUIDPipe,
  Sse,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { BOT_STREAM_EVENT, BOT_STREAM_READY } from '@oppenheimer/shared';
import { map, type Observable } from 'rxjs';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { StreamBotQuery } from './stream-bot.query';
import type { BotStreamFrame } from './stream-bot.query-handler';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class StreamBotHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Sse(':id/stream')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  @ApiOperation({
    summary: "Follow a bot's chat as it happens",
    description: [
      'Server-Sent Events. `ready` once subscribed, then a `bot` event per change, its `data` one of:',
      '`{ type: "snapshot", turnId, block, seq, text }` right after `ready`, once per running turn: the whole block of text it is writing and has not stored, in place of what the reader held for that block;',
      '`{ type: "text", turnId, block, seq, text }` as a turn writes (`block` counts the blocks the turn stored before it, `seq` its text writes; one at or below what the reader holds is a duplicate);',
      '`{ type: "retrying", turnId, reason }` while a turn waits on a provider that refused a call;',
      '`{ type: "subagents", turnId, callId, runs }` where each child of a running `delegate` call is;',
      '`{ type: "message", turnId, messageId }` when a message is stored; `{ type: "turn", turnId, status }` when a turn moves;',
      '`{ type: "approval", approvalId, status }` and `{ type: "question", questionId, status }` when a card is raised or settled.',
      'The stored conversation is the record; read it again on `ready`, `message` and `turn`. A `keepalive` holds an idle stream open, and the stream ends after 15 minutes so the redial is authenticated again.',
    ].join(' '),
  })
  @ApiProduces('text/event-stream')
  @ApiResponse({ status: 200, description: 'The event stream' })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  async stream(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
  ): Promise<Observable<MessageEvent>> {
    const frames = await this.queryBus.execute<StreamBotQuery, Observable<BotStreamFrame>>(
      new StreamBotQuery(scope, botId),
    );
    return frames.pipe(
      map((frame): MessageEvent => {
        switch (frame.kind) {
          case 'ready':
            return { type: BOT_STREAM_READY, data: '' };
          case 'event':
            return { type: BOT_STREAM_EVENT, data: JSON.stringify(frame.event) };
          case 'keepalive':
            return { type: 'keepalive', data: '' };
        }
      }),
    );
  }
}
