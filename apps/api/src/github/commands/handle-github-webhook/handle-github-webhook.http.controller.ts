import {
  Controller,
  Headers,
  HttpCode,
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
import { HandleGithubWebhookCommand } from './handle-github-webhook.command';

/**
 * GitHub webhook receiver. Public — GitHub cannot send a bearer token — and
 * unthrottled, because a throttled webhook is a retried webhook. Authenticity is
 * proven by the `X-Hub-Signature-256` HMAC verified downstream.
 *
 * Reads `req.rawBody` (populated by Better Auth's raw-body parser) so the digest
 * is taken over the exact bytes GitHub signed rather than a re-serialized object.
 */
@Controller('github')
export class HandleGithubWebhookHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('webhook')
  @NoPolicy('authenticated by the GitHub App webhook signature, not by a user')
  @Version('1')
  @HttpCode(200)
  @SkipThrottle()
  @ApiExcludeEndpoint()
  async handle(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-event') event: string,
  ): Promise<{ received: boolean }> {
    const payload = request.rawBody ?? Buffer.from('');
    await this.commandBus.execute<HandleGithubWebhookCommand, void>(
      new HandleGithubWebhookCommand({
        payload,
        signature: signature ?? '',
        event: event ?? '',
      }),
    );
    return { received: true };
  }
}
