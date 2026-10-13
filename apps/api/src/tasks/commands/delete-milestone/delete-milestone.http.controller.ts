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
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { userActor } from '../../domain/plan-change.types';
import { DeleteMilestoneCommand } from './delete-milestone.command';

@ApiTags('Tasks')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('milestones')
export class DeleteMilestoneHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'delete', subject: 'Task' })
  @RequireScopes('tasks:write')
  @ApiOperation({
    summary: 'Delete a milestone',
    description: 'Its tasks stay, with no milestone.',
  })
  @ApiResponse({ status: 204 })
  @ApiProblemResponse({ status: 404, description: 'Milestone not found', code: 'TASKS_002' })
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
      new DeleteMilestoneCommand({
        scope,
        actor: userActor(userId),
        expectedVersion: versionOf(ifMatch),
        milestoneId: id,
      }),
    );
  }
}

/** `If-Match: 3` or `If-Match: "3"`; anything else names no version. */
function versionOf(header: string | undefined): number | null {
  const version = Number(header?.trim().replace(/^"|"$/g, ''));
  return Number.isInteger(version) && version >= 1 ? version : null;
}
