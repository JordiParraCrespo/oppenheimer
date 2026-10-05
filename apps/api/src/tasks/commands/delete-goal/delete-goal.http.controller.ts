import {
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { DeleteGoalCommand } from './delete-goal.command';

@ApiTags('Tasks')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('goals')
export class DeleteGoalHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'delete', subject: 'Task' })
  @RequireScopes('tasks:write')
  @ApiOperation({ summary: 'Delete a goal', description: 'Its tasks stay, with no goal.' })
  @ApiResponse({ status: 204 })
  @ApiProblemResponse({ status: 404, description: 'Goal not found', code: 'TASKS_002' })
  async delete(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.commandBus.execute(new DeleteGoalCommand({ scope, goalId: id }));
  }
}
