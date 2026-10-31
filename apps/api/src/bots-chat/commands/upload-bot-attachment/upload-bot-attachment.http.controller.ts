// `Express.Multer.File` is a global augmentation from `@types/multer`.
/// <reference types="multer" />

import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { BotAttachmentMapper } from '../../bot-attachment.mapper';
import type { BotAttachmentEntity } from '../../domain/bot-attachment.entity';
import { BotAttachmentResponseDto } from '../../dtos/bot-attachment.response.dto';
import { BotAttachmentInterceptor } from '../../interceptors/bot-attachment.interceptor';
import { FindBotAttachmentQuery } from '../../queries/find-bot-attachment/find-bot-attachment.query';
import { UploadBotAttachmentCommand } from './upload-bot-attachment.command';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class UploadBotAttachmentHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: BotAttachmentMapper,
  ) {}

  @Post(':id/attachments')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Bot' })
  @RequireScopes('bots:write')
  // Picking images is a person's action: well above a hand, well below a loop.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(BotAttachmentInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOperation({
    summary: 'Upload an image for a message to a bot',
    description:
      'A PNG, JPEG, GIF or WebP image of up to 5 MB, judged by its bytes. Send it by naming its id in `attachmentIds` on `POST /bots/:id/messages`; one never sent is deleted after a day.',
  })
  @ApiResponse({ status: 201, type: BotAttachmentResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  @ApiProblemResponse({ status: 413, description: 'Image too large', code: 'BOTS_025' })
  @ApiProblemResponse({ status: 415, description: 'Not an image a bot takes', code: 'BOTS_024' })
  @ApiProblemResponse({
    status: 422,
    description: "The bot's model does not read images",
    code: 'BOTS_028',
  })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async upload(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<BotAttachmentResponseDto> {
    // `BotAttachmentInterceptor` has already refused a request with no file.
    const id = await this.commandBus.execute<UploadBotAttachmentCommand, string>(
      new UploadBotAttachmentCommand({
        scope,
        botId,
        file: file.buffer,
        name: file.originalname ?? '',
      }),
    );
    const attachment = await this.queryBus.execute<FindBotAttachmentQuery, BotAttachmentEntity>(
      new FindBotAttachmentQuery(scope, botId, id),
    );
    return this.mapper.toResponse(attachment);
  }
}
