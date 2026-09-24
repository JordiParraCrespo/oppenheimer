import { Controller, Get, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { FlagSegmentResponseDto } from '../../dtos/flag-segment.response.dto';
import { FlagSegmentMapper } from '../../flag-segment.mapper';
import { FindFlagSegmentsQuery, type FlagSegmentView } from './find-flag-segments.query';

@ApiTags('Feature flags')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('feature-flags')
export class FindFlagSegmentsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: FlagSegmentMapper,
  ) {}

  @Get('segments')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'FeatureFlag' })
  @RequireScopes('flags:read')
  @ApiOperation({ summary: 'List flag segments and the flags that target them' })
  @ApiResponse({ status: 200, type: [FlagSegmentResponseDto] })
  async findFlagSegments(): Promise<FlagSegmentResponseDto[]> {
    const views = await this.queryBus.execute<FindFlagSegmentsQuery, FlagSegmentView[]>(
      new FindFlagSegmentsQuery(),
    );
    return views.map(({ entity, usedBy }) => this.mapper.toResponse(entity, usedBy));
  }
}
