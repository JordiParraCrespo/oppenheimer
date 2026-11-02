import {
  Controller,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  type RawBodyRequest,
  Req,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { HandleSentryWebhookCommand } from './handle-sentry-webhook.command';

/**
 * A connection's webhook receiver. Public, since Sentry sends no bearer
 * token, and unthrottled, since a throttled webhook is a retried one;
 * authenticity is the `Sentry-Hook-Signature` HMAC over the raw bytes
 * (`req.rawBody`), checked with the connection's own secret.
 */
@Controller('sentry')
export class HandleSentryWebhookHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('webhooks/:connectionId')
  @NoPolicy('authenticated by the Sentry integration’s webhook signature, not by a user')
  @Version('1')
  @HttpCode(200)
  @SkipThrottle()
  @ApiExcludeEndpoint()
  async handle(
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
    @Req() request: RawBodyRequest<Request>,
    @Headers('sentry-hook-signature') signature: string,
    @Headers('sentry-hook-resource') resource: string,
    @Headers('request-id') requestId: string,
  ): Promise<{ received: boolean }> {
    await this.commandBus.execute<HandleSentryWebhookCommand, void>(
      new HandleSentryWebhookCommand({
        connectionId,
        payload: request.rawBody ?? Buffer.from(''),
        signature: signature ?? '',
        resource: resource ?? '',
        requestId: requestId ?? '',
      }),
    );
    return { received: true };
  }
}
