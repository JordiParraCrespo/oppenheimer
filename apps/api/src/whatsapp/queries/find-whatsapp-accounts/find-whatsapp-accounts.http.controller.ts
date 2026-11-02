import { Controller, Get, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { WhatsappAccountResponseDto } from '../../dtos/whatsapp-account.response.dto';
import { WhatsappAccountMapper } from '../../whatsapp-account.mapper';
import {
  FindWhatsappAccountsQuery,
  type WhatsappAccountView,
} from './find-whatsapp-accounts.query';

@ApiTags('WhatsApp')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('whatsapp')
export class FindWhatsappAccountsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: WhatsappAccountMapper,
  ) {}

  @Get('accounts')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Whatsapp' })
  @RequireScopes('whatsapp:read')
  @ApiOperation({
    summary: 'The caller’s own linked WhatsApp numbers',
    description:
      'Every number the caller linked as a WhatsApp device on one of their hosts, oldest first: its name, how its device stands, whether its host is online, and while it pairs, the QR code to scan.',
  })
  @ApiResponse({ status: 200, type: [WhatsappAccountResponseDto] })
  async find(@CurrentAccessScope() scope: AccessScope): Promise<WhatsappAccountResponseDto[]> {
    const views = await this.queryBus.execute<FindWhatsappAccountsQuery, WhatsappAccountView[]>(
      new FindWhatsappAccountsQuery({ scope }),
    );
    return views.map(({ account, hostOnline }) => this.mapper.toResponse(account, hostOnline));
  }
}
