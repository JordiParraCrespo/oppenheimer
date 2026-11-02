import { Controller, Get, Header, Query, Req, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ClientFeatureFlags } from '@oppenheimer/shared/feature-flags';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { AllowAnyScope } from '../../../auth/decorators/require-scopes.decorator';
import type { ScopedRequest } from '../../../auth/domain/scope-context.types';
import { OptionalApiAuthGuard } from '../../../auth/guards/optional-api-auth.guard';
import { flagContextOf } from '../../application/flag-context.resolver';
import { ClientFeatureFlagsResponseDto } from '../../dtos/feature-flag.response.dto';
import { GetClientFeatureFlagsQuery } from './get-client-feature-flags.query';
import { GetClientFeatureFlagsRequest } from './get-client-feature-flags.request.dto';

@ApiTags('Feature flags')
@UseGuards(OptionalApiAuthGuard)
@Controller('feature-flags')
export class GetClientFeatureFlagsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @Version('1')
  @NoPolicy('the caller’s own flag values; anonymous callers get theirs too')
  // Nothing here but answers about the caller, which a signed-out visitor
  // already gets — so a scoped credential may read it whatever its scopes.
  @AllowAnyScope()
  // Personal (a rollout can bucket by user), and changes without a deploy.
  @Header('Cache-Control', 'private, no-cache')
  @ApiOperation({
    summary: 'The caller’s feature flags',
    description:
      'Every client-visible flag, evaluated for the caller: their user, their active organization, and the platform and build the client reports. Values only — targeting rules never leave the server. Works signed out.',
  })
  @ApiQuery({ name: 'platform', required: false, enum: ['web', 'ios', 'android'] })
  @ApiQuery({
    name: 'appVersion',
    required: false,
    type: String,
    description: 'Client build, semver',
  })
  @ApiResponse({ status: 200, type: ClientFeatureFlagsResponseDto })
  getClientFeatureFlags(
    @Query() query: GetClientFeatureFlagsRequest,
    @Req() request: ScopedRequest,
  ): Promise<ClientFeatureFlags> {
    return this.queryBus.execute(new GetClientFeatureFlagsQuery(flagContextOf(request, query)));
  }
}
