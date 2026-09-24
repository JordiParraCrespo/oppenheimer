import { Body, Controller, Param, Patch, UseGuards, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse, AppError } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { FeatureFlagErrors } from '../../domain/feature-flags.errors';
import { FlagSegmentResponseDto } from '../../dtos/flag-segment.response.dto';
import { FlagSegmentMapper } from '../../flag-segment.mapper';
import {
  FindFlagSegmentsQuery,
  type FlagSegmentView,
} from '../../queries/find-flag-segments/find-flag-segments.query';
import { UpdateFlagSegmentCommand } from './update-flag-segment.command';
import { UpdateFlagSegmentRequest } from './update-flag-segment.request.dto';

@ApiTags('Feature flags')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('feature-flags')
export class UpdateFlagSegmentHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: FlagSegmentMapper,
  ) {}

  @Patch('segments/:key')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'FeatureFlag' })
  @RequireScopes('flags:write')
  @ApiOperation({
    summary: 'Update a flag segment',
    description: 'Every flag that targets the segment follows the change.',
  })
  @ApiResponse({ status: 200, type: FlagSegmentResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Segment not found', code: 'FLAG_004' })
  @ApiProblemResponse({ status: 422, description: 'Invalid segment conditions', code: 'FLAG_007' })
  async updateFlagSegment(
    @Param('key') key: string,
    @Body() body: UpdateFlagSegmentRequest,
    @CurrentUser() actor: { id: string },
  ): Promise<FlagSegmentResponseDto> {
    await this.commandBus.execute(
      new UpdateFlagSegmentCommand({ key, ...body, actorId: actor.id }),
    );
    const [view] = await this.queryBus.execute<FindFlagSegmentsQuery, FlagSegmentView[]>(
      new FindFlagSegmentsQuery(key),
    );
    // Only a delete racing this request between the write and the read leaves nothing.
    if (!view) throw new AppError(FeatureFlagErrors.SEGMENT_NOT_FOUND);
    return this.mapper.toResponse(view.entity, view.usedBy);
  }
}
