import { Controller, Get, Query, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, toPageMeta } from '@oppenheimer/backend-core';
import type { Paginated } from '@oppenheimer/backend-ddd';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { AccessGrantMapper } from '../../authz.mapper';
import { CurrentAccessScope } from '../../decorators/current-access-scope.decorator';
import type { AccessGrantEntity } from '../../domain/access-grant.entity';
import { PaginatedAccessGrantsResponseDto } from '../../dtos/access-grant.response.dto';
import { AccessScopeInterceptor } from '../../interceptors/access-scope.interceptor';
import { FindAccessGrantsQuery } from './find-access-grants.query';
import { FindAccessGrantsRequest } from './find-access-grants.request.dto';

/**
 * Gated by `Role` policies rather than a subject of its own: handing someone
 * access to records is the same kind of privilege transfer as editing a role,
 * so it belongs behind the same permission.
 */
@ApiTags('Access grants')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('access-grants')
export class FindAccessGrantsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: AccessGrantMapper,
  ) {}

  @Get()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Role' })
  @RequireScopes('roles:read')
  @ApiOperation({
    summary: 'List the access grants in the active organization',
    description: 'Newest first, one page at a time (`page`, `limit` up to 100).',
  })
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
  @ApiResponse({ status: 200, type: PaginatedAccessGrantsResponseDto })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Query() query: FindAccessGrantsRequest,
  ): Promise<PaginatedAccessGrantsResponseDto> {
    const result = await this.queryBus.execute<FindAccessGrantsQuery, Paginated<AccessGrantEntity>>(
      new FindAccessGrantsQuery({ scope, page: query.page, limit: query.limit }),
    );
    return {
      data: result.data.map((grant) => this.mapper.toResponse(grant)),
      meta: toPageMeta(result),
    };
  }
}
