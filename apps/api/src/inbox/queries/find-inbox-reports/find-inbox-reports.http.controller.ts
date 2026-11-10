import { Controller, Get, Query, Req, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { INBOX_REPORT_STATUSES, INBOX_REPORTS_MAX } from '@oppenheimer/shared';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { tenantOrganizationIdOf } from '../../../auth/domain/request-tenant.types';
import type { ScopedRequest } from '../../../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { RequireFlag } from '../../../feature-flags/decorators/require-flag.decorator';
import type { InboxReportEntity } from '../../domain/inbox-report.entity';
import { InboxReportResponseDto } from '../../dtos/inbox-report.response.dto';
import { InboxReportMapper } from '../../inbox-report.mapper';
import { FindInboxReportsQuery } from './find-inbox-reports.query';
import { FindInboxReportsRequest } from './find-inbox-reports.request.dto';

@ApiTags('Inbox')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('inbox')
export class FindInboxReportsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: InboxReportMapper,
  ) {}

  @Get('reports')
  @Version('1')
  @NoPolicy('reads the reports in the Inbox of the workspace the credential acts in')
  @RequireScopes('inbox-reports:read')
  @RequireFlag('inbox')
  @ApiOperation({
    summary: 'Inbox reports',
    description: `The workspace's reports in one status, the newest first, at most ${INBOX_REPORTS_MAX}: the open ones, which wait on the owner, unless \`status=answered\`.`,
  })
  @ApiQuery({ name: 'status', required: false, enum: INBOX_REPORT_STATUSES })
  @ApiResponse({ status: 200, type: InboxReportResponseDto, isArray: true })
  @ApiProblemResponse({ status: 400, description: 'No active workspace', code: 'TENANT_001' })
  async find(
    @Req() request: ScopedRequest,
    @Query() query: FindInboxReportsRequest,
  ): Promise<InboxReportResponseDto[]> {
    const reports = await this.queryBus.execute<FindInboxReportsQuery, InboxReportEntity[]>(
      new FindInboxReportsQuery(tenantOrganizationIdOf(request), query.status ?? 'open'),
    );
    return reports.map((report) => this.mapper.toResponse(report));
  }
}
