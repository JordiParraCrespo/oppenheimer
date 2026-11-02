import { Controller, Get, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { SentryStatusResponseDto } from '../../dtos/sentry-connection.response.dto';
import { FindSentryConnectionQuery } from './find-sentry-connection.query';

@ApiTags('Sentry')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sentry')
export class FindSentryConnectionHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('connection')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Automation' })
  @RequireScopes('automations:read')
  @ApiOperation({
    summary: 'Whether Sentry is connected to the workspace',
    description:
      'Whether this server can connect Sentry at all, and the workspace’s connection: the Sentry organization, the client secret’s last four characters, and the webhook URL its integration posts to. Null when none.',
  })
  @ApiResponse({ status: 200, type: SentryStatusResponseDto })
  @ApiProblemResponse({ status: 400, description: 'No active workspace', code: 'TENANT_001' })
  find(@CurrentAccessScope() scope: AccessScope): Promise<SentryStatusResponseDto> {
    return this.queryBus.execute(new FindSentryConnectionQuery({ scope }));
  }
}
