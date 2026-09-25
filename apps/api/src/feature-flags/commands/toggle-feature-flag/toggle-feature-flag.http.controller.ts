import { Body, Controller, Param, Patch, UseGuards, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { getFlagDefinition } from '@oppenheimer/shared/feature-flags';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { FeatureFlagResponseDto } from '../../dtos/feature-flag.response.dto';
import { FeatureFlagMapper } from '../../feature-flag.mapper';
import { FindFeatureFlagQuery } from '../../queries/find-feature-flag/find-feature-flag.query';
import type { FeatureFlagView } from '../../queries/find-feature-flags/find-feature-flags.query';
import { ToggleFeatureFlagCommand } from './toggle-feature-flag.command';
import { ToggleFeatureFlagRequest } from './toggle-feature-flag.request.dto';

@ApiTags('Feature flags')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('feature-flags')
export class ToggleFeatureFlagHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: FeatureFlagMapper,
  ) {}

  @Patch('admin/:key')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'FeatureFlag' })
  @RequireScopes('flags:write')
  @ApiOperation({
    summary: 'Switch a feature flag on or off',
    description:
      'Flips the master switch only. Off serves `false` (or the default variant) to everyone — the kill switch. Takes effect on this replica immediately and on every other within the snapshot poll interval.',
  })
  @ApiResponse({ status: 200, type: FeatureFlagResponseDto })
  @ApiProblemResponse({ status: 404, description: 'No such flag in the catalog', code: 'FLAG_001' })
  async toggleFeatureFlag(
    @Param('key') key: string,
    @Body() body: ToggleFeatureFlagRequest,
    @CurrentUser() actor: { id: string },
  ): Promise<FeatureFlagResponseDto> {
    await this.commandBus.execute(
      new ToggleFeatureFlagCommand({ key, ...body, actorId: actor.id }),
    );
    const view = await this.queryBus.execute<FindFeatureFlagQuery, FeatureFlagView>(
      new FindFeatureFlagQuery(key),
    );
    return this.mapper.toFlagResponse(view.key, getFlagDefinition(view.key), view.entity);
  }
}
