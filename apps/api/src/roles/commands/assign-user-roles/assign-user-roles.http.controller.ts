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
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { activeOrganizationIdOf, type ScopedRequest } from '../../../auth/scope-context';
import type { RoleEntity } from '../../domain/role.entity';
import { RoleResponseDto } from '../../dtos/role.response.dto';
import { FindUserRolesQuery } from '../../queries/find-user-roles/find-user-roles.query';
import { RoleMapper } from '../../roles.mapper';
import { AssignUserRolesCommand } from './assign-user-roles.command';
import { AssignUserRolesRequest } from './assign-user-roles.request.dto';

@ApiTags('Roles')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('users')
export class AssignUserRolesHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: RoleMapper,
  ) {}

  @Put(':userId/roles')
  @Version('1')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @RequireScopes('roles:write')
  @ApiOperation({ summary: "Replace a user's assigned roles" })
  @ApiResponse({ status: 200, type: [RoleResponseDto] })
  @ApiProblemResponse({
    status: 404,
    description: 'User or role not found',
    code: ['USER_001', 'ROLE_001'],
  })
  @ApiProblemResponse({
    status: 403,
    description: 'Assigning a role that grants more than the caller holds',
    code: 'ROLE_005',
  })
  async assign(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: AssignUserRolesRequest,
    @CurrentUser() actor: { id: string; role?: string },
    @Req() request: ScopedRequest,
  ): Promise<RoleResponseDto[]> {
    const activeOrganizationId = activeOrganizationIdOf(request);
    await this.commandBus.execute<AssignUserRolesCommand, void>(
      new AssignUserRolesCommand({
        userId,
        roleIds: body.roleIds,
        activeOrganizationId,
        actorId: actor.id,
        actorRole: actor.role,
      }),
    );
    const roles = await this.queryBus.execute<FindUserRolesQuery, RoleEntity[]>(
      new FindUserRolesQuery(userId, activeOrganizationId),
    );
    return roles.map((role) => this.mapper.toResponse(role));
  }
}
