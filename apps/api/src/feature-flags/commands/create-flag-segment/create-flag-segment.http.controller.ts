import { Body, Controller, HttpCode, Post, UseGuards, Version } from '@nestjs/common';
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
import { CreateFlagSegmentCommand } from './create-flag-segment.command';
import { CreateFlagSegmentRequest } from './create-flag-segment.request.dto';

@ApiTags('Feature flags')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('feature-flags')
export class CreateFlagSegmentHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: FlagSegmentMapper,
  ) {}

  @Post('segments')
  @Version('1')
  @HttpCode(201)
  @CheckPolicies({ action: 'update', subject: 'FeatureFlag' })
  @RequireScopes('flags:write')
  @ApiOperation({ summary: 'Create a flag segment' })
  @ApiResponse({ status: 201, type: FlagSegmentResponseDto })
  @ApiProblemResponse({ status: 409, description: 'Segment key taken', code: 'FLAG_005' })
  @ApiProblemResponse({ status: 422, description: 'Invalid segment conditions', code: 'FLAG_007' })
  async createFlagSegment(
    @Body() body: CreateFlagSegmentRequest,
    @CurrentUser() actor: { id: string },
  ): Promise<FlagSegmentResponseDto> {
    await this.commandBus.execute(new CreateFlagSegmentCommand({ ...body, actorId: actor.id }));
    const [view] = await this.queryBus.execute<FindFlagSegmentsQuery, FlagSegmentView[]>(
      new FindFlagSegmentsQuery(body.key),
    );
    // Only a delete racing this request between the write and the read leaves nothing.
    if (!view) throw new AppError(FeatureFlagErrors.SEGMENT_NOT_FOUND);
    return this.mapper.toResponse(view.entity, view.usedBy);
  }
}
