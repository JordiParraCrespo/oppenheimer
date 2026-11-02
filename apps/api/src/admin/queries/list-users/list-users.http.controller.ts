import { Controller, Get, Query, Req, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { AdminProblemResponses } from '../../decorators/admin-problem-responses.decorator';
import { AdminUserListResponseDto } from '../../dtos/admin-user.response.dto';
import { ListUsersQuery } from './list-users.query';

@ApiTags('Admin')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@AdminProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('admin')
export class ListUsersHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('users')
  @Version('1')
  @RequireScopes('admin:read')
  @CheckPolicies({ action: 'manage', subject: 'User' })
  @ApiOperation({ summary: 'List users' })
  @ApiQuery({ name: 'searchValue', required: false })
  @ApiQuery({ name: 'searchField', required: false, enum: ['email', 'name'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortDirection', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, type: AdminUserListResponseDto })
  listUsers(
    @Req() req: Request,
    @Query('searchValue') searchValue?: string,
    @Query('searchField') searchField?: 'email' | 'name',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDirection') sortDirection?: 'asc' | 'desc',
  ): Promise<AdminUserListResponseDto> {
    return this.queryBus.execute<ListUsersQuery, AdminUserListResponseDto>(
      new ListUsersQuery({
        headers: req.headers,
        filters: {
          searchValue,
          searchField,
          limit: limit ? Number(limit) : undefined,
          offset: offset ? Number(offset) : undefined,
          sortBy,
          sortDirection,
        },
      }),
    );
  }
}
