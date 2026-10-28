import { Controller, Get, Param, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { CloudAgentModel } from '../../application/cloud-agent-provider.port';
import { CloudAgentVendorProblemResponses } from '../../decorators/cloud-agent-problem-responses.decorator';
import { CloudAgentModelResponseDto } from '../../dtos/cloud-agent-model.response.dto';
import { FindCloudAgentModelsQuery } from './find-cloud-agent-models.query';

@ApiTags('Cloud agents')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('cloud-agents')
export class FindCloudAgentModelsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('providers/:provider/models')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'CloudAgent' })
  @RequireScopes('cloud-agents:read')
  @ApiOperation({
    summary: 'The models a vendor offers the caller’s cloud agents',
    description:
      'Asked of the vendor on the caller’s key and kept for an hour. The vendor’s own default is not listed: a launch with no model runs on it.',
  })
  @ApiParam({ name: 'provider', enum: ['cursor'] })
  @ApiResponse({ status: 200, type: [CloudAgentModelResponseDto] })
  @CloudAgentVendorProblemResponses()
  @ApiProblemResponse({ status: 404, description: 'No such provider', code: 'CLOUD_AGENTS_011' })
  async find(
    @CurrentAccessScope() scope: AccessScope,
    @Param('provider') provider: string,
  ): Promise<CloudAgentModelResponseDto[]> {
    const models = await this.queryBus.execute<FindCloudAgentModelsQuery, CloudAgentModel[]>(
      new FindCloudAgentModelsQuery({ scope, provider }),
    );
    return models.map((model) => ({ id: model.id, label: model.label }));
  }
}
