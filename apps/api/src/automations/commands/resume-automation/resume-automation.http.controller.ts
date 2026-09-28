import {
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { AutomationMapper } from '../../automation.mapper';
import type { AutomationDetail } from '../../domain/automation-read.types';
import { AutomationResponseDto } from '../../dtos/automation.response.dto';
import { FindAutomationQuery } from '../../queries/find-automation/find-automation.query';
import { ResumeAutomationCommand } from './resume-automation.command';

@ApiTags('Automations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('automations')
export class ResumeAutomationHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: AutomationMapper,
  ) {}

  @Post(':id/resume')
  @Version('1')
  @HttpCode(200)
  @CheckPolicies({ action: 'update', subject: 'Automation' })
  @RequireScopes('automations:write')
  @ApiOperation({
    summary: 'Resume an automation',
    description:
      'Triggers listen again, and each schedule’s next slot is computed from now, so a paused week does not fire a burst of missed runs.',
  })
  @ApiResponse({ status: 200, type: AutomationResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Automation not found', code: 'AUTOMATIONS_001' })
  async handle(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) automationId: string,
  ): Promise<AutomationResponseDto> {
    const id = await this.commandBus.execute<ResumeAutomationCommand, string>(
      new ResumeAutomationCommand({ scope, automationId }),
    );
    const detail = await this.queryBus.execute<FindAutomationQuery, AutomationDetail>(
      new FindAutomationQuery({ scope, automationId: id }),
    );
    return this.mapper.toResponse(detail.automation, scope.userId, detail.digest);
  }
}
