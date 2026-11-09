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
import { ConfirmWhatsappOwnerCommand } from './confirm-whatsapp-owner.command';
import { ConfirmWhatsappOwnerRequest } from './confirm-whatsapp-owner.request.dto';

@ApiTags('WhatsApp')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('whatsapp')
export class ConfirmWhatsappOwnerHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: WhatsappAccountMapper,
  ) {}

  @Post('accounts/:id/owner/confirm')
  @Version('1')
  @HttpCode(200)
  @CheckPolicies({ action: 'update', subject: 'Whatsapp' })
  @RequireScopes('whatsapp:write')
  @ApiOperation({
    summary: 'Confirm your own number with the code it received',
    description:
      'Enters the six-digit code the linked number sent to the caller’s own number. The right code, within ten minutes, makes that number the owner: the only one this number answers, in its own chat. Five wrong codes lock it until a new one is asked for.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'The linked number.' })
  @ApiResponse({ status: 200, type: WhatsappAccountResponseDto })
  @ApiProblemResponse({ status: 404, description: 'No such linked number', code: 'WHATSAPP_001' })
  @ApiProblemResponse({
    status: 422,
    description: 'The code is wrong or has expired',
    code: 'WHATSAPP_011',
  })
  @ApiProblemResponse({
    status: 409,
    description: 'No number is waiting for its code',
    code: 'WHATSAPP_012',
  })
  @ApiProblemResponse({
    status: 429,
    description: 'Too many wrong codes: ask for a new one',
    code: 'WHATSAPP_014',
  })
  async confirm(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ConfirmWhatsappOwnerRequest,
  ): Promise<WhatsappAccountResponseDto> {
    const accountId = await this.commandBus.execute<ConfirmWhatsappOwnerCommand, AggregateID>(
      new ConfirmWhatsappOwnerCommand({ scope, accountId: id, code: body.code }),
    );
    const [view] = await this.queryBus.execute<FindWhatsappAccountsQuery, WhatsappAccountView[]>(
      new FindWhatsappAccountsQuery({ scope, id: accountId }),
    );
    if (!view) throw new Error('a WhatsApp number could not be read back');
    return this.mapper.toResponse(view.account, view.hostOnline);
  }
}
