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
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { RunAutomationCommand } from '../run-automation/run-automation.command';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class RunBotRoutineHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/routines/:routineId/run')
  @Version('1')
  @HttpCode(202)
  @CheckPolicies({ action: 'update', subject: 'Automation' })
  @RequireScopes('automations:write')
  @ApiOperation({
    summary: 'Run a bot’s routine now',
    description:
      'Queues one run, paused or not: a turn of the bot opened by the routine, as its owner. The routine reads running until that turn ends.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'A retried Run now is the same run.',
  })
  @ApiResponse({ status: 202 })
  @ApiProblemResponse({ status: 404, description: 'Routine not found', code: 'AUTOMATIONS_001' })
  async run(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Param('routineId', new ParseUUIDPipe()) routineId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<void> {
    await this.commandBus.execute<RunAutomationCommand, string>(
      new RunAutomationCommand({
        scope,
        automationId: routineId,
        botId,
        idempotencyKey: idempotencyKey ?? null,
      }),
    );
  }
}
