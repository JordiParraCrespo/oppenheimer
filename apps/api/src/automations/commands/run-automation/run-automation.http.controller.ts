import {
  Controller,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { AutomationRunMapper } from '../../automation-run.mapper';
import type { RunReadModel } from '../../domain/automation-read.types';
import { AutomationRunResponseDto } from '../../dtos/automation-run.response.dto';
import { FindAutomationRunQuery } from '../../queries/find-automation-run/find-automation-run.query';
import { RunAutomationCommand } from './run-automation.command';

@ApiTags('Automations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('automations')
export class RunAutomationHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: AutomationRunMapper,
  ) {}

  @Post(':id/run')
  @Version('1')
  @HttpCode(201)
  @CheckPolicies({ action: 'update', subject: 'Automation' })
  @RequireScopes('automations:write')
  @ApiOperation({
    operationId: 'runAutomation',
    summary: 'Run an automation now',
    description:
      'Queues a run that starts a session as the automation’s owner, whether or not it is paused. The run comes back queued; its session follows within seconds.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'A retried Run now is the same run.',
  })
  @ApiResponse({ status: 201, type: AutomationRunResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Automation not found', code: 'AUTOMATIONS_001' })
  async run(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) automationId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<AutomationRunResponseDto> {
    const runId = await this.commandBus.execute<RunAutomationCommand, string>(
      new RunAutomationCommand({ scope, automationId, idempotencyKey: idempotencyKey ?? null }),
    );
    const run = await this.queryBus.execute<FindAutomationRunQuery, RunReadModel>(
      new FindAutomationRunQuery({ scope, runId }),
    );
    return this.mapper.toResponse(run);
  }
}
