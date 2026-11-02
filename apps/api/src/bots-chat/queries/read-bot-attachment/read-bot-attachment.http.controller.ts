import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  StreamableFile,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { BOT_IMAGE_MIME_TYPES } from '@oppenheimer/shared';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { ReadBotAttachmentQuery } from './read-bot-attachment.query';
import type { BotAttachmentContent } from './read-bot-attachment.query-handler';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class ReadBotAttachmentHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id/attachments/:attachmentId/content')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Bot' })
  @RequireScopes('bots:read')
  // An image's bytes never change under its id; only this browser keeps them.
  @Header('Cache-Control', 'private, max-age=86400, immutable')
  @ApiOperation({
    summary: "Read an image in a bot's chat",
    description:
      'The bytes of an image a message carries, or of your own upload not sent yet, with its type.',
  })
  @ApiProduces(...BOT_IMAGE_MIME_TYPES)
  @ApiResponse({ status: 200, description: 'The image’s bytes' })
  @ApiProblemResponse({ status: 404, description: 'Bot not found', code: 'BOTS_001' })
  @ApiProblemResponse({ status: 404, description: 'Image not found', code: 'BOTS_026' })
  async read(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string,
  ): Promise<StreamableFile> {
    const image = await this.queryBus.execute<ReadBotAttachmentQuery, BotAttachmentContent>(
      new ReadBotAttachmentQuery(scope, botId, attachmentId),
    );
    return new StreamableFile(image.data, { type: image.mimeType, length: image.data.length });
  }
}
