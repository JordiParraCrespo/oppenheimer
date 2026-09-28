import { Controller, Get, Query, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { AutomationMapper } from '../../automation.mapper';
import type { AutomationListing } from '../../domain/automation-read.types';
import { AutomationResponseDto } from '../../dtos/automation.response.dto';
import { FindAutomationsQuery } from './find-automations.query';
import { FindAutomationsRequest } from './find-automations.request.dto';

@ApiTags('Automations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('automations')
export class FindAutomationsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: AutomationMapper,
  ) {}

  @Get()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Automation' })
  @RequireScopes('automations:read')
  @ApiOperation({
    summary: 'List the workspace’s automations',
    description:
      'Oldest first, as the sidebar groups them by project. Each carries its status (running while a run is live), its next run, its run count over the last 30 days and its last six runs.',
  })
  @ApiQuery({
    name: 'projectId',
    required: false,
    type: String,
    description: 'One project’s automations',
  })
  @ApiResponse({ status: 200, type: [AutomationResponseDto] })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Query() query: FindAutomationsRequest,
  ): Promise<AutomationResponseDto[]> {
    const listing = await this.queryBus.execute<FindAutomationsQuery, AutomationListing>(
      new FindAutomationsQuery({ scope, projectId: query.projectId }),
    );
    return listing.automations.map((automation) =>
      this.mapper.toResponse(automation, scope.userId, listing.digests.get(automation.id)),
    );
  }
}
