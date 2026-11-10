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
import { WhatsappAccountResponseDto } from '../../dtos/whatsapp-account.response.dto';
import {
  FindWhatsappAccountsQuery,
  type WhatsappAccountView,
} from '../../queries/find-whatsapp-accounts/find-whatsapp-accounts.query';
import { WhatsappAccountMapper } from '../../whatsapp-account.mapper';
import { UpdateWhatsappAccountCommand } from './update-whatsapp-account.command';
import { UpdateWhatsappAccountRequest } from './update-whatsapp-account.request.dto';

@ApiTags('WhatsApp')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('whatsapp')
export class UpdateWhatsappAccountHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: WhatsappAccountMapper,
  ) {}

  @Patch('accounts/:id')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Whatsapp' })
  @RequireScopes('whatsapp:write')
  @ApiOperation({
    summary: 'Choose which bot answers on a WhatsApp number',
    description:
      'Sets the caller’s Oppenheimer bot that answers them by default when they write to this number from their own confirmed number, or none (`null`). "Name: …" in the chat switches it to another of their bots. A bot that is a number’s default cannot be deleted until it is unbound.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'The linked number.' })
  @ApiResponse({ status: 200, type: WhatsappAccountResponseDto })
  @ApiProblemResponse({ status: 404, description: 'No such linked number', code: 'WHATSAPP_001' })
  @ApiProblemResponse({ status: 404, description: 'No such bot of the caller’s', code: 'BOTS_001' })
  async update(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateWhatsappAccountRequest,
  ): Promise<WhatsappAccountResponseDto> {
    const accountId = await this.commandBus.execute<UpdateWhatsappAccountCommand, AggregateID>(
      new UpdateWhatsappAccountCommand({
        scope,
        accountId: id,
        answeringBotId: body.answeringBotId,
      }),
    );
    const [view] = await this.queryBus.execute<FindWhatsappAccountsQuery, WhatsappAccountView[]>(
      new FindWhatsappAccountsQuery({ scope, id: accountId }),
    );
    if (!view) throw new Error('an updated WhatsApp number could not be read back');
    return this.mapper.toResponse(view.account, view.hostOnline);
  }
}
