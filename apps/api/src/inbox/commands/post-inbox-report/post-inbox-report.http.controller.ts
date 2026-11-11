// `Express.Multer.File` is a global augmentation from `@types/multer`.
/// <reference types="multer" />

import {
  Body,
  Controller,
  Post,
  Req,
  UploadedFiles,
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
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { tenantOrganizationIdOf } from '../../../auth/domain/request-tenant.types';
import type { ScopedRequest } from '../../../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { RequireFlag } from '../../../feature-flags/decorators/require-flag.decorator';
import type { InboxReportEntity } from '../../domain/inbox-report.entity';
import { InboxReportResponseDto } from '../../dtos/inbox-report.response.dto';
import { InboxReportMapper } from '../../inbox-report.mapper';
import { InboxReportImagesInterceptor } from '../../interceptors/inbox-report-images.interceptor';
import { FindInboxReportQuery } from '../../queries/find-inbox-report/find-inbox-report.query';
import { PostInboxReportCommand } from './post-inbox-report.command';
import { PostInboxReportRequest } from './post-inbox-report.request.dto';

@ApiTags('Inbox')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('inbox')
export class PostInboxReportHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: InboxReportMapper,
  ) {}

  @Post('reports')
  @Version('1')
  @NoPolicy('sends a report to the Inbox of the workspace the credential acts in')
  @RequireScopes('inbox-reports:write')
  @RequireFlag('inbox')
  // An agent reports what it found, a few times a run: well below a loop.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(InboxReportImagesInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', maxLength: 200 },
        body: { type: 'string', maxLength: 4000 },
        source: { type: 'string', maxLength: 80, description: 'Who is sending it.' },
        link: { type: 'string', format: 'uri', description: 'Where the problem can be seen.' },
        images: { type: 'array', maxItems: 4, items: { type: 'string', format: 'binary' } },
      },
      required: ['title'],
    },
  })
  @ApiOperation({
    summary: 'Send a report to the Inbox',
    description:
      'A problem for the workspace’s owner, with up to 4 PNG, JPEG, GIF or WebP pictures of up to 5 MB each under `images`, judged by their bytes. The owner answers it in the Inbox; read the answer with `GET /inbox/reports/:id`.',
  })
  @ApiResponse({ status: 201, type: InboxReportResponseDto })
  @ApiProblemResponse({ status: 400, description: 'No active workspace', code: 'TENANT_001' })
  @ApiProblemResponse({ status: 413, description: 'Picture too large', code: 'INBOX_008' })
  @ApiProblemResponse({ status: 415, description: 'Not a picture', code: 'INBOX_009' })
  @ApiProblemResponse({ status: 422, description: 'Too many pictures', code: 'INBOX_007' })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async post(
    @Req() request: ScopedRequest,
    @CurrentUser('id') userId: string,
    @Body() body: PostInboxReportRequest,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ): Promise<InboxReportResponseDto> {
    const organizationId = tenantOrganizationIdOf(request);
    const id = await this.commandBus.execute<PostInboxReportCommand, string>(
      new PostInboxReportCommand({
        organizationId,
        userId,
        title: body.title,
        body: body.body ?? '',
        source: body.source ?? '',
        link: body.link ?? null,
        images: (files ?? []).map((file) => ({ data: file.buffer, name: file.originalname ?? '' })),
      }),
    );
    const report = await this.queryBus.execute<FindInboxReportQuery, InboxReportEntity>(
      new FindInboxReportQuery(organizationId, id),
    );
    return this.mapper.toResponse(report);
  }
}
