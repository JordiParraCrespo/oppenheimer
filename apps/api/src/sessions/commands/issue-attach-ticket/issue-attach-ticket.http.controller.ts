import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { AttachTicketResponseDto } from '../../dtos/session.response.dto';
import { IssueAttachTicketCommand } from './issue-attach-ticket.command';
import type { IssuedAttachTicket } from './issue-attach-ticket.command-handler';
import { IssueAttachTicketRequest } from './issue-attach-ticket.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class IssueAttachTicketHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/attach-ticket')
  @Version('1')
  // Opening a terminal is `update Session` behind `sessions:write`. There is no
  // `attach` action: the scope split is what keeps a read-only credential out of a
  // PTY, and a verb that lived only in the token picker would be a second
  // vocabulary.
  @CheckPolicies({ action: 'update', subject: 'Session' })
  @RequireScopes('sessions:write')
  // Every reconnect mints a fresh ticket, so this is called more often than the
  // other writes — but a loop minting tickets is still a loop.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    operationId: 'issueAttachTicket',
    summary: 'Mint a ticket for a terminal on this session',
    description:
      'Single use, 60 seconds, one window. Present it as a WebSocket subprotocol, never in the query string. The relay re-checks at consume that the session is still live and the caller is still a member of the workspace, so authorization is not frozen at mint.',
  })
  @ApiResponse({ status: 201, type: AttachTicketResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  @ApiProblemResponse({ status: 409, description: 'That session is closed', code: 'SESSIONS_005' })
  @ApiProblemResponse({
    status: 503,
    description: 'A terminal ticket could not be issued',
    code: 'SESSIONS_008',
  })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async issue(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: IssueAttachTicketRequest,
  ): Promise<AttachTicketResponseDto> {
    return this.commandBus.execute<IssueAttachTicketCommand, IssuedAttachTicket>(
      new IssueAttachTicketCommand({
        scope,
        sessionId: id,
        userId,
        window: body.window ?? 0,
      }),
    );
  }
}
