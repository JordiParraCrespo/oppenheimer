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
import type { TaskEntity } from '../../domain/task.entity';
import { TaskResponseDto } from '../../dtos/task.response.dto';
import { TaskMapper } from '../../task.mapper';
import { FindTasksQuery } from './find-tasks.query';
import { FindTasksRequest } from './find-tasks.request.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('tasks')
export class FindTasksHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: TaskMapper,
  ) {}

  @Get()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Task' })
  @RequireScopes('tasks:read')
  @ApiOperation({
    summary: 'List the board’s tasks',
    description:
      'In board order: grouped by status, each column by `rank` compared byte by byte. Every filter narrows: a project, a goal, the tasks a session is on, or a range of due dates (the calendar’s layer).',
  })
  @ApiResponse({ status: 200, type: [TaskResponseDto] })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Query() query: FindTasksRequest,
  ): Promise<TaskResponseDto[]> {
    const tasks = await this.queryBus.execute<FindTasksQuery, TaskEntity[]>(
      new FindTasksQuery({ scope, filter: query }),
    );
    return tasks.map((task) => this.mapper.toResponse(task));
  }
}
