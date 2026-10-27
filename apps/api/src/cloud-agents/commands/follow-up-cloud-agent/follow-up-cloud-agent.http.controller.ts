import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
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
import { FollowUpCloudAgentCommand } from './follow-up-cloud-agent.command';
import { FollowUpCloudAgentRequest } from './follow-up-cloud-agent.request.dto';

@ApiTags('Cloud agents')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('cloud-agents')
export class FollowUpCloudAgentHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: CloudAgentMapper,
  ) {}

  @Post(':id/follow-ups')
  @Version('1')
  @HttpCode(200)
  @CheckPolicies({ action: 'update', subject: 'CloudAgent' })
  @RequireScopes('cloud-agents:write')
  @ApiOperation({
    summary: 'Give one of the caller’s cloud agents its next instruction',
    description:
      'A new run on the same agent, at the vendor. Refused while its run is still going (CLOUD_AGENTS_008).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: CloudAgentResponseDto })
  @CloudAgentVendorProblemResponses()
  @ApiProblemResponse({ status: 404, description: 'No such cloud agent', code: 'CLOUD_AGENTS_001' })
  @ApiProblemResponse({
    status: 409,
    description: 'The agent is still working',
    code: 'CLOUD_AGENTS_008',
  })
  async followUp(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: FollowUpCloudAgentRequest,
  ): Promise<CloudAgentResponseDto> {
    const agentId = await this.commandBus.execute<FollowUpCloudAgentCommand, AggregateID>(
      new FollowUpCloudAgentCommand({ scope, agentId: id, prompt: body.prompt }),
    );
    const agent = await this.queryBus.execute<FindCloudAgentQuery, CloudAgentEntity>(
      new FindCloudAgentQuery({ scope, id: agentId }),
    );
    return this.mapper.toResponse(agent);
  }
}
