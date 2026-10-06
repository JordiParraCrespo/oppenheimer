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
import type { TaskEntity } from '../../domain/task.entity';
import { TaskResponseDto } from '../../dtos/task.response.dto';
import { FindTaskQuery } from '../../queries/find-task/find-task.query';
import { TaskMapper } from '../../task.mapper';
import { CreateTaskCommand } from './create-task.command';
import { CreateTaskRequest } from './create-task.request.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('tasks')
export class CreateTaskHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: TaskMapper,
  ) {}

  @Post()
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'Task' })
  @RequireScopes('tasks:write')
  @ApiOperation({
    summary: 'Add a task to the board',
    description:
      'At the end of its column (To do unless `status` says otherwise). Without a project the task is filed under the workspace’s Unassigned project; a goal brings its own project.',
  })
  @ApiResponse({ status: 201, type: TaskResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Goal not found', code: 'TASKS_002' })
  @ApiProblemResponse({
    status: 409,
    description: 'Project archived or missing',
    code: 'TASKS_004',
  })
  @ApiProblemResponse({ status: 409, description: 'Goal of another project', code: 'TASKS_007' })
  async create(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @Body() body: CreateTaskRequest,
  ): Promise<TaskResponseDto> {
    const taskId = await this.commandBus.execute<CreateTaskCommand, string>(
      new CreateTaskCommand({ scope, userId, input: body }),
    );
    const task = await this.queryBus.execute<FindTaskQuery, TaskEntity>(
      new FindTaskQuery({ scope, taskId }),
    );
    return this.mapper.toResponse(task);
  }
}
