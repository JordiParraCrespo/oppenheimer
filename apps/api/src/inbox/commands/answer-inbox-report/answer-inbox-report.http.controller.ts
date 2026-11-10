import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { FindInboxReportQuery } from '../../queries/find-inbox-report/find-inbox-report.query';
import { AnswerInboxReportCommand } from './answer-inbox-report.command';
import { AnswerInboxReportRequest } from './answer-inbox-report.request.dto';

@ApiTags('Inbox')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('inbox')
export class AnswerInboxReportHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: InboxReportMapper,
  ) {}

  @Post('reports/:id/answer')
  @Version('1')
  @HttpCode(200)
  @NoPolicy('answers a report in the caller’s own Inbox')
  // The Inbox's own scope, not the reports': a key that only sends and reads
  // reports cannot answer what it asked.
  @RequireScopes('inbox:write')
  @RequireFlag('inbox')
  @ApiOperation({
    summary: 'Answer an Inbox report',
    description:
      'What the person tells the agent that sent the report, once: the report leaves the Inbox, and its sender reads the answer with `GET /inbox/reports/:id`.',
  })
  @ApiResponse({ status: 200, type: InboxReportResponseDto })
  @ApiProblemResponse({ status: 400, description: 'No active workspace', code: 'TENANT_001' })
  @ApiProblemResponse({ status: 404, description: 'Report not found', code: 'INBOX_005' })
  @ApiProblemResponse({ status: 409, description: 'Already answered', code: 'INBOX_006' })
  async answer(
    @Req() request: ScopedRequest,
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) reportId: string,
    @Body() body: AnswerInboxReportRequest,
  ): Promise<InboxReportResponseDto> {
    const organizationId = tenantOrganizationIdOf(request);
    await this.commandBus.execute(
      new AnswerInboxReportCommand({ organizationId, userId, reportId, text: body.text }),
    );
    const report = await this.queryBus.execute<FindInboxReportQuery, InboxReportEntity>(
      new FindInboxReportQuery(organizationId, reportId),
    );
    return this.mapper.toResponse(report);
  }
}
