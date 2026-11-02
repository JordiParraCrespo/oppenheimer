import { Body, Controller, Post, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { LinkWhatsappCommand } from './link-whatsapp.command';
import { LinkWhatsappRequest } from './link-whatsapp.request.dto';

@ApiTags('WhatsApp')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('whatsapp')
export class LinkWhatsappHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: WhatsappAccountMapper,
  ) {}

  @Post('accounts')
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'Whatsapp' })
  @RequireScopes('whatsapp:write')
  @ApiOperation({
    summary: 'Link a WhatsApp number on a host',
    description:
      'Asks the host’s runner to pair a new WhatsApp linked device, the way WhatsApp Web pairs: read the account back until it carries a QR code, then scan it from the phone’s Settings → Linked devices. The caller’s number already on that host is paired again; a connected one is left as it is. Use a number you can lose: WhatsApp does not allow unofficial clients.',
  })
  @ApiResponse({ status: 201, type: WhatsappAccountResponseDto })
  @ApiProblemResponse({
    status: 404,
    description: 'No such host of the caller’s',
    code: 'HOSTS_001',
  })
  @ApiProblemResponse({ status: 409, description: 'The host is offline', code: 'WHATSAPP_004' })
  @ApiProblemResponse({
    status: 409,
    description: 'The host’s runner holds no WhatsApp',
    code: 'WHATSAPP_005',
  })
  @ApiProblemResponse({
    status: 409,
    description: 'Another person’s number is on that host',
    code: 'WHATSAPP_006',
  })
  @ApiProblemResponse({
    status: 409,
    description: 'As many numbers as one person links',
    code: 'WHATSAPP_003',
  })
  async link(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: LinkWhatsappRequest,
  ): Promise<WhatsappAccountResponseDto> {
    const id = await this.commandBus.execute<LinkWhatsappCommand, AggregateID>(
      new LinkWhatsappCommand({ scope, hostId: body.hostId, label: body.label }),
    );
    const [view] = await this.queryBus.execute<FindWhatsappAccountsQuery, WhatsappAccountView[]>(
      new FindWhatsappAccountsQuery({ scope, id }),
    );
    if (!view) throw new Error('a linked number could not be read back');
    return this.mapper.toResponse(view.account, view.hostOnline);
  }
}
