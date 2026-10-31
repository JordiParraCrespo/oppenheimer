import { Controller, Get, Query, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { MilestoneWithProgress } from '../../database/milestone.repository.port';
import { MilestoneResponseDto } from '../../dtos/milestone.response.dto';
import { MilestoneMapper } from '../../milestone.mapper';
import { FindMilestonesQuery } from './find-milestones.query';
import { FindMilestonesRequest } from './find-milestones.request.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('milestones')
export class FindMilestonesHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: MilestoneMapper,
  ) {}

  @Get()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Task' })
  @RequireScopes('tasks:read')
  @ApiOperation({
    summary: 'List milestones, with their progress',
    description:
      'Of one project or of the workspace, oldest first. Progress counts the milestone’s tasks.',
  })
  @ApiQuery({
    name: 'projectId',
    required: false,
    type: String,
    format: 'uuid',
    description: 'Only this project’s milestones.',
  })
  @ApiResponse({ status: 200, type: [MilestoneResponseDto] })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Query() query: FindMilestonesRequest,
  ): Promise<MilestoneResponseDto[]> {
    const milestones = await this.queryBus.execute<FindMilestonesQuery, MilestoneWithProgress[]>(
      new FindMilestonesQuery({ scope, projectId: query.projectId }),
    );
    return milestones.map(({ milestone, progress }) => this.mapper.toResponse(milestone, progress));
  }
}
