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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { TelegramAccountResponseDto } from '../../dtos/telegram-account.response.dto';
import {
  FindTelegramAccountsQuery,
  type TelegramAccountView,
} from '../../queries/find-telegram-accounts/find-telegram-accounts.query';
import { TelegramAccountMapper } from '../../telegram-account.mapper';
import { UpdateTelegramAccountCommand } from './update-telegram-account.command';
import { UpdateTelegramAccountRequest } from './update-telegram-account.request.dto';

@ApiTags('Telegram')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('telegram')
export class UpdateTelegramAccountHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: TelegramAccountMapper,
  ) {}

  @Patch('accounts/:id')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Telegram' })
  @RequireScopes('telegram:write')
  @ApiOperation({
    summary: 'Choose which bot answers on a Telegram bot',
    description:
      'Sets the caller’s Oppenheimer bot that answers them when they write to this Telegram bot, or none (`null`). Only the owner, recorded by the one-time `start` link, is answered. A bot that answers a Telegram bot cannot be deleted until it is unbound.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'The connected Telegram bot.' })
  @ApiResponse({ status: 200, type: TelegramAccountResponseDto })
  @ApiProblemResponse({ status: 404, description: 'No such Telegram bot', code: 'TELEGRAM_001' })
  @ApiProblemResponse({ status: 404, description: 'No such bot of the caller’s', code: 'BOTS_001' })
  async update(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTelegramAccountRequest,
  ): Promise<TelegramAccountResponseDto> {
    const accountId = await this.commandBus.execute<UpdateTelegramAccountCommand, AggregateID>(
      new UpdateTelegramAccountCommand({
        scope,
        accountId: id,
        answeringBotId: body.answeringBotId,
      }),
    );
    const [view] = await this.queryBus.execute<FindTelegramAccountsQuery, TelegramAccountView[]>(
      new FindTelegramAccountsQuery({ scope, id: accountId }),
    );
    if (!view) throw new Error('an updated Telegram bot could not be read back');
    return this.mapper.toResponse(view.account, view.hostOnline);
  }
}
