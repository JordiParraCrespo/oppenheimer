import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { UpdateAutomationCommand } from './update-automation.command';
import { UpdateAutomationRequest } from './update-automation.request.dto';

@ApiTags('Automations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('automations')
export class UpdateAutomationHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: AutomationMapper,
  ) {}

  @Patch(':id')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Automation' })
  @RequireScopes('automations:write')
  @ApiOperation({
    summary: 'Save an automation',
    description:
      'What the editor changed, with the version it loaded. A change to what a run executes becomes the next revision; triggers, when sent, replace the set.',
  })
  @ApiResponse({ status: 200, type: AutomationResponseDto })
  @ApiProblemResponse({
    status: 429,
    description: "GitHub's rate limit was reached; try again after Retry-After",
    code: 'GITHUB_015',
  })
  @ApiProblemResponse({ status: 404, description: 'Automation not found', code: 'AUTOMATIONS_001' })
  @ApiProblemResponse({
    status: 409,
    description: 'The automation was changed by someone else',
    code: 'AUTOMATIONS_003',
  })
  async update(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) automationId: string,
    @Body() body: UpdateAutomationRequest,
  ): Promise<AutomationResponseDto> {
    await this.commandBus.execute<UpdateAutomationCommand, string>(
      new UpdateAutomationCommand({ scope, automationId, input: body }),
    );
    const detail = await this.queryBus.execute<FindAutomationQuery, AutomationDetail>(
      new FindAutomationQuery({ scope, automationId }),
    );
    return this.mapper.toResponse(detail.automation, scope.userId, detail.digest);
  }
}
