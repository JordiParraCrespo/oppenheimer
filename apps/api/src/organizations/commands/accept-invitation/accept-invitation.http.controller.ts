import { Controller, Param, ParseUUIDPipe, Post, Req, UseGuards, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { InvitationProblemResponses } from '../../decorators/invitation-problem-responses.decorator';
import type { InvitationCaller } from '../../domain/invitation.types';
import { InvitationResponseDto } from '../../dtos/organization.response.dto';
import { AcceptInvitationCommand } from './accept-invitation.command';

@ApiTags('Invitations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@InvitationProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('invitations')
export class AcceptInvitationHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/accept')
  @NoPolicy('the caller acting on their own invitation')
  @Version('1')
  @RequireScopes('invitations:write')
  @ApiOperation({ summary: 'Accept an invitation' })
  @ApiResponse({ status: 200, type: InvitationResponseDto })
  accept(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() caller: InvitationCaller | null,
  ): Promise<InvitationResponseDto> {
    return this.commandBus.execute<AcceptInvitationCommand, InvitationResponseDto>(
      new AcceptInvitationCommand({ headers: req.headers, invitationId: id, caller }),
    );
  }
}
