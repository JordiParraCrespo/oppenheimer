import { Controller, Delete, HttpCode, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { RemoveSentryConnectionCommand } from './remove-sentry-connection.command';

@ApiTags('Sentry')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sentry')
export class RemoveSentryConnectionHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete('connection')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'update', subject: 'Automation' })
  @RequireScopes('automations:write')
  @ApiOperation({
    summary: 'Disconnect the workspace’s Sentry organization',
    description:
      'Forgets the slug and the secret. The webhook URL stops answering and Sentry triggers stop firing. No connection does nothing.',
  })
  @ApiResponse({ status: 204 })
  @ApiProblemResponse({ status: 400, description: 'No active workspace', code: 'TENANT_001' })
  async remove(@CurrentAccessScope() scope: AccessScope): Promise<void> {
    await this.commandBus.execute(new RemoveSentryConnectionCommand({ scope }));
  }
}
