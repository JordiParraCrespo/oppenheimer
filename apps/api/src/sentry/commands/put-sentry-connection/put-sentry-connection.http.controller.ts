import { Body, Controller, Put, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { SentryConnectionResponseDto } from '../../dtos/sentry-connection.response.dto';
import { FindSentryConnectionQuery } from '../../queries/find-sentry-connection/find-sentry-connection.query';
import { PutSentryConnectionCommand } from './put-sentry-connection.command';
import { PutSentryConnectionRequest } from './put-sentry-connection.request.dto';

@ApiTags('Sentry')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sentry')
export class PutSentryConnectionHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Put('connection')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Automation' })
  @RequireScopes('automations:write')
  @ApiOperation({
    summary: 'Connect the workspace’s Sentry organization',
    description:
      'Stores the slug and the internal integration’s client secret (sealed, never returned), replacing the workspace’s previous ones; the connection keeps its id. Answers the connection with the webhook URL to paste into the integration.',
  })
  @ApiResponse({ status: 200, type: SentryConnectionResponseDto })
  @ApiProblemResponse({ status: 400, description: 'No active workspace', code: 'TENANT_001' })
  @ApiProblemResponse({
    status: 503,
    description: 'Sentry triggers are not configured on this server',
    code: 'SENTRY_001',
  })
  async put(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: PutSentryConnectionRequest,
  ): Promise<SentryConnectionResponseDto> {
    await this.commandBus.execute(
      new PutSentryConnectionCommand({
        scope,
        organizationSlug: body.organizationSlug,
        clientSecret: body.clientSecret,
      }),
    );
    return this.queryBus.execute(new FindSentryConnectionQuery({ scope }));
  }
}
