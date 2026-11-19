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
import type { WhatsappChatGrantEntity } from '../../domain/whatsapp-chat-grant.entity';
import { WhatsappChatGrantResponseDto } from '../../dtos/whatsapp-chat-grant.response.dto';
import { FindWhatsappChatGrantsQuery } from '../../queries/find-whatsapp-chat-grants/find-whatsapp-chat-grants.query';
import { WhatsappChatGrantMapper } from '../../whatsapp-chat-grant.mapper';
import { UpdateWhatsappChatGrantCommand } from './update-whatsapp-chat-grant.command';
import { UpdateWhatsappChatGrantRequest } from './update-whatsapp-chat-grant.request.dto';

@ApiTags('WhatsApp')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('whatsapp')
export class UpdateWhatsappChatGrantHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: WhatsappChatGrantMapper,
  ) {}

  @Patch('accounts/:id/grants/:grantId')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Whatsapp' })
  @RequireScopes('whatsapp:write')
  @ApiOperation({
    summary: 'Choose which bot answers in an allowed WhatsApp chat',
    description:
      'Sets the caller’s bot that answers in a chat the number allows, or the number’s default (`null`). A bot that answers in one cannot be deleted until it is unbound.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'The linked number.' })
  @ApiParam({ name: 'grantId', format: 'uuid', description: 'The allowed chat.' })
  @ApiResponse({ status: 200, type: WhatsappChatGrantResponseDto })
  @ApiProblemResponse({ status: 404, description: 'No such linked number', code: 'WHATSAPP_001' })
  @ApiProblemResponse({ status: 404, description: 'No such allowed chat', code: 'WHATSAPP_016' })
  @ApiProblemResponse({ status: 404, description: 'No such bot of the caller’s', code: 'BOTS_001' })
  async update(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('grantId', ParseUUIDPipe) grantId: string,
    @Body() body: UpdateWhatsappChatGrantRequest,
  ): Promise<WhatsappChatGrantResponseDto> {
    const updated = await this.commandBus.execute<UpdateWhatsappChatGrantCommand, AggregateID>(
      new UpdateWhatsappChatGrantCommand({ scope, accountId: id, grantId, botId: body.botId }),
    );
    const grants = await this.queryBus.execute<
      FindWhatsappChatGrantsQuery,
      WhatsappChatGrantEntity[]
    >(new FindWhatsappChatGrantsQuery({ scope, accountId: id }));
    const grant = grants.find((item) => item.id === updated);
    if (!grant) throw new Error('a WhatsApp chat grant just written could not be read back');
    return this.mapper.toResponse(grant);
  }
}
