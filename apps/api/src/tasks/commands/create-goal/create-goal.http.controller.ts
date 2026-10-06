import { Body, Controller, Post, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { GoalWithProgress } from '../../database/goal.repository.port';
import { GoalResponseDto } from '../../dtos/goal.response.dto';
import { GoalMapper } from '../../goal.mapper';
import { FindGoalQuery } from '../../queries/find-goal/find-goal.query';
import { CreateGoalCommand } from './create-goal.command';
import { CreateGoalRequest } from './create-goal.request.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('goals')
export class CreateGoalHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: GoalMapper,
  ) {}

  @Post()
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'Task' })
  @RequireScopes('tasks:write')
  @ApiOperation({ summary: 'Add a goal to a project' })
  @ApiResponse({ status: 201, type: GoalResponseDto })
  @ApiProblemResponse({
    status: 409,
    description: 'Project archived or missing',
    code: 'TASKS_004',
  })
  async create(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @Body() body: CreateGoalRequest,
  ): Promise<GoalResponseDto> {
    const goalId = await this.commandBus.execute<CreateGoalCommand, string>(
      new CreateGoalCommand({ scope, userId, input: body }),
    );
    const { goal, progress } = await this.queryBus.execute<FindGoalQuery, GoalWithProgress>(
      new FindGoalQuery({ scope, goalId }),
    );
    return this.mapper.toResponse(goal, progress);
  }
}
