import { Body, Controller, Param, Put, UseGuards, Version } from '@nestjs/common';
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
import { UpdateFeatureFlagCommand } from './update-feature-flag.command';
import { UpdateFeatureFlagRequest } from './update-feature-flag.request.dto';

@ApiTags('Feature flags')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('feature-flags')
export class UpdateFeatureFlagHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: FeatureFlagMapper,
  ) {}

  @Put('admin/:key')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'FeatureFlag' })
  @RequireScopes('flags:write')
  @ApiOperation({
    summary: 'Replace a feature flag’s targeting',
    description:
      'Sets the master switch, the ordered rules and the fallthrough in one write. Recorded on the audit trail with the optional comment.',
  })
  @ApiResponse({ status: 200, type: FeatureFlagResponseDto })
  @ApiProblemResponse({ status: 404, description: 'No such flag in the catalog', code: 'FLAG_001' })
  @ApiProblemResponse({
    status: 422,
    description: 'Targeting serves a value the flag does not take, or targets a missing segment',
    code: 'FLAG_002',
  })
  async updateFeatureFlag(
    @Param('key') key: string,
    @Body() body: UpdateFeatureFlagRequest,
    @CurrentUser() actor: { id: string },
  ): Promise<FeatureFlagResponseDto> {
    await this.commandBus.execute(
      new UpdateFeatureFlagCommand({ key, ...body, actorId: actor.id }),
    );
    const view = await this.queryBus.execute<FindFeatureFlagQuery, FeatureFlagView>(
      new FindFeatureFlagQuery(key),
    );
    return this.mapper.toFlagResponse(view.key, getFlagDefinition(view.key), view.entity);
  }
}
