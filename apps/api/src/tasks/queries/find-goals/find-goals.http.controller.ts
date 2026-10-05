import { Controller, Get, Query, UseGuards, UseInterceptors, Version } from '@nestjs/common';
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
import type { GoalWithProgress } from '../../database/goal.repository.port';
import { GoalResponseDto } from '../../dtos/goal.response.dto';
import { GoalMapper } from '../../goal.mapper';
import { FindGoalsQuery } from './find-goals.query';
import { FindGoalsRequest } from './find-goals.request.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('goals')
export class FindGoalsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: GoalMapper,
  ) {}

  @Get()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Task' })
  @RequireScopes('tasks:read')
  @ApiOperation({
    summary: 'List goals, with their progress',
    description:
      'Of one project or of the workspace, oldest first. Progress counts the goal’s tasks.',
  })
  @ApiResponse({ status: 200, type: [GoalResponseDto] })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Query() query: FindGoalsRequest,
  ): Promise<GoalResponseDto[]> {
    const goals = await this.queryBus.execute<FindGoalsQuery, GoalWithProgress[]>(
      new FindGoalsQuery({ scope, projectId: query.projectId }),
    );
    return goals.map(({ goal, progress }) => this.mapper.toResponse(goal, progress));
  }
}
