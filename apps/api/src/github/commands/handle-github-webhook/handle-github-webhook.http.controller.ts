import { Controller, Headers, HttpCode, Post, Req, Version } from '@nestjs/common';
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
 * Reads `req.body` as the raw bytes `githubWebhookBodyParser` left there (the
 * module applies it to this route), so the digest is taken over exactly what
 * GitHub signed rather than a re-serialized object. A body past GitHub's 25 MB
 * cap is refused with 413 before it gets here.
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
    @Req() request: Request,
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-event') event: string,
    @Headers('x-github-delivery') deliveryId: string,
  ): Promise<{ received: boolean }> {
    const payload = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
    await this.commandBus.execute<HandleGithubWebhookCommand, void>(
      new HandleGithubWebhookCommand({
        payload,
        signature: signature ?? '',
        event: event ?? '',
        deliveryId: deliveryId ?? '',
      }),
    );
    return { received: true };
  }
}
