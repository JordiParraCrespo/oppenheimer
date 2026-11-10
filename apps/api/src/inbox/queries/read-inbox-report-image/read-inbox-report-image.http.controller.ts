import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Req,
  StreamableFile,
  UseGuards,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { INBOX_REPORT_IMAGE_MIME_TYPES } from '@oppenheimer/shared';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { tenantOrganizationIdOf } from '../../../auth/domain/request-tenant.types';
import type { ScopedRequest } from '../../../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { RequireFlag } from '../../../feature-flags/decorators/require-flag.decorator';
import { ReadInboxReportImageQuery } from './read-inbox-report-image.query';
import type { InboxReportImageContent } from './read-inbox-report-image.query-handler';

@ApiTags('Inbox')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('inbox')
export class ReadInboxReportImageHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('reports/:id/images/:imageId/content')
  @Version('1')
  @NoPolicy('reads a picture of a report in the Inbox of the workspace the credential acts in')
  @RequireScopes('inbox-reports:read')
  @RequireFlag('inbox')
  // A picture's bytes never change under its id; only this browser keeps them.
  @Header('Cache-Control', 'private, max-age=86400, immutable')
  @ApiOperation({
    summary: 'Read a picture of an Inbox report',
    description: 'The bytes of a picture a report carries, with its type.',
  })
  @ApiProduces(...INBOX_REPORT_IMAGE_MIME_TYPES)
  @ApiResponse({ status: 200, description: 'The picture’s bytes' })
  @ApiProblemResponse({ status: 400, description: 'No active workspace', code: 'TENANT_001' })
  @ApiProblemResponse({
    status: 404,
    description: 'Report or picture not found',
    code: 'INBOX_005',
  })
  async read(
    @Req() request: ScopedRequest,
    @Param('id', new ParseUUIDPipe()) reportId: string,
    @Param('imageId', new ParseUUIDPipe()) imageId: string,
  ): Promise<StreamableFile> {
    const image = await this.queryBus.execute<ReadInboxReportImageQuery, InboxReportImageContent>(
      new ReadInboxReportImageQuery(tenantOrganizationIdOf(request), reportId, imageId),
    );
    return new StreamableFile(image.data, { type: image.mimeType, length: image.data.length });
  }
}
