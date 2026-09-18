import { Controller, Delete, Param, ParseUUIDPipe, Req, UseGuards, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import {
  activeOrganizationIdOf,
  type ScopedRequest,
} from '../../../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { DeleteRoleCommand } from './delete-role.command';

@ApiTags('Roles')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('roles')
export class DeleteRoleHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id')
  @Version('1')
  @CheckPolicies({ action: 'delete', subject: 'Role' })
  @RequireScopes('roles:write')
  @ApiOperation({ summary: 'Delete role' })
  @ApiResponse({ status: 200 })
  @ApiProblemResponse({
    status: 403,
    description: 'System roles cannot be deleted',
    code: 'ROLE_003',
  })
  @ApiProblemResponse({ status: 404, description: 'Role not found', code: 'ROLE_001' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: { id: string; role?: string },
    @Req() request: ScopedRequest,
  ): Promise<void> {
    await this.commandBus.execute<DeleteRoleCommand, void>(
      new DeleteRoleCommand({
        roleId: id,
        activeOrganizationId: activeOrganizationIdOf(request),
        actorId: actor.id,
        actorRole: actor.role,
      }),
    );
  }
}
