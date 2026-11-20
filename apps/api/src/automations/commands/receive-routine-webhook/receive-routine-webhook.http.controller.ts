import { Controller, Headers, HttpCode, Param, Post, Req, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiProblemResponse, AppError } from '@oppenheimer/backend-core';
import { WEBHOOK_SIGNATURE_HEADER } from '@oppenheimer/shared/automations';
import type { Request } from 'express';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { isBodyTooLarge, rawBodyOf } from '../../../config/raw-body-parser';
import { AutomationMapper } from '../../automation.mapper';
import { AutomationErrors } from '../../domain/automations.errors';
import type { ReceivedWebhook } from '../../domain/routine-webhook.types';
import { RoutineWebhookReceivedResponseDto } from '../../dtos/routine-webhook.response.dto';
import { ReceiveRoutineWebhookCommand } from './receive-routine-webhook.command';

/**
 * A routine's webhook URL. Public: whoever holds the URL may post to it, as a
 * deploy pipeline, Sentry or a form would, so the token in the path is the
 * credential, checked downstream with the signature when the URL is signed.
 * The body arrives as raw bytes (`AutomationsModule.configure` mounts the
 * parser), so a signature is checked over exactly what was sent. Throttled by
 * the app-wide limit; past it, the routine's own hourly caps record skips.
 */
@ApiTags('Routine webhooks')
@ApiSecurity('none')
@Controller('routine-webhooks')
export class ReceiveRoutineWebhookHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly mapper: AutomationMapper,
  ) {}

  @Post(':token')
  @NoPolicy('authenticated by the routine webhook’s token and signature, not by a user')
  @Version('1')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Post to a routine’s webhook',
    description:
      'Runs the routine the URL belongs to: one turn of its bot, which reads the body as outside data, never as instructions. Answers at once with the run, without waiting for the bot. Any content type; the first 16 KiB of the body are kept with the run. A signed URL takes only a request whose `x-oppenheimer-signature` is `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">` under its signing secret, within five minutes of now.',
  })
  @ApiParam({ name: 'token', description: 'The token the Routines tab issued, `owh_…`.' })
  @ApiHeader({ name: WEBHOOK_SIGNATURE_HEADER, required: false })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'A retried POST with the same key is the same run.',
  })
  @ApiResponse({ status: 202, type: RoutineWebhookReceivedResponseDto })
  @ApiProblemResponse({ status: 404, description: 'No such webhook', code: 'AUTOMATIONS_010' })
  @ApiProblemResponse({ status: 401, description: 'Bad signature', code: 'AUTOMATIONS_011' })
  @ApiProblemResponse({ status: 413, description: 'Body too large', code: 'AUTOMATIONS_012' })
  @ApiProblemResponse({ status: 409, description: 'Routine paused', code: 'AUTOMATIONS_013' })
  async receive(
    @Req() request: Request,
    @Param('token') token: string,
    @Headers('content-type') contentType: string | undefined,
    @Headers(WEBHOOK_SIGNATURE_HEADER) signature: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<RoutineWebhookReceivedResponseDto> {
    if (isBodyTooLarge(request)) throw new AppError(AutomationErrors.WEBHOOK_BODY_TOO_LARGE);
    const received = await this.commandBus.execute<ReceiveRoutineWebhookCommand, ReceivedWebhook>(
      new ReceiveRoutineWebhookCommand({
        token,
        body: rawBodyOf(request),
        contentType,
        signature,
        idempotencyKey,
      }),
    );
    return this.mapper.receivedWebhookToResponse(received);
  }
}
