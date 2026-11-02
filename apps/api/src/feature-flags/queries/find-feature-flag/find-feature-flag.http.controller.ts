import { Controller, Get, Param, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { getFlagDefinition } from '@oppenheimer/shared/feature-flags';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { FeatureFlagResponseDto } from '../../dtos/feature-flag.response.dto';
import { FeatureFlagMapper } from '../../feature-flag.mapper';
import type { FeatureFlagView } from '../find-feature-flags/find-feature-flags.query';
import { FindFeatureFlagQuery } from './find-feature-flag.query';

@ApiTags('Feature flags')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('feature-flags')
export class FindFeatureFlagHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: FeatureFlagMapper,
  ) {}

  @Get('admin/:key')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'FeatureFlag' })
  @RequireScopes('flags:read')
  @ApiOperation({ summary: 'Get a feature flag with its targeting' })
  @ApiResponse({ status: 200, type: FeatureFlagResponseDto })
  @ApiProblemResponse({ status: 404, description: 'No such flag in the catalog', code: 'FLAG_001' })
  async findFeatureFlag(@Param('key') key: string): Promise<FeatureFlagResponseDto> {
    const view = await this.queryBus.execute<FindFeatureFlagQuery, FeatureFlagView>(
      new FindFeatureFlagQuery(key),
    );
    return this.mapper.toFlagResponse(view.key, getFlagDefinition(view.key), view.entity);
  }
}
