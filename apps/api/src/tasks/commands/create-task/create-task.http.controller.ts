import {
  Body,
  Controller,
  Headers,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { IDEMPOTENCY_KEY_MAX } from '@oppenheimer/shared';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { userActor } from '../../domain/plan-change.types';
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
      'At the end of its column (To do unless `status` says otherwise). Without a project the task is filed under the workspace’s Unassigned project; a milestone brings its own project.',
  })
  @ApiResponse({ status: 201, type: TaskResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Milestone not found', code: 'TASKS_002' })
  @ApiProblemResponse({
    status: 409,
    description: 'Project archived or missing',
    code: 'TASKS_004',
  })
  @ApiProblemResponse({
    status: 409,
    description: 'Milestone of another project',
    code: 'TASKS_007',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Up to 128 characters. A retried request with the same key answers the row the first one made.',
  })
  async create(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @Body() body: CreateTaskRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<TaskResponseDto> {
    const taskId = await this.commandBus.execute<CreateTaskCommand, string>(
      new CreateTaskCommand({
        scope,
        actor: userActor(userId),
        idempotencyKey: idempotencyKey?.trim().slice(0, IDEMPOTENCY_KEY_MAX) || null,
        userId,
        input: body,
      }),
    );
    const task = await this.queryBus.execute<FindTaskQuery, TaskEntity>(
      new FindTaskQuery({ scope, taskId }),
    );
    return this.mapper.toResponse(task);
  }
}
