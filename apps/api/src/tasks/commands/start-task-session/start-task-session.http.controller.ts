import {
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { SessionCommandResult } from '../../../sessions/domain/session-command.types';
import type { TaskEntity } from '../../domain/task.entity';
import { StartTaskSessionResponseDto } from '../../dtos/task.response.dto';
import { FindTaskQuery } from '../../queries/find-task/find-task.query';
import { TaskMapper } from '../../task.mapper';
import { StartTaskSessionCommand } from './start-task-session.command';
import { StartTaskSessionRequest } from './start-task-session.request.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('tasks')
export class StartTaskSessionHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: TaskMapper,
  ) {}

  @Post(':id/sessions')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Task' }, { action: 'create', subject: 'Session' })
  @RequireScopes('tasks:write', 'sessions:write')
  // The same limit as New session: a session is a checkout and a process on a host.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Start a session from a task',
    description:
      'New session’s body under `session`, filed under the task’s project whatever its `projectId` says. The session is linked to the task as `started`, and a task in Later or To do moves to the top of In progress if `seenStatus` is still its status.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'A retry with the same key returns the session already started.',
  })
  @ApiResponse({ status: 201, type: StartTaskSessionResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Task not found', code: 'TASKS_001' })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  @ApiProblemResponse({ status: 409, description: 'Project archived', code: 'SESSIONS_006' })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async start(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: StartTaskSessionRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<StartTaskSessionResponseDto> {
    const { sessionId, hints } = await this.commandBus.execute<
      StartTaskSessionCommand,
      SessionCommandResult
    >(
      new StartTaskSessionCommand({
        scope,
        userId,
        taskId: id,
        input: body,
        idempotencyKey: idempotencyKey?.trim() || null,
      }),
    );
    const task = await this.queryBus.execute<FindTaskQuery, TaskEntity>(
      new FindTaskQuery({ scope, taskId: id }),
    );
    return { task: this.mapper.toResponse(task), sessionId, hints };
  }
}
