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
import type { WhatsappChatRouteRow } from '../../domain/whatsapp-chat-route.policy';
import { WhatsappChatRouteResponseDto } from '../../dtos/whatsapp-chat-route.response.dto';
import { WhatsappChatGrantMapper } from '../../whatsapp-chat-grant.mapper';
import { FindWhatsappChatRoutesQuery } from './find-whatsapp-chat-routes.query';

@ApiTags('WhatsApp')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('whatsapp')
export class FindWhatsappChatRoutesHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: WhatsappChatGrantMapper,
  ) {}

  @Get('accounts/:id/chats')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Whatsapp' })
  @RequireScopes('whatsapp:read')
  @ApiOperation({
    summary: 'List a WhatsApp number’s chats and who answers each',
    description:
      'Every group and person the number has seen (the most recently active first, up to 1,000), then any it allows with no message kept, each with its grant: answered by a bot, by the number’s default, or by no one (`grant: null`). The owner’s own chat and the number’s chat with itself are not listed.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'The linked number.' })
  @ApiResponse({ status: 200, type: [WhatsappChatRouteResponseDto] })
  @ApiProblemResponse({ status: 404, description: 'No such linked number', code: 'WHATSAPP_001' })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WhatsappChatRouteResponseDto[]> {
    const rows = await this.queryBus.execute<FindWhatsappChatRoutesQuery, WhatsappChatRouteRow[]>(
      new FindWhatsappChatRoutesQuery({ scope, accountId: id }),
    );
    return rows.map((row) => this.mapper.toRouteResponse(row));
  }
}
