import { Controller, Get, Query, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { Paginated } from '@oppenheimer/backend-ddd';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import type { UserEntity } from '../../domain/user.entity';
import { PaginatedUsersResponseDto } from '../../dtos/paginated-users.response.dto';
import { UserMapper } from '../../user.mapper';
import { FindUsersQuery } from './find-users.query';
import { FindUsersRequest } from './find-users.request.dto';

@ApiTags('Users')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('users')
export class FindUsersHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: UserMapper,
  ) {}

  @Get()
  @Version('1')
  // `manage User`, not `read User`: this returns the whole directory — every
  // account's email address — and the default role's `read User` is scoped to
  // the caller's own record, which a paginated list cannot honour without
  // returning pages that are mostly holes. Administering the directory is an
  // admin capability, the same one `PUT /v1/users/:userId/roles` requires.
  // A non-admin browsing people wants an organization-scoped members endpoint
  // (`GET /v1/organizations/:orgId/members`), not the global user table.
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @RequireScopes('users:read')
  @ApiOperation({ summary: 'List all users (admin)' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    type: String,
    description: 'Filter by role name',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by name or email',
  })
  @ApiResponse({ status: 200, type: PaginatedUsersResponseDto })
  async findAll(@Query() query: FindUsersRequest): Promise<PaginatedUsersResponseDto> {
    const result = await this.queryBus.execute<FindUsersQuery, Paginated<UserEntity>>(
      new FindUsersQuery(query),
    );

    return {
      data: result.data.map((user) => this.mapper.toResponse(user)),
      meta: {
        total: result.count,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.count / result.limit),
      },
    };
  }
}
