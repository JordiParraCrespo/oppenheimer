import { Controller, Param, ParseUUIDPipe, Post, Req, UseGuards, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { Request } from 'express';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { InvitationProblemResponses } from '../../decorators/invitation-problem-responses.decorator';
import { InvitationResponseDto } from '../../dtos/organization.response.dto';
import { FindInvitationQuery } from '../../queries/find-invitation/find-invitation.query';
import { CancelInvitationCommand } from './cancel-invitation.command';

@ApiTags('Invitations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@InvitationProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('invitations')
export class CancelInvitationHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post(':id/cancel')
  @Version('1')
  @RequireScopes('invitations:write')
  @CheckPolicies({ action: 'update', subject: 'Invitation' })
  @ApiOperation({ summary: 'Cancel an invitation (organization manager)' })
  @ApiResponse({ status: 200, type: InvitationResponseDto })
  async cancel(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InvitationResponseDto> {
    await this.commandBus.execute<CancelInvitationCommand, AggregateID>(
      new CancelInvitationCommand({ headers: req.headers, invitationId: id }),
    );
    return this.queryBus.execute<FindInvitationQuery, InvitationResponseDto>(
      new FindInvitationQuery({ invitationId: id }),
    );
  }
}
