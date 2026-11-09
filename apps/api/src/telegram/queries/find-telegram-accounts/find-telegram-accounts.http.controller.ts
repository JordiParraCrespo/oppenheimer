import { Controller, Get, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { TelegramAccountResponseDto } from '../../dtos/telegram-account.response.dto';
import { TelegramAccountMapper } from '../../telegram-account.mapper';
import {
  FindTelegramAccountsQuery,
  type TelegramAccountView,
} from './find-telegram-accounts.query';

@ApiTags('Telegram')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('telegram')
export class FindTelegramAccountsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: TelegramAccountMapper,
  ) {}

  @Get('accounts')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Telegram' })
  @RequireScopes('telegram:read')
  @ApiOperation({
    summary: 'The caller’s own connected Telegram bots',
    description:
      'Every Telegram bot the caller connected on one of their hosts, oldest first: its name, its `@username`, how it stands, and whether its host is online. Never its token.',
  })
  @ApiResponse({ status: 200, type: [TelegramAccountResponseDto] })
  async find(@CurrentAccessScope() scope: AccessScope): Promise<TelegramAccountResponseDto[]> {
    const views = await this.queryBus.execute<FindTelegramAccountsQuery, TelegramAccountView[]>(
      new FindTelegramAccountsQuery({ scope }),
    );
    return views.map(({ account, hostOnline }) => this.mapper.toResponse(account, hostOnline));
  }
}
