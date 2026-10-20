import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { SaveBotRoutineCommand } from '../save-bot-routine/save-bot-routine.command';
import { UpdateBotRoutineRequest } from './update-bot-routine.request.dto';

@ApiTags('Bots')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('bots')
export class UpdateBotRoutineHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Patch(':id/routines/:routineId')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'update', subject: 'Automation' })
  @RequireScopes('automations:write')
  @ApiOperation({
    summary: 'Turn a bot’s routine on or off',
    description:
      'The Routines tab’s switch: off pauses its triggers, on resumes them from now. What a routine does is changed in the bot’s chat, through its own tool.',
  })
  @ApiResponse({ status: 204 })
  @ApiProblemResponse({ status: 404, description: 'Routine not found', code: 'AUTOMATIONS_001' })
  async update(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', new ParseUUIDPipe()) botId: string,
    @Param('routineId', new ParseUUIDPipe()) routineId: string,
    @Body() body: UpdateBotRoutineRequest,
  ): Promise<void> {
    await this.commandBus.execute<SaveBotRoutineCommand, string>(
      // A switch changes neither what runs nor when, so it keeps the routine's scopes.
      new SaveBotRoutineCommand({
        scope,
        botId,
        routineId,
        changes: { enabled: body.enabled },
        credentialScopes: null,
      }),
    );
  }
}
