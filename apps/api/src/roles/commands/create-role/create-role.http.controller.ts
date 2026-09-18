import { Body, Controller, Post, Req, UseGuards, Version } from '@nestjs/common';
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
import { CreateRoleCommand } from './create-role.command';
import { CreateRoleRequest } from './create-role.request.dto';

@ApiTags('Roles')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('roles')
export class CreateRoleHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: RoleMapper,
  ) {}

  @Post()
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'Role' })
  @RequireScopes('roles:write')
  @ApiOperation({ summary: 'Create role' })
  @ApiResponse({ status: 201, type: RoleResponseDto })
  @ApiProblemResponse({
    status: 409,
    description: 'A role with this name already exists',
    code: 'ROLE_002',
  })
  async create(
    @Body() body: CreateRoleRequest,
    @CurrentUser() actor: { id: string; role?: string },
    @Req() request: ScopedRequest,
  ): Promise<RoleResponseDto> {
    const roleId = await this.commandBus.execute<CreateRoleCommand, AggregateID>(
      new CreateRoleCommand({
        ...body,
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
