import {
  Controller,
  Headers,
  HttpCode,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { type ReceivedSlackEvent, ReceiveSlackEventCommand } from './receive-slack-event.command';

/**
 * A bot's Slack app's events address. Public, since Slack sends no bearer
 * token, and unthrottled, since a throttled event is a retried one;
 * authenticity is the `X-Slack-Signature` HMAC, checked downstream against the
 * app's signing secret. Reads `req.body` as the raw bytes
 * `mountSlackEventsBodyParser` left there.
 */
@Controller('slack')
export class ReceiveSlackEventHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('events')
  @NoPolicy('authenticated by the Slack app’s request signature, not by a user')
  @Version('1')
  @HttpCode(200)
  @SkipThrottle()
  @ApiExcludeEndpoint()
  async receive(
    @Req() request: Request,
    @Query('bot', ParseUUIDPipe) botId: string,
    @Headers('x-slack-request-timestamp') timestamp: string | undefined,
    @Headers('x-slack-signature') signature: string | undefined,
  ): Promise<ReceivedSlackEvent> {
    return this.commandBus.execute<ReceiveSlackEventCommand, ReceivedSlackEvent>(
      new ReceiveSlackEventCommand({
        botId,
        timestamp: timestamp ?? '',
        signature: signature ?? '',
        body: rawBodyOf(request),
      }),
    );
  }
}

/** The bytes `mountSlackEventsBodyParser` read; no body at all is an empty one, which no signature matches. */
function rawBodyOf(request: Request): Buffer {
  if (Buffer.isBuffer(request.body)) return request.body;
  if (request.body === undefined) return Buffer.alloc(0);
  throw new Error('The Slack events body was parsed before the raw parser read it');
}
