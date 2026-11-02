import {
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { RemoveGmailConnectionCommand } from './remove-gmail-connection.command';

@ApiTags('Mail')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('mail')
export class RemoveGmailConnectionHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete('gmail/connections/:id')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'delete', subject: 'Mail' })
  @RequireScopes('mail:write')
  @ApiOperation({
    summary: 'Disconnect a Gmail account',
    description:
      'Revokes that account’s grant at Google and forgets it; no bot can reach it after. An id that is not one of the caller’s does nothing.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'The connection.' })
  @ApiResponse({ status: 204 })
  async remove(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.commandBus.execute(new RemoveGmailConnectionCommand({ scope, connectionId: id }));
  }
}
