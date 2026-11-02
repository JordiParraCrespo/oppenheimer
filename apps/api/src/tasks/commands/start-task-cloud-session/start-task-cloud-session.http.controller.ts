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
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { SessionCommandResult } from '../../../sessions/domain/session-command.types';
import { userActor } from '../../domain/plan-change.types';
import type { TaskEntity } from '../../domain/task.entity';
import { StartTaskSessionResponseDto } from '../../dtos/task.response.dto';
import { FindTaskQuery } from '../../queries/find-task/find-task.query';
import { TaskMapper } from '../../task.mapper';
import { StartTaskSessionCommand } from '../start-task-session/start-task-session.command';
import { StartTaskCloudSessionRequest } from './start-task-cloud-session.request.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('tasks')
export class StartTaskCloudSessionHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: TaskMapper,
  ) {}

  @Post(':id/sessions/cloud')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Task' }, { action: 'create', subject: 'Session' })
  @RequireScopes('tasks:write', 'sessions:write')
  // The same limit as a cloud session from New session: each is a run billed to the caller's plan.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Start a cloud session from a task',
    description:
      '`POST /sessions/cloud`’s body under `cloud`: the vendor’s own agent (Cursor’s) on one repository, on the caller’s key for the vendor, with no host, filed under the task’s project. The session is linked to the task as `started`, and a task in Later or To do moves to the top of In progress if `seenStatus` is still its status.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'A retry with the same key returns the session already started.',
  })
  @ApiResponse({ status: 201, type: StartTaskSessionResponseDto })
  @ApiProblemResponse({
    status: 404,
    description: 'Task not found, or a repository its GitHub installation does not cover',
    code: ['TASKS_001', 'GITHUB_010'],
  })
  @ApiProblemResponse({
    status: 409,
    description: 'Project archived, or no key stored for that provider',
    code: ['SESSIONS_006', 'CLOUD_AGENTS_004'],
  })
  @ApiProblemResponse({
    status: 422,
    description: 'The provider refused the stored key, or the launch as asked',
    code: ['CLOUD_AGENTS_005', 'CLOUD_AGENTS_010'],
  })
  @ApiProblemResponse({
    status: 429,
    description: 'Rate limit',
    code: ['RATE_001', 'CLOUD_AGENTS_007'],
  })
  @ApiProblemResponse({ status: 502, description: 'No answer', code: 'CLOUD_AGENTS_006' })
  async start(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: StartTaskCloudSessionRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<StartTaskSessionResponseDto> {
    const { sessionId, hints } = await this.commandBus.execute<
      StartTaskSessionCommand,
      SessionCommandResult
    >(
      new StartTaskSessionCommand({
        scope,
        actor: userActor(userId),
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
