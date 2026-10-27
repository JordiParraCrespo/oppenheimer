import { Body, Controller, Post, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { CloudAgentMapper } from '../../cloud-agent.mapper';
import { CloudAgentVendorProblemResponses } from '../../decorators/cloud-agent-problem-responses.decorator';
import type { CloudAgentEntity } from '../../domain/cloud-agent.entity';
import { CloudAgentResponseDto } from '../../dtos/cloud-agent.response.dto';
import { FindCloudAgentQuery } from '../../queries/find-cloud-agent/find-cloud-agent.query';
import { LaunchCloudAgentCommand } from './launch-cloud-agent.command';
import { LaunchCloudAgentRequest } from './launch-cloud-agent.request.dto';

@ApiTags('Cloud agents')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('cloud-agents')
export class LaunchCloudAgentHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: CloudAgentMapper,
  ) {}

  @Post()
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'CloudAgent' })
  @RequireScopes('cloud-agents:write')
  @ApiOperation({
    summary: 'Launch a coding agent in a vendor’s cloud',
    description:
      'On the caller’s own key for the vendor, in a repository the vendor can reach, from its default branch or a starting ref. It bills the caller’s own plan at the vendor. Nothing is stored when the vendor refuses.',
  })
  @ApiResponse({ status: 201, type: CloudAgentResponseDto })
  @CloudAgentVendorProblemResponses()
  async launch(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: LaunchCloudAgentRequest,
  ): Promise<CloudAgentResponseDto> {
    const id = await this.commandBus.execute<LaunchCloudAgentCommand, AggregateID>(
      new LaunchCloudAgentCommand({ scope, input: body }),
    );
    const agent = await this.queryBus.execute<FindCloudAgentQuery, CloudAgentEntity>(
      new FindCloudAgentQuery({ scope, id }),
    );
    return this.mapper.toResponse(agent);
  }
}
