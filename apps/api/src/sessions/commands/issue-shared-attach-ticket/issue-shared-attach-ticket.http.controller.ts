import { Body, Controller, Post, UseGuards, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiProblemResponse } from '@oppenheimer/backend-core';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { OptionalApiAuthGuard } from '../../../auth/guards/optional-api-auth.guard';
import type { IssuedAttachTicket } from '../../application/attach-ticket.factory';
import { AttachTicketResponseDto } from '../../dtos/session.response.dto';
import { SessionShareLinkMapper } from '../../session-share-link.mapper';
import { IssueSharedAttachTicketCommand } from './issue-shared-attach-ticket.command';
import { IssueSharedAttachTicketRequest } from './issue-shared-attach-ticket.request.dto';

@ApiTags('Shared sessions')
@UseGuards(OptionalApiAuthGuard)
@Controller('shared-sessions')
export class IssueSharedAttachTicketHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly mapper: SessionShareLinkMapper,
  ) {}

  @Post('attach-ticket')
  @Version('1')
  @NoPolicy('the share link’s secret is the authorization; signed out callers use it too')
  @RequireScopes('sessions:write')
  // Every reconnect mints one, as on a member's terminal.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Mint a terminal ticket through a share link',
    description:
      'Single use, 60 seconds, one window, as `POST /sessions/{id}/attach-ticket`. The relay re-checks the link, and that its creator may still open the session, at redemption and every minute after.',
  })
  @ApiResponse({ status: 201, type: AttachTicketResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Share link not found', code: 'SESSIONS_021' })
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
    @CurrentUser() user: unknown,
  ): Promise<IssuedAttachTicket> {
    return this.commandBus.execute(
      new IssueSharedAttachTicketCommand({
        token: body.token,
        viewer: this.mapper.toViewer(user),
        window: body.window ?? 0,
      }),
    );
  }
}
