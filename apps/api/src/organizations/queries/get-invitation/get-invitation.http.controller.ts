import { Controller, Get, Param, ParseUUIDPipe, Req, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { InvitationProblemResponses } from '../../decorators/invitation-problem-responses.decorator';
import { InvitationResponseDto } from '../../dtos/organization.response.dto';
import { GetInvitationQuery } from './get-invitation.query';

@ApiTags('Invitations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@InvitationProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('invitations')
export class GetInvitationHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id')
  @NoPolicy('an invitation the caller was sent; Better Auth checks the recipient')
  @Version('1')
  @RequireScopes('invitations:read')
  @ApiOperation({ summary: 'Get an invitation by id' })
  @ApiResponse({ status: 200, type: InvitationResponseDto })
  get(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string): Promise<InvitationResponseDto> {
    return this.queryBus.execute<GetInvitationQuery, InvitationResponseDto>(
      new GetInvitationQuery({ headers: req.headers, invitationId: id }),
    );
  }
}
