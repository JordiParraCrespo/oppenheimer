/// <reference types="multer" />

import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { SessionAttachmentDto } from '@oppenheimer/shared';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { SessionAttachmentResponseDto } from '../../dtos/session-attachment.response.dto';
import { SessionImageFileInterceptor } from '../../interceptors/session-image-file.interceptor';
import { UploadSessionAttachmentCommand } from './upload-session-attachment.command';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class UploadSessionAttachmentHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('attachments')
  @HttpCode(HttpStatus.CREATED)
  @Version('1')
  // The same policy and scope as the create it is for.
  @CheckPolicies({ action: 'create', subject: 'Session' })
  @RequireScopes('sessions:write')
  // A handful per session, a session a few times a minute at most. What bounds
  // the bytes held is the per-person cap on waiting uploads (SESSIONS_020).
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(SessionImageFileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOperation({
    summary: 'Attach a file to a first task',
    description:
      'An image (PNG, JPEG, GIF, WebP), a PDF, or UTF-8 text (plain, Markdown, CSV, JSON), judged by its bytes; executables, archives, scripts, SVG and HTML are refused. Kept briefly for the `POST /sessions` that names it in `attachmentIds`; the host saves it under a name of its own and gives the agent its path with the task. Only its uploader can name it, and the same bytes uploaded again answer the same id.',
  })
  @ApiResponse({ status: 201, type: SessionAttachmentResponseDto })
  @ApiProblemResponse({ status: 413, description: 'File too large', code: 'SESSIONS_012' })
  @ApiProblemResponse({
    status: 415,
    description: 'Not a type a session takes',
    code: 'SESSIONS_013',
  })
  @ApiProblemResponse({ status: 400, description: 'No file attached', code: 'SESSIONS_015' })
  @ApiProblemResponse({ status: 429, description: 'Too many files waiting', code: 'SESSIONS_020' })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async upload(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<SessionAttachmentResponseDto> {
    return this.commandBus.execute<UploadSessionAttachmentCommand, SessionAttachmentDto>(
      new UploadSessionAttachmentCommand({
        organizationId: scope.organizationId,
        userId,
        data: file?.buffer,
        hint: { mediaType: file?.mimetype, fileName: file?.originalname },
      }),
    );
  }
}
