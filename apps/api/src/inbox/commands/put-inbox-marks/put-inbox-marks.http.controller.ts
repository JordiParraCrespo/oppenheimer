import { Body, Controller, HttpCode, Post, Req, UseGuards, Version } from '@nestjs/common';
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
import type { InboxMarkEntity } from '../../domain/inbox-mark.entity';
import { InboxMarkResponseDto } from '../../dtos/inbox-mark.response.dto';
import { InboxMarkMapper } from '../../inbox-mark.mapper';
import { FindInboxMarksQuery } from '../../queries/find-inbox-marks/find-inbox-marks.query';
import { PutInboxMarksCommand } from './put-inbox-marks.command';
import { PutInboxMarksRequest } from './put-inbox-marks.request.dto';

@ApiTags('Inbox')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('inbox')
export class PutInboxMarksHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: InboxMarkMapper,
  ) {}

  @Post('marks/batch')
  @Version('1')
  @HttpCode(200)
  @NoPolicy('marks items in the caller’s own Inbox')
  @RequireScopes('inbox:write')
  @RequireFlag('inbox')
  @ApiOperation({
    summary: 'Mark several Inbox items at once',
    description:
      'A bulk action on a selection: the same mark on every occurrence, replacing whatever the caller had on each, or `mark: null` to clear each one’s mark. Every key and the snooze’s end are checked before anything is written. Answers the caller’s marks in force afterwards, as `GET /inbox/marks` does.',
  })
  @ApiResponse({ status: 200, type: [InboxMarkResponseDto] })
  @ApiProblemResponse({ status: 400, description: 'No active workspace', code: 'TENANT_001' })
  @ApiProblemResponse({ status: 400, description: 'Not an Inbox item key', code: 'INBOX_002' })
  @ApiProblemResponse({ status: 422, description: 'Snooze not in the future', code: 'INBOX_003' })
  async putAll(
    @Req() request: ScopedRequest,
    @CurrentUser('id') userId: string,
    @Body() body: PutInboxMarksRequest,
  ): Promise<InboxMarkResponseDto[]> {
    const organizationId = tenantOrganizationIdOf(request);
    await this.commandBus.execute(
      new PutInboxMarksCommand({
        organizationId,
        userId,
        itemKeys: body.itemKeys,
        mark: body.mark,
        until: body.until ? new Date(body.until) : null,
      }),
    );
    const marks = await this.queryBus.execute<FindInboxMarksQuery, InboxMarkEntity[]>(
      new FindInboxMarksQuery(organizationId, userId),
    );
    return marks.map((mark) => this.mapper.toResponse(mark));
  }
}
