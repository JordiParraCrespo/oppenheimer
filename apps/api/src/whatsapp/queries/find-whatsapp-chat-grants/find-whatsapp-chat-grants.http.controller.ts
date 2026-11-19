import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { WhatsappChatGrantEntity } from '../../domain/whatsapp-chat-grant.entity';
import { WhatsappChatGrantResponseDto } from '../../dtos/whatsapp-chat-grant.response.dto';
import { WhatsappChatGrantMapper } from '../../whatsapp-chat-grant.mapper';
import { FindWhatsappChatGrantsQuery } from './find-whatsapp-chat-grants.query';

@ApiTags('WhatsApp')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('whatsapp')
export class FindWhatsappChatGrantsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: WhatsappChatGrantMapper,
  ) {}

  @Get('accounts/:id/grants')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Whatsapp' })
  @RequireScopes('whatsapp:read')
  @ApiOperation({
    summary: 'List the chats a WhatsApp number allows',
    description:
      'The groups and people besides the owner who may talk to the number’s bots, the oldest first, each with the bot that answers there (null for the number’s default) and the bot that allowed it, if one did.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'The linked number.' })
  @ApiResponse({ status: 200, type: [WhatsappChatGrantResponseDto] })
  @ApiProblemResponse({ status: 404, description: 'No such linked number', code: 'WHATSAPP_001' })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WhatsappChatGrantResponseDto[]> {
    const grants = await this.queryBus.execute<
      FindWhatsappChatGrantsQuery,
      WhatsappChatGrantEntity[]
    >(new FindWhatsappChatGrantsQuery({ scope, accountId: id }));
    return grants.map((grant) => this.mapper.toResponse(grant));
  }
}
