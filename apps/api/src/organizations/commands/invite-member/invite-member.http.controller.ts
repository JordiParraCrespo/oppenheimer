import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { Request } from 'express';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { OrganizationScoped } from '../../../auth/decorators/organization-scoped.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { OrganizationInvitationProblemResponses } from '../../decorators/invitation-problem-responses.decorator';
import { InvitationResponseDto } from '../../dtos/organization.response.dto';
import { FindInvitationQuery } from '../../queries/find-invitation/find-invitation.query';
import { InviteMemberCommand } from './invite-member.command';
import { InviteMemberRequest } from './invite-member.request.dto';

@ApiTags('Organization invitations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@OrganizationInvitationProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('organizations')
export class InviteMemberHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post(':orgId/invitations')
  @Version('1')
  @RequireScopes('invitations:write')
  @OrganizationScoped('orgId')
  @CheckPolicies({ action: 'create', subject: 'Invitation' })
  @ApiOperation({ summary: 'Invite a member to an organization' })
  @ApiResponse({ status: 201, type: InvitationResponseDto })
  async invite(
    @Req() req: Request,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() body: InviteMemberRequest,
  ): Promise<InvitationResponseDto> {
    const invitationId = await this.commandBus.execute<InviteMemberCommand, AggregateID>(
      new InviteMemberCommand({ headers: req.headers, organizationId: orgId, input: body }),
    );
    return this.queryBus.execute<FindInvitationQuery, InvitationResponseDto>(
      new FindInvitationQuery({ invitationId }),
    );
  }
}
