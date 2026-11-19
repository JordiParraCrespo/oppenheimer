import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
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
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { WhatsappChatGrantEntity } from '../../domain/whatsapp-chat-grant.entity';
import { WhatsappChatGrantResponseDto } from '../../dtos/whatsapp-chat-grant.response.dto';
import { FindWhatsappChatGrantsQuery } from '../../queries/find-whatsapp-chat-grants/find-whatsapp-chat-grants.query';
import { WhatsappChatGrantMapper } from '../../whatsapp-chat-grant.mapper';
import { AllowWhatsappChatCommand } from './allow-whatsapp-chat.command';
import { AllowWhatsappChatRequest } from './allow-whatsapp-chat.request.dto';

@ApiTags('WhatsApp')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('whatsapp')
export class AllowWhatsappChatHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: WhatsappChatGrantMapper,
  ) {}

  @Post('accounts/:id/grants')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Whatsapp' })
  // Session-only: who may talk to the owner's bots is the owner's to decide,
  // in the console or by asking a bot in their own chat, so no API token or
  // OAuth grant may allow a chat, whatever its scopes.
  @ApiOperation({
    summary: 'Allow a chat on a WhatsApp number',
    description:
      'Allows a group, or a person besides the owner, to talk to the number’s bots: by the chat’s id, its name, or a person’s phone number in international form. `botId` picks the bot that answers there (null or absent for the number’s default). Allowing a chat already allowed changes its bot when `botId` is given. Only once the owner’s own number is confirmed.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'The linked number.' })
  @ApiResponse({ status: 201, type: WhatsappChatGrantResponseDto })
  @ApiProblemResponse({ status: 404, description: 'No such linked number', code: 'WHATSAPP_001' })
  @ApiProblemResponse({ status: 404, description: 'No such chat', code: 'WHATSAPP_010' })
  @ApiProblemResponse({ status: 404, description: 'No such bot of the caller’s', code: 'BOTS_001' })
  @ApiProblemResponse({
    status: 409,
    description: 'The owner’s number is not confirmed',
    code: 'WHATSAPP_015',
  })
  @ApiProblemResponse({
    status: 422,
    description: 'The owner’s own chat, or the number itself',
    code: 'WHATSAPP_017',
  })
  @ApiProblemResponse({ status: 409, description: 'Too many allowed chats', code: 'WHATSAPP_018' })
  async allow(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AllowWhatsappChatRequest,
  ): Promise<WhatsappChatGrantResponseDto> {
    const grantId = await this.commandBus.execute<AllowWhatsappChatCommand, AggregateID>(
      new AllowWhatsappChatCommand({
        scope,
        accountId: id,
        chat: body.chat,
        botId: body.botId,
        grantedByBotId: null,
      }),
    );
    const grants = await this.queryBus.execute<
      FindWhatsappChatGrantsQuery,
      WhatsappChatGrantEntity[]
    >(new FindWhatsappChatGrantsQuery({ scope, accountId: id }));
    const grant = grants.find((item) => item.id === grantId);
    if (!grant) throw new Error('a WhatsApp chat grant just written could not be read back');
    return this.mapper.toResponse(grant);
  }
}
