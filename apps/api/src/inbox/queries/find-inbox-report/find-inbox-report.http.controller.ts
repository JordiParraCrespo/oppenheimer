import { Controller, Get, Param, ParseUUIDPipe, Req, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { tenantOrganizationIdOf } from '../../../auth/domain/request-tenant.types';
import type { ScopedRequest } from '../../../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { RequireFlag } from '../../../feature-flags/decorators/require-flag.decorator';
import type { InboxReportEntity } from '../../domain/inbox-report.entity';
import { InboxReportResponseDto } from '../../dtos/inbox-report.response.dto';
import { InboxReportMapper } from '../../inbox-report.mapper';
import { FindInboxReportQuery } from './find-inbox-report.query';

@ApiTags('Inbox')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('inbox')
export class FindInboxReportHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: InboxReportMapper,
  ) {}

  @Get('reports/:id')
  @Version('1')
  @NoPolicy('reads a report in the Inbox of the workspace the credential acts in')
  @RequireScopes('inbox-reports:read')
  @RequireFlag('inbox')
  @ApiOperation({
    summary: 'Read an Inbox report',
    description:
      'One report with its `status` and, once the owner has answered, its `answer`. This is what a report’s sender asks to learn the answer.',
  })
  @ApiResponse({ status: 200, type: InboxReportResponseDto })
  @ApiProblemResponse({ status: 400, description: 'No active workspace', code: 'TENANT_001' })
  @ApiProblemResponse({ status: 404, description: 'Report not found', code: 'INBOX_005' })
  async find(
    @Req() request: ScopedRequest,
    @Param('id', new ParseUUIDPipe()) reportId: string,
  ): Promise<InboxReportResponseDto> {
    const report = await this.queryBus.execute<FindInboxReportQuery, InboxReportEntity>(
      new FindInboxReportQuery(tenantOrganizationIdOf(request), reportId),
    );
    return this.mapper.toResponse(report);
  }
}
