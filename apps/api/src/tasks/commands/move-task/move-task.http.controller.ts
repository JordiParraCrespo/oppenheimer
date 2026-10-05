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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { TaskEntity } from '../../domain/task.entity';
import { TaskResponseDto } from '../../dtos/task.response.dto';
import { FindTaskQuery } from '../../queries/find-task/find-task.query';
import { TaskMapper } from '../../task.mapper';
import { MoveTaskCommand } from './move-task.command';
import { MoveTaskRequest } from './move-task.request.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('tasks')
export class MoveTaskHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: TaskMapper,
  ) {}

  @Post(':id/move')
  @Version('1')
  @HttpCode(200)
  @CheckPolicies({ action: 'update', subject: 'Task' })
  @RequireScopes('tasks:write')
  @ApiOperation({
    summary: 'Move a task on the board',
    description:
      'Into `status`, directly after `afterTaskId` (a task of that column), or first when it is null. Only this task’s place changes; the column is never renumbered.',
  })
  @ApiResponse({ status: 200, type: TaskResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Task not found', code: 'TASKS_001' })
  @ApiProblemResponse({ status: 409, description: 'Stale position', code: 'TASKS_006' })
  async move(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MoveTaskRequest,
  ): Promise<TaskResponseDto> {
    await this.commandBus.execute(new MoveTaskCommand({ scope, taskId: id, move: body }));
    const task = await this.queryBus.execute<FindTaskQuery, TaskEntity>(
      new FindTaskQuery({ scope, taskId: id }),
    );
    return this.mapper.toResponse(task);
  }
}
