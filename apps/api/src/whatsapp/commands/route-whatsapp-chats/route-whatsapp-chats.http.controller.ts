import {
  Body,
  Controller,
  HttpCode,
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
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { WhatsappChatRouteRow } from '../../domain/whatsapp-chat-route.policy';
import { WhatsappChatRouteResponseDto } from '../../dtos/whatsapp-chat-route.response.dto';
import { FindWhatsappChatRoutesQuery } from '../../queries/find-whatsapp-chat-routes/find-whatsapp-chat-routes.query';
import { WhatsappChatGrantMapper } from '../../whatsapp-chat-grant.mapper';
import { RouteWhatsappChatsCommand } from './route-whatsapp-chats.command';
import { RouteWhatsappChatsRequest } from './route-whatsapp-chats.request.dto';

@ApiTags('WhatsApp')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('whatsapp')
export class RouteWhatsappChatsHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: WhatsappChatGrantMapper,
  ) {}

  @Post('accounts/:id/routes')
  @Version('1')
  @HttpCode(200)
  @CheckPolicies({ action: 'update', subject: 'Whatsapp' })
  // Session-only, as allowing one chat is: who may talk to the owner's bots
  // is the owner's to decide, so no API token or OAuth grant may route a chat,
  // whatever its scopes.
  @ApiOperation({
    summary: 'Choose who answers a set of a WhatsApp number’s chats',
    description:
      'Up to 200 chats the number lists at once: `none` stops answering them (their messages are only kept), `default` has the number’s default bot answer them, `bot` one of the caller’s bots (`botId`). A chat not allowed yet is allowed. Answers the number’s chats as they are now.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'The linked number.' })
  @ApiResponse({ status: 200, type: [WhatsappChatRouteResponseDto] })
  @ApiProblemResponse({ status: 404, description: 'No such linked number', code: 'WHATSAPP_001' })
  @ApiProblemResponse({
    status: 404,
    description: 'A chat the number has not seen',
    code: 'WHATSAPP_010',
  })
  @ApiProblemResponse({
    status: 409,
    description: 'The owner’s number is not confirmed',
    code: 'WHATSAPP_015',
  })
  @ApiProblemResponse({
    status: 422,
    description: 'The owner’s own chat, or the number’s',
    code: 'WHATSAPP_017',
  })
  @ApiProblemResponse({
    status: 409,
    description: 'Past the chats one number allows',
    code: 'WHATSAPP_018',
  })
  @ApiProblemResponse({ status: 404, description: 'No such bot of the caller’s', code: 'BOTS_001' })
  async route(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RouteWhatsappChatsRequest,
  ): Promise<WhatsappChatRouteResponseDto[]> {
    await this.commandBus.execute(
      new RouteWhatsappChatsCommand({
        scope,
        accountId: id,
        chatIds: body.chatIds,
        route: body.route,
        botId: body.botId ?? null,
      }),
    );
    const rows = await this.queryBus.execute<FindWhatsappChatRoutesQuery, WhatsappChatRouteRow[]>(
      new FindWhatsappChatRoutesQuery({ scope, accountId: id }),
    );
    return rows.map((row) => this.mapper.toRouteResponse(row));
  }
}
