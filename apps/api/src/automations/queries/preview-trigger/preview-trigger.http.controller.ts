import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { AutomationRunMapper } from '../../automation-run.mapper';
import type { TriggerPreview } from '../../domain/automation-read.types';
import { TriggerPreviewResponseDto } from '../../dtos/automation-run.response.dto';
import { PreviewTriggerQuery } from './preview-trigger.query';
import { PreviewTriggerRequest } from './preview-trigger.request.dto';

@ApiTags('Automations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('automations')
export class PreviewTriggerHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: AutomationRunMapper,
  ) {}

  @Post('trigger-preview')
  @Version('1')
  @HttpCode(200)
  @CheckPolicies({ action: 'read', subject: 'Automation' })
  @RequireScopes('automations:read')
  @ApiOperation({
    summary: 'Replay a GitHub trigger against recent events',
    description:
      '“Would have run N times in the last 7 days”: the card, unsaved, matched against what the webhook actually received, with the two most recent matches. A POST because the card is a body, not because anything changes.',
  })
  @ApiResponse({ status: 200, type: TriggerPreviewResponseDto })
  async preview(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: PreviewTriggerRequest,
  ): Promise<TriggerPreviewResponseDto> {
    const preview = await this.queryBus.execute<PreviewTriggerQuery, TriggerPreview>(
      new PreviewTriggerQuery({ scope, input: body }),
    );
    return {
      count: preview.count,
      days: preview.days,
      matches: preview.matches.map((event) => this.mapper.toPreviewMatch(event)),
    };
  }
}
