import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { TelegramOwnerLinkResponseDto } from '../../dtos/telegram-owner-link.response.dto';
import {
  type OpenedTelegramOwnerLink,
  OpenTelegramOwnerLinkCommand,
} from './open-telegram-owner-link.command';

@ApiTags('Telegram')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('telegram')
export class OpenTelegramOwnerLinkHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('accounts/:id/owner-link')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Telegram' })
  // Session-only: the owner's line starts turns with the bot's full tools and
  // memory, so no API token or OAuth grant may name it, whatever its scopes.
  @ApiOperation({
    summary: 'Make a one-time link that records the owner',
    description:
      'Answers a `t.me` link for the Telegram bot with a one-time code. Opening it in Telegram sends the bot `/start` with the code, and whoever sends it within ten minutes is recorded as the owner: the only person the bot answers. A new link replaces an open one; the code is stored hashed, so only this answer carries it.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'The connected Telegram bot.' })
  @ApiResponse({ status: 201, type: TelegramOwnerLinkResponseDto })
  @ApiProblemResponse({ status: 404, description: 'No such Telegram bot', code: 'TELEGRAM_001' })
  @ApiProblemResponse({
    status: 409,
    description: 'The host has not checked the bot yet',
    code: 'TELEGRAM_007',
  })
  async open(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TelegramOwnerLinkResponseDto> {
    const link = await this.commandBus.execute<
      OpenTelegramOwnerLinkCommand,
      OpenedTelegramOwnerLink
    >(new OpenTelegramOwnerLinkCommand({ scope, accountId: id }));
    const dto = new TelegramOwnerLinkResponseDto();
    dto.url = link.url;
    dto.expiresAt = link.expiresAt.toISOString();
    return dto;
  }
}
