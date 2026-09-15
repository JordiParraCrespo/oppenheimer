import { Controller, Get, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { AccessGrantMapper } from '../../authz.mapper';
import { CurrentAccessScope } from '../../decorators/current-access-scope.decorator';
import type { AccessGrantEntity } from '../../domain/access-grant.entity';
import { AccessGrantResponseDto } from '../../dtos/access-grant.response.dto';
import { AccessScopeInterceptor } from '../../interceptors/access-scope.interceptor';
import { FindAccessGrantsQuery } from './find-access-grants.query';

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
  @ApiOperation({ summary: 'List the access grants in the active organization' })
  @ApiResponse({ status: 200, type: [AccessGrantResponseDto] })
  async list(@CurrentAccessScope() scope: AccessScope): Promise<AccessGrantResponseDto[]> {
    const grants = await this.queryBus.execute<FindAccessGrantsQuery, AccessGrantEntity[]>(
      new FindAccessGrantsQuery({ scope }),
    );
    return grants.map((grant) => this.mapper.toResponse(grant));
  }
}
