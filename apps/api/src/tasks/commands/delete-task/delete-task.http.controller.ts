import {
  Controller,
  Delete,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { DeleteTaskCommand } from './delete-task.command';

@ApiTags('Tasks')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('tasks')
export class DeleteTaskHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'delete', subject: 'Task' })
  @RequireScopes('tasks:write')
  @ApiOperation({
    summary: 'Delete a task',
    description: 'With its links. The sessions it started or linked are untouched.',
  })
  @ApiResponse({ status: 204 })
  @ApiProblemResponse({ status: 404, description: 'Task not found', code: 'TASKS_001' })
  @ApiProblemResponse({ status: 409, description: 'Changed since it was read', code: 'TASKS_008' })
  @ApiHeader({
    name: 'If-Match',
    required: false,
    description:
      'The version you read; the delete is refused (`TASKS_008`) when it is no longer current.',
  })
  async delete(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('if-match') ifMatch?: string,
  ): Promise<void> {
    await this.commandBus.execute(
      new DeleteTaskCommand({
        scope,
        actor: userActor(userId),
        expectedVersion: versionOf(ifMatch),
        taskId: id,
      }),
    );
  }
}

/** `If-Match: 3` or `If-Match: "3"`; anything else names no version. */
function versionOf(header: string | undefined): number | null {
  const version = Number(header?.trim().replace(/^"|"$/g, ''));
  return Number.isInteger(version) && version >= 1 ? version : null;
}
