import {
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
import { CancelCloudAgentCommand } from './cancel-cloud-agent.command';

@ApiTags('Cloud agents')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('cloud-agents')
export class CancelCloudAgentHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: CloudAgentMapper,
  ) {}

  @Post(':id/cancel')
  @Version('1')
  @HttpCode(200)
  @CheckPolicies({ action: 'update', subject: 'CloudAgent' })
  @RequireScopes('cloud-agents:write')
  @ApiOperation({
    summary: 'Stop the latest run of one of the caller’s cloud agents',
    description:
      'The agent stays; a follow-up starts it again. A run that already ended is CLOUD_AGENTS_009.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: CloudAgentResponseDto })
  @CloudAgentVendorProblemResponses()
  @ApiProblemResponse({ status: 404, description: 'No such cloud agent', code: 'CLOUD_AGENTS_001' })
  @ApiProblemResponse({
    status: 409,
    description: 'The run already ended',
    code: 'CLOUD_AGENTS_009',
  })
  async cancel(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CloudAgentResponseDto> {
    const agentId = await this.commandBus.execute<CancelCloudAgentCommand, AggregateID>(
      new CancelCloudAgentCommand({ scope, agentId: id }),
    );
    const agent = await this.queryBus.execute<FindCloudAgentQuery, CloudAgentEntity>(
      new FindCloudAgentQuery({ scope, id: agentId }),
    );
    return this.mapper.toResponse(agent);
  }
}
