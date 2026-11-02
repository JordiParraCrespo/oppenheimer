import { Controller, Get, Param, Query, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { FlagEvaluation } from '@oppenheimer/shared/feature-flags';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { FlagEvaluationResponseDto } from '../../dtos/feature-flag.response.dto';
import { FeatureFlagMapper } from '../../feature-flag.mapper';
import { EvaluateFeatureFlagQuery } from './evaluate-feature-flag.query';
import { EvaluateFeatureFlagRequest } from './evaluate-feature-flag.request.dto';

@ApiTags('Feature flags')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('feature-flags')
export class EvaluateFeatureFlagHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: FeatureFlagMapper,
  ) {}

  @Get('admin/:key/evaluate')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'FeatureFlag' })
  @RequireScopes('flags:read')
  @ApiOperation({
    summary: 'Explain a flag for a given context',
    description:
      'Evaluates the flag for the user, organization, platform and build described in the query — what they would get, and why.',
  })
  @ApiResponse({ status: 200, type: FlagEvaluationResponseDto })
  @ApiProblemResponse({ status: 404, description: 'No such flag in the catalog', code: 'FLAG_001' })
  async evaluateFeatureFlag(
    @Param('key') key: string,
    @Query() context: EvaluateFeatureFlagRequest,
  ): Promise<FlagEvaluationResponseDto> {
    const evaluation = await this.queryBus.execute<EvaluateFeatureFlagQuery, FlagEvaluation>(
      new EvaluateFeatureFlagQuery(key, context),
    );
    return this.mapper.toEvaluationResponse(evaluation);
  }
}
