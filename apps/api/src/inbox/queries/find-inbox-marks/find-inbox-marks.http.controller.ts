import { Controller, Get, Req, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { INBOX_MARKS_MAX } from '@oppenheimer/shared';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { tenantOrganizationIdOf } from '../../../auth/domain/request-tenant.types';
import type { ScopedRequest } from '../../../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { NoPolicy } from '../../../authz/decorators/check-policies.decorator';
import { RequireFlag } from '../../../feature-flags/decorators/require-flag.decorator';
import type { InboxMarkEntity } from '../../domain/inbox-mark.entity';
import { InboxMarkResponseDto } from '../../dtos/inbox-mark.response.dto';
import { InboxMarkMapper } from '../../inbox-mark.mapper';
import { FindInboxMarksQuery } from './find-inbox-marks.query';

@ApiTags('Inbox')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('inbox')
export class FindInboxMarksHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: InboxMarkMapper,
  ) {}

  @Get('marks')
  @Version('1')
  @NoPolicy('reads the caller’s own Inbox marks')
  @RequireScopes('inbox:read')
  @RequireFlag('inbox')
  @ApiOperation({
    summary: 'Your Inbox marks',
    description: `What you did to Inbox items in this workspace, the newest changed first, at most ${INBOX_MARKS_MAX}. A snooze whose end has passed is left out: its item is back.`,
  })
  @ApiResponse({ status: 200, type: InboxMarkResponseDto, isArray: true })
  @ApiProblemResponse({ status: 400, description: 'No active workspace', code: 'INBOX_001' })
  async find(
    @Req() request: ScopedRequest,
    @CurrentUser('id') userId: string,
  ): Promise<InboxMarkResponseDto[]> {
    const marks = await this.queryBus.execute<FindInboxMarksQuery, InboxMarkEntity[]>(
      new FindInboxMarksQuery(tenantOrganizationIdOf(request), userId),
    );
    return marks.map((mark) => this.mapper.toResponse(mark));
  }
}
