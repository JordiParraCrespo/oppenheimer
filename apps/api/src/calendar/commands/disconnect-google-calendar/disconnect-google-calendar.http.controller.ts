import { Controller, Delete, HttpCode, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { DisconnectGoogleCalendarCommand } from './disconnect-google-calendar.command';

@ApiTags('Calendar')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('calendar')
export class DisconnectGoogleCalendarHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete('google/connection')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'delete', subject: 'Calendar' })
  @RequireScopes('calendar:write')
  @ApiOperation({
    summary: 'Disconnect Google Calendar',
    description: 'Revokes the grant at Google and forgets it. With no connection, nothing happens.',
  })
  @ApiResponse({ status: 204 })
  async disconnect(@CurrentAccessScope() scope: AccessScope): Promise<void> {
    await this.commandBus.execute(new DisconnectGoogleCalendarCommand({ scope }));
  }
}
