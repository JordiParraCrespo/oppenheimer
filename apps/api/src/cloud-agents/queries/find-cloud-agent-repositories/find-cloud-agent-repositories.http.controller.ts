import { Controller, Get, Param, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { CloudAgentVendorProblemResponses } from '../../decorators/cloud-agent-problem-responses.decorator';
import { CloudAgentRepositoryResponseDto } from '../../dtos/cloud-agent-model.response.dto';
import { FindCloudAgentRepositoriesQuery } from './find-cloud-agent-repositories.query';

@ApiTags('Cloud agents')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('cloud-agents')
export class FindCloudAgentRepositoriesHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('providers/:provider/repositories')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'CloudAgent' })
  @RequireScopes('cloud-agents:read')
  @ApiOperation({
    summary: 'The repositories a vendor can reach for the caller',
    description:
      'Asked of the vendor on the caller’s key and kept for ten minutes: Cursor allows one listing a minute. GitHub repositories only.',
  })
  @ApiParam({ name: 'provider', enum: ['cursor'] })
  @ApiResponse({ status: 200, type: [CloudAgentRepositoryResponseDto] })
  @CloudAgentVendorProblemResponses()
  @ApiProblemResponse({ status: 404, description: 'No such provider', code: 'CLOUD_AGENTS_011' })
  async find(
    @CurrentAccessScope() scope: AccessScope,
    @Param('provider') provider: string,
  ): Promise<CloudAgentRepositoryResponseDto[]> {
    const urls = await this.queryBus.execute<FindCloudAgentRepositoriesQuery, string[]>(
      new FindCloudAgentRepositoriesQuery({ scope, provider }),
    );
    return urls.map((url) => ({ url }));
  }
}
