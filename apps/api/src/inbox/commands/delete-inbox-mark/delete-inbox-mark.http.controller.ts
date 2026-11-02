import { Controller, Delete, HttpCode, Param, Req, UseGuards, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { tenantOrganizationIdOf } from '../../../auth/domain/request-tenant.types';
import type { ScopedRequest } from '../../../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { RequireFlag } from '../../../feature-flags/decorators/require-flag.decorator';
import { DeleteInboxMarkCommand } from './delete-inbox-mark.command';

@ApiTags('Inbox')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('inbox')
export class DeleteInboxMarkHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete('marks/:itemKey')
  @Version('1')
  @HttpCode(204)
  @NoPolicy('removes a mark from the caller’s own Inbox')
  @RequireScopes('inbox:write')
  @RequireFlag('inbox')
  @ApiOperation({
    summary: 'Remove an Inbox mark',
    description:
      'Bring back a snoozed item, or restore its priority: the occurrence is as it was. Removing a mark that is not there succeeds. The key is URL-encoded in the path.',
  })
  @ApiParam({ name: 'itemKey', description: 'The occurrence, e.g. `approval:<id>`.' })
  @ApiResponse({ status: 204, description: 'The occurrence has no mark.' })
  @ApiProblemResponse({ status: 400, description: 'No active workspace', code: 'TENANT_001' })
  @ApiProblemResponse({ status: 400, description: 'Not an Inbox item key', code: 'INBOX_002' })
  async remove(
    @Req() request: ScopedRequest,
    @CurrentUser('id') userId: string,
    @Param('itemKey') itemKey: string,
  ): Promise<void> {
    await this.commandBus.execute(
      new DeleteInboxMarkCommand({
        organizationId: tenantOrganizationIdOf(request),
        userId,
        itemKey,
      }),
    );
  }
}
