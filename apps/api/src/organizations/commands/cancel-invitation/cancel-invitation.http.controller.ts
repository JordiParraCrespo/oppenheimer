import { Controller, Param, ParseUUIDPipe, Post, Req, UseGuards, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { InvitationProblemResponses } from '../../decorators/invitation-problem-responses.decorator';
import { InvitationResponseDto } from '../../dtos/organization.response.dto';
import { CancelInvitationCommand } from './cancel-invitation.command';

@ApiTags('Invitations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@InvitationProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('invitations')
export class CancelInvitationHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/cancel')
  @Version('1')
  @RequireScopes('invitations:write')
  @CheckPolicies({ action: 'update', subject: 'Invitation' })
  @ApiOperation({ summary: 'Cancel an invitation (organization manager)' })
  @ApiResponse({ status: 200, type: InvitationResponseDto })
  cancel(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InvitationResponseDto> {
    return this.commandBus.execute<CancelInvitationCommand, InvitationResponseDto>(
      new CancelInvitationCommand({ headers: req.headers, invitationId: id }),
    );
  }
}
