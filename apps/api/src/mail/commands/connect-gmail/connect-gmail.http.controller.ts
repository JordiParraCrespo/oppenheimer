import { Body, Controller, Post, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { GmailConnectionEntity } from '../../domain/gmail-connection.entity';
import { GmailConnectionResponseDto } from '../../dtos/gmail-connection.response.dto';
import { GmailConnectionMapper } from '../../gmail-connection.mapper';
import { FindGmailConnectionQuery } from '../../queries/find-gmail-connection/find-gmail-connection.query';
import { ConnectGmailCommand } from './connect-gmail.command';
import { ConnectGmailRequest } from './connect-gmail.request.dto';

@ApiTags('Mail')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('mail')
export class ConnectGmailHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: GmailConnectionMapper,
  ) {}

  @Post('gmail/connection')
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'Mail' })
  @RequireScopes('mail:write')
  @ApiOperation({
    summary: 'Finish connecting a Gmail account',
    description:
      'The `code` and `state` Google put on the redirect. The state is spent first; the code is exchanged once, and the refresh token is kept sealed. An account the caller already connected is reconnected in place, keeping its label; another is added, up to five.',
  })
  @ApiResponse({ status: 201, type: GmailConnectionResponseDto })
  @ApiProblemResponse({
    status: 429,
    description: "Gmail's rate limit was reached; try again after Retry-After",
    code: 'MAIL_008',
  })
  @ApiProblemResponse({ status: 400, description: 'State rejected', code: 'MAIL_005' })
  @ApiProblemResponse({ status: 400, description: 'Google refused', code: 'MAIL_006' })
  @ApiProblemResponse({
    status: 409,
    description: 'Five accounts already connected',
    code: 'MAIL_003',
  })
  @ApiProblemResponse({ status: 503, description: 'Not configured', code: 'MAIL_004' })
  async connect(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: ConnectGmailRequest,
  ): Promise<GmailConnectionResponseDto> {
    const id = await this.commandBus.execute<ConnectGmailCommand, AggregateID>(
      new ConnectGmailCommand({ scope, input: body }),
    );
    const connection = await this.queryBus.execute<FindGmailConnectionQuery, GmailConnectionEntity>(
      new FindGmailConnectionQuery({ scope, id }),
    );
    return this.mapper.toResponse(connection);
  }
}
