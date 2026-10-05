import {
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
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
import { UnlinkTaskSessionCommand } from './unlink-task-session.command';

@ApiTags('Tasks')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('tasks')
export class UnlinkTaskSessionHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: TaskMapper,
  ) {}

  @Delete(':id/sessions/:sessionId')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Task' })
  @RequireScopes('tasks:write')
  @ApiOperation({
    summary: 'Take a session off a task',
    description: 'The task stays in its column and the session runs on.',
  })
  @ApiResponse({ status: 200, type: TaskResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Task not found', code: 'TASKS_001' })
  async unlink(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<TaskResponseDto> {
    await this.commandBus.execute(new UnlinkTaskSessionCommand({ scope, taskId: id, sessionId }));
    const task = await this.queryBus.execute<FindTaskQuery, TaskEntity>(
      new FindTaskQuery({ scope, taskId: id }),
    );
    return this.mapper.toResponse(task);
  }
}
