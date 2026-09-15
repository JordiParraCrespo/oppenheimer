import { Controller, Get, Param, ParseUUIDPipe, Req, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { activeOrganizationIdOf, type ScopedRequest } from '../../../auth/scope-context';
import type { RoleEntity } from '../../domain/role.entity';
import { RoleResponseDto } from '../../dtos/role.response.dto';
import { RoleMapper } from '../../roles.mapper';
import { FindUserRolesQuery } from './find-user-roles.query';

@ApiTags('Roles')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('users')
export class FindUserRolesHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: RoleMapper,
  ) {}

  @Get(':userId/roles')
  @Version('1')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @RequireScopes('roles:read')
  @ApiOperation({ summary: "List a user's assigned roles" })
  @ApiResponse({ status: 200, type: [RoleResponseDto] })
  async findUserRoles(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() request: ScopedRequest,
  ): Promise<RoleResponseDto[]> {
    const roles = await this.queryBus.execute<FindUserRolesQuery, RoleEntity[]>(
      new FindUserRolesQuery(userId, activeOrganizationIdOf(request)),
    );
    return roles.map((role) => this.mapper.toResponse(role));
  }
}
