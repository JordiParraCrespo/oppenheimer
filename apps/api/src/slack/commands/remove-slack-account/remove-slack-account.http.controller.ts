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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { RemoveSlackAccountCommand } from './remove-slack-account.command';

@ApiTags('Slack')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('slack')
export class RemoveSlackAccountHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete('accounts/:id')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'delete', subject: 'Slack' })
  @RequireScopes('slack:write')
  @ApiOperation({
    summary: 'Disconnect a bot’s Slack app',
    description:
      'Forgets the app’s token and signing secret, so the bot stops answering in Slack. The app stays in Slack: delete it there to end it. An id that is not one of the caller’s does nothing.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'The connected Slack app.' })
  @ApiResponse({ status: 204 })
  async remove(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.commandBus.execute(new RemoveSlackAccountCommand({ scope, accountId: id }));
  }
}
