import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
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
import { TaskMapper } from '../../task.mapper';
import { FindTaskQuery } from './find-task.query';

@ApiTags('Tasks')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('tasks')
export class FindTaskHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: TaskMapper,
  ) {}

  @Get(':id')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Task' })
  @RequireScopes('tasks:read')
  @ApiOperation({ summary: 'Read one task, with the sessions on it' })
  @ApiResponse({ status: 200, type: TaskResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Task not found', code: 'TASKS_001' })
  async find(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TaskResponseDto> {
    const task = await this.queryBus.execute<FindTaskQuery, TaskEntity>(
      new FindTaskQuery({ scope, taskId: id }),
    );
    return this.mapper.toResponse(task);
  }
}
