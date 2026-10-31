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
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { userActor } from '../../domain/plan-change.types';
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
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<TaskResponseDto> {
    await this.commandBus.execute(
      new UnlinkTaskSessionCommand({ scope, actor: userActor(userId), taskId: id, sessionId }),
    );
    const task = await this.queryBus.execute<FindTaskQuery, TaskEntity>(
      new FindTaskQuery({ scope, taskId: id }),
    );
    return this.mapper.toResponse(task);
  }
}
