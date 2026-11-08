import { Body, Controller, Post, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { LinkTelegramCommand } from './link-telegram.command';
import { LinkTelegramRequest } from './link-telegram.request.dto';

@ApiTags('Telegram')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('telegram')
export class LinkTelegramHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: TelegramAccountMapper,
  ) {}

  @Post('accounts')
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'Telegram' })
  @RequireScopes('telegram:write')
  @ApiOperation({
    summary: 'Connect a Telegram bot on a host',
    description:
      'Hands the host’s runner the token @BotFather gave for a bot; the runner checks it with Telegram, keeps it, and long-polls the Bot API with it. The token is never stored by the control plane. Read the account back: `connected` once the host polls, `revoked` with a reason when Telegram refused the token. The caller’s Telegram bot already on that host takes the new token, keeping its messages.',
  })
  @ApiResponse({ status: 201, type: TelegramAccountResponseDto })
  @ApiProblemResponse({
    status: 404,
    description: 'No such host of the caller’s',
    code: 'HOSTS_001',
  })
  @ApiProblemResponse({ status: 409, description: 'The host is offline', code: 'TELEGRAM_004' })
  @ApiProblemResponse({
    status: 409,
    description: 'The host’s runner holds no Telegram bots',
    code: 'TELEGRAM_005',
  })
  @ApiProblemResponse({
    status: 409,
    description: 'Another person’s Telegram bot is on that host',
    code: 'TELEGRAM_006',
  })
  @ApiProblemResponse({
    status: 409,
    description: 'As many Telegram bots as one person connects',
    code: 'TELEGRAM_003',
  })
  async link(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: LinkTelegramRequest,
  ): Promise<TelegramAccountResponseDto> {
    const id = await this.commandBus.execute<LinkTelegramCommand, AggregateID>(
      new LinkTelegramCommand({
        scope,
        hostId: body.hostId,
        token: body.token,
        label: body.label,
      }),
    );
    const [view] = await this.queryBus.execute<FindTelegramAccountsQuery, TelegramAccountView[]>(
      new FindTelegramAccountsQuery({ scope, id }),
    );
    if (!view) throw new Error('a connected Telegram bot could not be read back');
    return this.mapper.toResponse(view.account, view.hostOnline);
  }
}
