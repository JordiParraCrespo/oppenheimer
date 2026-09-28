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
import { PauseAutomationCommand } from './pause-automation.command';

@ApiTags('Automations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('automations')
export class PauseAutomationHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: AutomationMapper,
  ) {}

  @Post(':id/pause')
  @Version('1')
  @HttpCode(200)
  @CheckPolicies({ action: 'update', subject: 'Automation' })
  @RequireScopes('automations:write')
  @ApiOperation({
    operationId: 'pauseAutomation',
    summary: 'Pause an automation',
    description:
      'Triggers are ignored until it is resumed; Run now still works. Its schedule stops firing now.',
  })
  @ApiResponse({ status: 200, type: AutomationResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Automation not found', code: 'AUTOMATIONS_001' })
  async handle(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) automationId: string,
  ): Promise<AutomationResponseDto> {
    const id = await this.commandBus.execute<PauseAutomationCommand, string>(
      new PauseAutomationCommand({ scope, automationId }),
    );
    const detail = await this.queryBus.execute<FindAutomationQuery, AutomationDetail>(
      new FindAutomationQuery({ scope, automationId: id }),
    );
    return this.mapper.toResponse(detail.automation, scope.userId, detail.digest);
  }
}
