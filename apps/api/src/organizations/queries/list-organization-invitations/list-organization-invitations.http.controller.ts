import { Controller, Get, Param, ParseUUIDPipe, Req, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { OrganizationScoped } from '../../../auth/decorators/organization-scoped.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { OrganizationInvitationProblemResponses } from '../../decorators/invitation-problem-responses.decorator';
import { InvitationResponseDto } from '../../dtos/organization.response.dto';
import { ListOrganizationInvitationsQuery } from './list-organization-invitations.query';

@ApiTags('Organization invitations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@OrganizationInvitationProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('organizations')
export class ListOrganizationInvitationsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':orgId/invitations')
  @Version('1')
  @RequireScopes('invitations:read')
  @OrganizationScoped('orgId')
  @CheckPolicies({ action: 'read', subject: 'Invitation' })
  @ApiOperation({ summary: 'List pending invitations for an organization' })
  @ApiResponse({ status: 200, type: [InvitationResponseDto] })
  list(
    @Req() req: Request,
    @Param('orgId', ParseUUIDPipe) orgId: string,
  ): Promise<InvitationResponseDto[]> {
    return this.queryBus.execute<ListOrganizationInvitationsQuery, InvitationResponseDto[]>(
      new ListOrganizationInvitationsQuery({ headers: req.headers, organizationId: orgId }),
    );
  }
}
