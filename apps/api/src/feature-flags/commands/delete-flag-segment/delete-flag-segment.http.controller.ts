import { Controller, Delete, HttpCode, Param, Query, UseGuards, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { DeleteFlagSegmentCommand } from './delete-flag-segment.command';
import { DeleteFlagSegmentRequest } from './delete-flag-segment.request.dto';

@ApiTags('Feature flags')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('feature-flags')
export class DeleteFlagSegmentHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete('segments/:key')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'update', subject: 'FeatureFlag' })
  @RequireScopes('flags:write')
  @ApiOperation({ summary: 'Delete a flag segment no flag targets' })
  @ApiQuery({
    name: 'comment',
    required: false,
    type: String,
    description: 'Why, for the audit trail',
  })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiProblemResponse({ status: 404, description: 'Segment not found', code: 'FLAG_004' })
  @ApiProblemResponse({ status: 409, description: 'Still targeted by a flag', code: 'FLAG_006' })
  async deleteFlagSegment(
    @Param('key') key: string,
    @Query() query: DeleteFlagSegmentRequest,
    @CurrentUser() actor: { id: string },
  ): Promise<void> {
    await this.commandBus.execute(
      new DeleteFlagSegmentCommand({ key, comment: query.comment, actorId: actor.id }),
    );
  }
}
