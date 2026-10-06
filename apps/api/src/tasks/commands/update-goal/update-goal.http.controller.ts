import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { GoalWithProgress } from '../../database/goal.repository.port';
import { GoalResponseDto } from '../../dtos/goal.response.dto';
import { GoalMapper } from '../../goal.mapper';
import { FindGoalQuery } from '../../queries/find-goal/find-goal.query';
import { UpdateGoalCommand } from './update-goal.command';
import { UpdateGoalRequest } from './update-goal.request.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('goals')
export class UpdateGoalHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: GoalMapper,
  ) {}

  @Patch(':id')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Task' })
  @RequireScopes('tasks:write')
  @ApiOperation({
    summary: 'Change a goal',
    description: 'Its name, target date or project. Moving it to another project moves its tasks.',
  })
  @ApiResponse({ status: 200, type: GoalResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Goal not found', code: 'TASKS_002' })
  @ApiProblemResponse({
    status: 409,
    description: 'Project archived or missing',
    code: 'TASKS_004',
  })
  async update(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateGoalRequest,
  ): Promise<GoalResponseDto> {
    await this.commandBus.execute(new UpdateGoalCommand({ scope, goalId: id, changes: body }));
    const { goal, progress } = await this.queryBus.execute<FindGoalQuery, GoalWithProgress>(
      new FindGoalQuery({ scope, goalId: id }),
    );
    return this.mapper.toResponse(goal, progress);
  }
}
