import { Body, Controller, Post, UseGuards, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiProblemResponse } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { OptionalApiAuthGuard } from '../../../auth/guards/optional-api-auth.guard';
import { NoPolicy } from '../../../authz/decorators/check-policies.decorator';
import type { IssuedAttachTicket } from '../../application/attach-ticket.factory';
import { CurrentShareViewer } from '../../decorators/current-share-viewer.decorator';
import type { SessionShareViewer } from '../../domain/session-share.entity';
import { AttachTicketResponseDto } from '../../dtos/session.response.dto';
import { IssueSharedAttachTicketCommand } from './issue-shared-attach-ticket.command';
import { IssueSharedAttachTicketRequest } from './issue-shared-attach-ticket.request.dto';

@ApiTags('Shared sessions')
@UseGuards(OptionalApiAuthGuard)
@Controller('shared-sessions')
export class IssueSharedAttachTicketHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('attach-ticket')
  @Version('1')
  @NoPolicy('the share judges the caller itself, and tells a signed-out caller to sign in')
  @RequireScopes('sessions:write')
  // Every reconnect mints one, as on a member's terminal.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Mint a terminal ticket for a shared session',
    description:
      'Single use, 60 seconds, the agent’s window (0) only, as `POST /sessions/{id}/attach-ticket`. The relay re-checks the share, and that whoever shared it may still open the session, at redemption and every minute after.',
  })
  @ApiResponse({ status: 201, type: AttachTicketResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Not shared', code: 'SESSIONS_021' })
  @ApiProblemResponse({ status: 401, description: 'Sign in to open it', code: 'SESSIONS_022' })
  @ApiProblemResponse({ status: 403, description: 'Not shared with you', code: 'SESSIONS_023' })
  @ApiProblemResponse({
    status: 503,
    description: 'A terminal ticket could not be issued',
    code: 'SESSIONS_008',
  })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  issue(
    @Body() body: IssueSharedAttachTicketRequest,
    @CurrentShareViewer() viewer: SessionShareViewer | null,
  ): Promise<IssuedAttachTicket> {
    return this.commandBus.execute(new IssueSharedAttachTicketCommand({ slug: body.slug, viewer }));
  }
}
