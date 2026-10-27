import { Controller, Get, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { CloudAgentMapper } from '../../cloud-agent.mapper';
import { CloudAgentProblemResponses } from '../../decorators/cloud-agent-problem-responses.decorator';
import type { CloudAgentEntity } from '../../domain/cloud-agent.entity';
import { CloudAgentResponseDto } from '../../dtos/cloud-agent.response.dto';
import { FindCloudAgentsQuery } from './find-cloud-agents.query';

@ApiTags('Cloud agents')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('cloud-agents')
export class FindCloudAgentsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: CloudAgentMapper,
  ) {}

  @Get()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'CloudAgent' })
  @RequireScopes('cloud-agents:read')
  @ApiOperation({
    summary: 'The caller’s cloud agents',
    description:
      'The fifty newest the caller launched here, newest first. A few working ones are asked about again first; the rest are as last heard of (`syncedAt`). A vendor that does not answer never fails the list.',
  })
  @ApiResponse({ status: 200, type: [CloudAgentResponseDto] })
  @CloudAgentProblemResponses()
  async find(@CurrentAccessScope() scope: AccessScope): Promise<CloudAgentResponseDto[]> {
    const agents = await this.queryBus.execute<FindCloudAgentsQuery, CloudAgentEntity[]>(
      new FindCloudAgentsQuery({ scope }),
    );
    return agents.map((agent) => this.mapper.toResponse(agent));
  }
}
