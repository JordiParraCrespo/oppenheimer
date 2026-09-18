import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import {
  activeOrganizationIdOf,
  type ScopedRequest,
} from '../../../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import type { RoleEntity } from '../../domain/role.entity';
import { RoleResponseDto } from '../../dtos/role.response.dto';
import { FindRoleByIdQuery } from '../../queries/find-role-by-id/find-role-by-id.query';
import { RoleMapper } from '../../roles.mapper';
import { UpdateRolePermissionsCommand } from './update-role-permissions.command';
import { UpdateRolePermissionsRequest } from './update-role-permissions.request.dto';

@ApiTags('Roles')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('roles')
export class UpdateRolePermissionsHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: RoleMapper,
  ) {}

  @Put(':id/permissions')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Role' })
  @RequireScopes('roles:write')
  @ApiOperation({ summary: "Replace a role's permission set" })
  @ApiResponse({ status: 200, type: RoleResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Role not found', code: 'ROLE_001' })
  async updatePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRolePermissionsRequest,
    @CurrentUser() actor: { id: string; role?: string },
    @Req() request: ScopedRequest,
  ): Promise<RoleResponseDto> {
    const roleId = await this.commandBus.execute<UpdateRolePermissionsCommand, AggregateID>(
      new UpdateRolePermissionsCommand({
        roleId: id,
        permissions: body.permissions,
        actorId: actor.id,
        actorRole: actor.role,
        activeOrganizationId: activeOrganizationIdOf(request),
      }),
    );
    const role = await this.queryBus.execute<FindRoleByIdQuery, RoleEntity>(
      new FindRoleByIdQuery(roleId, activeOrganizationIdOf(request)),
    );
    return this.mapper.toResponse(role);
  }
}
