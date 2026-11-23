import {
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { RevokeRoutineWebhookCommand } from './revoke-routine-webhook.command';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class RevokeRoutineWebhookHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id/routines/:routineId/webhook')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'update', subject: 'Automation' })
  @RequireScopes('automations:write')
  @ApiOperation({
    summary: 'Revoke a routine’s webhook URL',
    description:
      'Posts to it are refused from now on. The routine keeps its webhook trigger; issue a new URL to use it again.',
  })
  @ApiResponse({ status: 204 })
  @ApiProblemResponse({ status: 404, description: 'Routine not found', code: 'AUTOMATIONS_001' })
  async revoke(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Param('routineId', new ParseUUIDPipe()) routineId: string,
  ): Promise<void> {
    await this.commandBus.execute<RevokeRoutineWebhookCommand, void>(
      new RevokeRoutineWebhookCommand({ scope, botId, routineId }),
    );
  }
}
