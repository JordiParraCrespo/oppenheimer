import { Controller, Get, Req, UseGuards, Version } from '@nestjs/common';
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
import { ListMyInvitationsQuery } from './list-my-invitations.query';

@ApiTags('Invitations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@InvitationProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('invitations')
export class ListMyInvitationsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @NoPolicy('lists invitations addressed to the caller’s own email')
  @Version('1')
  @RequireScopes('invitations:read')
  @ApiOperation({ summary: "List the caller's pending invitations" })
  @ApiResponse({ status: 200, type: [InvitationResponseDto] })
  listMine(@Req() req: Request): Promise<InvitationResponseDto[]> {
    return this.queryBus.execute<ListMyInvitationsQuery, InvitationResponseDto[]>(
      new ListMyInvitationsQuery({ headers: req.headers }),
    );
  }
}
