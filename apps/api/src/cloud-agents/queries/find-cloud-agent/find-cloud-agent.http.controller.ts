import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
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
import { CloudAgentMapper } from '../../cloud-agent.mapper';
import { CloudAgentProblemResponses } from '../../decorators/cloud-agent-problem-responses.decorator';
import type { CloudAgentEntity } from '../../domain/cloud-agent.entity';
import { CloudAgentResponseDto } from '../../dtos/cloud-agent.response.dto';
import { FindCloudAgentQuery } from './find-cloud-agent.query';

@ApiTags('Cloud agents')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('cloud-agents')
export class FindCloudAgentHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: CloudAgentMapper,
  ) {}

  @Get(':id')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'CloudAgent' })
  @RequireScopes('cloud-agents:read')
  @ApiOperation({
    summary: 'One of the caller’s cloud agents',
    description:
      'While it works, the vendor is asked about its run at most once every ten seconds; a vendor that does not answer leaves it as last heard of.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: CloudAgentResponseDto })
  @CloudAgentProblemResponses()
  @ApiProblemResponse({ status: 404, description: 'No such cloud agent', code: 'CLOUD_AGENTS_001' })
  async find(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CloudAgentResponseDto> {
    const agent = await this.queryBus.execute<FindCloudAgentQuery, CloudAgentEntity>(
      new FindCloudAgentQuery({ scope, id }),
    );
    return this.mapper.toResponse(agent);
  }
}
