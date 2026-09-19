import { Controller, Get, Query, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { Paginated } from '@oppenheimer/backend-ddd';
import { SESSION_STATES } from '@oppenheimer/shared';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { WorkSessionEntity } from '../../domain/work-session.entity';
import { PaginatedSessionsResponseDto } from '../../dtos/session.response.dto';
import { WorkSessionMapper } from '../../work-session.mapper';
import { FindSessionsQuery } from './find-sessions.query';
import { FindSessionsRequest } from './find-sessions.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class FindSessionsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: WorkSessionMapper,
  ) {}

  @Get()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Session' })
  @RequireScopes('sessions:read')
  @ApiOperation({
    // Named explicitly: the generated client turns an operationId into a function
    // name, and `list` would collide with every other resource's listing.
    operationId: 'listSessions',
    summary: 'List the sessions in the caller’s workspace',
    description:
      'Newest first. Each session’s `state` is the derived group the sidebar shows; `lifecycle` is the stored fold of its log.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Sessions per page' })
  @ApiQuery({
    name: 'projectId',
    required: false,
    type: String,
    description: 'One project’s sessions',
  })
  @ApiQuery({ name: 'hostId', required: false, type: String, description: 'One host’s sessions' })
  @ApiQuery({
    name: 'state',
    required: false,
    enum: SESSION_STATES,
    description: 'The stored lifecycle, not the derived group.',
  })
  @ApiResponse({ status: 200, type: PaginatedSessionsResponseDto })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Query() query: FindSessionsRequest,
  ): Promise<PaginatedSessionsResponseDto> {
    const result = await this.queryBus.execute<FindSessionsQuery, Paginated<WorkSessionEntity>>(
      new FindSessionsQuery({ scope, ...query }),
    );
    const now = new Date();
    return {
      data: result.data.map((session) => this.mapper.toResponse(session, now)),
      meta: {
        total: result.count,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.count / result.limit),
      },
    };
  }
}
