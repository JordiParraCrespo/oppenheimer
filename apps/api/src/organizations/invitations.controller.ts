import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { CheckPolicies, NoPolicy } from '../auth/decorators/check-policies.decorator';
import { OrganizationScoped } from '../auth/decorators/organization-scoped.decorator';
import { RequireScopes } from '../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../auth/guards/policies.guard';
import { InviteMemberRequest } from './dtos/organization.request.dto';
import { InvitationResponseDto } from './dtos/organization.response.dto';
import { InvitationsService } from './invitations.service';

/** Organization-scoped invitation management (requires `Invitation` policies). */
@ApiTags('Organization invitations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@ApiProblemResponse({
  status: 403,
  description:
    'The invitation was issued to another account, the caller may not manage invitations, or their email is unverified',
  code: ['ORG_009', 'ORG_004', 'ORG_011'],
})
@ApiProblemResponse({
  status: 409,
  description:
    'That user is already invited or already a member, or an invitation limit was reached',
  code: ['ORG_010', 'ORG_006', 'ORG_014'],
})
@ApiProblemResponse({
  status: 502,
  description: 'The organization service failed to handle the request',
  code: 'ORG_016',
})
@ApiProblemResponse({
  status: 404,
  description: 'The organization does not exist, or is not visible to the caller',
  code: 'ORG_001',
})
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('organizations')
export class OrganizationInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post(':orgId/invitations')
  @Version('1')
  @RequireScopes('invitations:write')
  @OrganizationScoped('orgId')
  @CheckPolicies({ action: 'create', subject: 'Invitation' })
  @ApiOperation({ summary: 'Invite a member to an organization' })
  @ApiResponse({ status: 201, type: InvitationResponseDto })
  invite(
    @Req() req: Request,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() body: InviteMemberRequest,
  ): Promise<InvitationResponseDto> {
    return this.invitations.invite(req.headers, orgId, body);
  }

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
    return this.invitations.listForOrganization(req.headers, orgId);
  }
}

/**
 * Invitation actions addressed to the caller. These are self-service (any
 * authenticated user acting on their own invitation), so they carry no
 * `@CheckPolicies` — Better Auth verifies the invitation belongs to the caller.
 */
@ApiTags('Invitations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@ApiProblemResponse({
  status: 403,
  description:
    'The invitation was issued to another account, the caller may not manage invitations, or their email is unverified',
  code: ['ORG_009', 'ORG_004', 'ORG_011'],
})
@ApiProblemResponse({
  status: 409,
  description:
    'That user is already invited or already a member, or an invitation limit was reached',
  code: ['ORG_010', 'ORG_006', 'ORG_014'],
})
@ApiProblemResponse({
  status: 502,
  description: 'The organization service failed to handle the request',
  code: 'ORG_016',
})
@ApiProblemResponse({
  status: 404,
  description: 'The invitation does not exist or is no longer retrievable',
  code: 'ORG_008',
})
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get()
  @NoPolicy('lists invitations addressed to the caller’s own email')
  @Version('1')
  @RequireScopes('invitations:read')
  @ApiOperation({ summary: "List the caller's pending invitations" })
  @ApiResponse({ status: 200, type: [InvitationResponseDto] })
  listMine(@Req() req: Request): Promise<InvitationResponseDto[]> {
    return this.invitations.listForCaller(req.headers);
  }

  @Get(':id')
  @NoPolicy('an invitation the caller was sent; Better Auth checks the recipient')
  @Version('1')
  @RequireScopes('invitations:read')
  @ApiOperation({ summary: 'Get an invitation by id' })
  @ApiResponse({ status: 200, type: InvitationResponseDto })
  get(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string): Promise<InvitationResponseDto> {
    return this.invitations.get(req.headers, id);
  }

  @Post(':id/accept')
  @NoPolicy('the caller acting on their own invitation')
  @Version('1')
  @RequireScopes('invitations:write')
  @ApiOperation({ summary: 'Accept an invitation' })
  @ApiResponse({ status: 200, type: InvitationResponseDto })
  accept(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InvitationResponseDto> {
    return this.invitations.accept(req.headers, id);
  }

  @Post(':id/reject')
  @NoPolicy('the caller acting on their own invitation')
  @Version('1')
  @RequireScopes('invitations:write')
  @ApiOperation({ summary: 'Reject an invitation' })
  @ApiResponse({ status: 200, type: InvitationResponseDto })
  reject(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InvitationResponseDto> {
    return this.invitations.reject(req.headers, id);
  }

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
    return this.invitations.cancel(req.headers, id);
  }
}
