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
import { Throttle } from '@nestjs/throttler';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
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
import { RequestWhatsappOwnerCommand } from './request-whatsapp-owner.command';
import { RequestWhatsappOwnerRequest } from './request-whatsapp-owner.request.dto';

@ApiTags('WhatsApp')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('whatsapp')
export class RequestWhatsappOwnerHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: WhatsappAccountMapper,
  ) {}

  @Post('accounts/:id/owner')
  @Version('1')
  @HttpCode(202)
  // Each code is a message from the number, out of its host's send budget.
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @CheckPolicies({ action: 'update', subject: 'Whatsapp' })
  // Session-only: the owner's line starts turns with the bot's full tools and
  // memory, so no API token or OAuth grant may name it, whatever its scopes.
  @ApiOperation({
    summary: 'Name your own number, and get a code on it',
    description:
      'The linked number sends a six-digit code to the caller’s own number, which they enter with `POST …/owner/confirm` within ten minutes. Once confirmed, it is the only number this one answers. A new request replaces a waiting code; the confirmed number stays until another is confirmed. Only the code’s hash is kept.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'The linked number.' })
  @ApiResponse({ status: 202, type: WhatsappAccountResponseDto })
  @ApiProblemResponse({ status: 404, description: 'No such linked number', code: 'WHATSAPP_001' })
  @ApiProblemResponse({
    status: 409,
    description: 'The host, older or offline, or the number, not connected, cannot send the code',
    code: ['WHATSAPP_004', 'WHATSAPP_005', 'WHATSAPP_007'],
  })
  @ApiProblemResponse({
    status: 502,
    description: 'WhatsApp did not take the code',
    code: 'WHATSAPP_008',
  })
  @ApiProblemResponse({
    status: 429,
    description: 'The host’s send budget is spent',
    code: 'WHATSAPP_009',
  })
  @ApiProblemResponse({
    status: 422,
    description: 'Not a phone number, or the linked number itself',
    code: 'WHATSAPP_013',
  })
  async request(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RequestWhatsappOwnerRequest,
  ): Promise<WhatsappAccountResponseDto> {
    const accountId = await this.commandBus.execute<RequestWhatsappOwnerCommand, AggregateID>(
      new RequestWhatsappOwnerCommand({ scope, accountId: id, phone: body.phone }),
    );
    const [view] = await this.queryBus.execute<FindWhatsappAccountsQuery, WhatsappAccountView[]>(
      new FindWhatsappAccountsQuery({ scope, id: accountId }),
    );
    if (!view) throw new Error('a WhatsApp number could not be read back');
    return this.mapper.toResponse(view.account, view.hostOnline);
  }
}
