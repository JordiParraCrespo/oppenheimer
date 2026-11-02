import { Controller, Get, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { getFlagDefinition } from '@oppenheimer/shared/feature-flags';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { FeatureFlagResponseDto } from '../../dtos/feature-flag.response.dto';
import { FeatureFlagMapper } from '../../feature-flag.mapper';
import { type FeatureFlagView, FindFeatureFlagsQuery } from './find-feature-flags.query';

@ApiTags('Feature flags')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('feature-flags')
export class FindFeatureFlagsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: FeatureFlagMapper,
  ) {}

  @Get('admin')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'FeatureFlag' })
  @RequireScopes('flags:read')
  @ApiOperation({
    summary: 'List feature flags with their targeting',
    description:
      'Every flag the code declares, with its catalog definition and — once saved — its targeting on this deployment.',
  })
  @ApiResponse({ status: 200, type: [FeatureFlagResponseDto] })
  async findFeatureFlags(): Promise<FeatureFlagResponseDto[]> {
    const views = await this.queryBus.execute<FindFeatureFlagsQuery, FeatureFlagView[]>(
      new FindFeatureFlagsQuery(),
    );
    return views.map(({ key, entity }) =>
      this.mapper.toFlagResponse(key, getFlagDefinition(key), entity),
    );
  }
}
