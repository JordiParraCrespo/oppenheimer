import { Controller, Get, Query, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { Paginated } from '@oppenheimer/backend-ddd';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import type { FlagChangeRecord } from '../../database/flag-change.repository.port';
import { PaginatedFlagChangesResponseDto } from '../../dtos/flag-change.response.dto';
import { FeatureFlagMapper } from '../../feature-flag.mapper';
import { FindFlagChangesQuery } from './find-flag-changes.query';
import { FindFlagChangesRequest } from './find-flag-changes.request.dto';

@ApiTags('Feature flags')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('feature-flags')
export class FindFlagChangesHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: FeatureFlagMapper,
  ) {}

  @Get('changes')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'FeatureFlag' })
  @RequireScopes('flags:read')
  @ApiOperation({
    summary: 'Feature flag audit trail',
    description: 'Who changed which flag or segment, when, why, and what it was before and after.',
  })
  @ApiQuery({ name: 'subjectType', required: false, enum: ['flag', 'segment'] })
  @ApiQuery({ name: 'subjectKey', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, type: PaginatedFlagChangesResponseDto })
  async findFlagChanges(
    @Query() query: FindFlagChangesRequest,
  ): Promise<PaginatedFlagChangesResponseDto> {
    const result = await this.queryBus.execute<FindFlagChangesQuery, Paginated<FlagChangeRecord>>(
      new FindFlagChangesQuery(query),
    );
    return {
      data: result.data.map((change) => this.mapper.toChangeResponse(change)),
      meta: {
        total: result.count,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.count / result.limit),
      },
    };
  }
}
