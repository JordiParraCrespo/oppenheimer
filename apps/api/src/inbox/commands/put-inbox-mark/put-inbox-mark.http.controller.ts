import { Body, Controller, Param, Put, Req, UseGuards, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { FindInboxMarkQuery } from '../../queries/find-inbox-mark/find-inbox-mark.query';
import { PutInboxMarkCommand } from './put-inbox-mark.command';
import { PutInboxMarkRequest } from './put-inbox-mark.request.dto';

@ApiTags('Inbox')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('inbox')
export class PutInboxMarkHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: InboxMarkMapper,
  ) {}

  @Put('marks/:itemKey')
  @Version('1')
  @NoPolicy('marks an item in the caller’s own Inbox')
  @RequireScopes('inbox:write')
  @RequireFlag('inbox')
  @ApiOperation({
    summary: 'Mark an Inbox item',
    description:
      'Done, low, snoozed until a time in the future, or deleted: replaces whatever the caller had on this occurrence. The key is URL-encoded in the path.',
  })
  @ApiParam({ name: 'itemKey', description: 'The occurrence, e.g. `approval:<id>`.' })
  @ApiResponse({ status: 200, type: InboxMarkResponseDto })
  @ApiProblemResponse({ status: 400, description: 'No active workspace', code: 'INBOX_001' })
  @ApiProblemResponse({ status: 400, description: 'Not an Inbox item key', code: 'INBOX_002' })
  @ApiProblemResponse({ status: 422, description: 'Snooze not in the future', code: 'INBOX_003' })
  async put(
    @Req() request: ScopedRequest,
    @CurrentUser('id') userId: string,
    @Param('itemKey') itemKey: string,
    @Body() body: PutInboxMarkRequest,
  ): Promise<InboxMarkResponseDto> {
    const organizationId = tenantOrganizationIdOf(request);
    await this.commandBus.execute(
      new PutInboxMarkCommand({
        organizationId,
        userId,
        itemKey,
        mark: body.mark,
        until: body.until ? new Date(body.until) : null,
      }),
    );
    const mark = await this.queryBus.execute<FindInboxMarkQuery, InboxMarkEntity>(
      new FindInboxMarkQuery(organizationId ?? '', userId, itemKey),
    );
    return this.mapper.toResponse(mark);
  }
}
