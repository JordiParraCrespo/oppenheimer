import { Body, Controller, Param, Put, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { CloudAgentProblemResponses } from '../../decorators/cloud-agent-problem-responses.decorator';
import { CloudAgentStatusResponseDto } from '../../dtos/cloud-agent-status.response.dto';
import { FindCloudAgentStatusQuery } from '../../queries/find-cloud-agent-status/find-cloud-agent-status.query';
import { PutCloudAgentCredentialCommand } from './put-cloud-agent-credential.command';
import { PutCloudAgentCredentialRequest } from './put-cloud-agent-credential.request.dto';

@ApiTags('Cloud agents')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('cloud-agents')
export class PutCloudAgentCredentialHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Put('providers/:provider/credential')
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'CloudAgent' })
  @RequireScopes('cloud-agents:write')
  @ApiOperation({
    summary: 'Connect a cloud agent vendor with the caller’s own key',
    description:
      'The vendor is asked whose key it is first; a key it refuses is not stored. The key is sealed, replaces the caller’s key for that vendor, and is never returned. Answers the status.',
  })
  @ApiParam({ name: 'provider', enum: ['cursor'] })
  @ApiResponse({ status: 200, type: CloudAgentStatusResponseDto })
  @CloudAgentProblemResponses()
  @ApiProblemResponse({ status: 404, description: 'No such provider', code: 'CLOUD_AGENTS_011' })
  @ApiProblemResponse({
    status: 422,
    description: 'The vendor refused the key',
    code: 'CLOUD_AGENTS_005',
  })
  @ApiProblemResponse({
    status: 429,
    description: "The vendor's rate limit was reached; try again after Retry-After",
    code: 'CLOUD_AGENTS_007',
  })
  @ApiProblemResponse({
    status: 502,
    description: 'The vendor did not answer',
    code: 'CLOUD_AGENTS_006',
  })
  @ApiProblemResponse({
    status: 503,
    description: 'Cloud agents are not configured on this server',
    code: 'CLOUD_AGENTS_003',
  })
  async put(
    @CurrentAccessScope() scope: AccessScope,
    @Param('provider') provider: string,
    @Body() body: PutCloudAgentCredentialRequest,
  ): Promise<CloudAgentStatusResponseDto> {
    await this.commandBus.execute(
      new PutCloudAgentCredentialCommand({ scope, provider, apiKey: body.apiKey }),
    );
    return this.queryBus.execute(new FindCloudAgentStatusQuery({ scope }));
  }
}
