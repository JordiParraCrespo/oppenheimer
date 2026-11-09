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
import { RemoveTelegramAccountCommand } from './remove-telegram-account.command';

@ApiTags('Telegram')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('telegram')
export class RemoveTelegramAccountHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete('accounts/:id')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'delete', subject: 'Telegram' })
  @RequireScopes('telegram:write')
  @ApiOperation({
    summary: 'Disconnect a Telegram bot',
    description:
      'Asks the host to stop polling and forget the bot’s token, and forgets the bot and the messages kept for the caller’s bots. An offline host is told when it comes back. The bot stays on Telegram: revoke its token in @BotFather to end it there. An id that is not one of the caller’s does nothing.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'The connected Telegram bot.' })
  @ApiResponse({ status: 204 })
  async remove(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.commandBus.execute(new RemoveTelegramAccountCommand({ scope, accountId: id }));
  }
}
