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
import { CloudAgentProblemResponses } from '../../decorators/cloud-agent-problem-responses.decorator';
import { CloudAgentStatusResponseDto } from '../../dtos/cloud-agent-status.response.dto';
import { FindCloudAgentStatusQuery } from './find-cloud-agent-status.query';

@ApiTags('Cloud agents')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('cloud-agents')
export class FindCloudAgentStatusHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('status')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'CloudAgent' })
  @RequireScopes('cloud-agents:read')
  @ApiOperation({
    summary: 'Whether the caller can launch cloud agents, and on which vendors',
    description:
      'Every vendor in order, with whether the caller stored a key for it and whose the key is. Never the key, and never a call to the vendor.',
  })
  @ApiResponse({ status: 200, type: CloudAgentStatusResponseDto })
  @CloudAgentProblemResponses()
  find(@CurrentAccessScope() scope: AccessScope): Promise<CloudAgentStatusResponseDto> {
    return this.queryBus.execute(new FindCloudAgentStatusQuery({ scope }));
  }
}
