import { Controller, Param, ParseUUIDPipe, Post, Req, UseGuards, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { OrganizationScoped } from '../../../auth/decorators/organization-scoped.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { MemberProblemResponses } from '../../decorators/member-problem-responses.decorator';
import { MemberResponseDto } from '../../dtos/organization.response.dto';
import { LeaveOrganizationCommand } from './leave-organization.command';

@ApiTags('Organization members')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@MemberProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('organizations')
export class LeaveOrganizationHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':orgId/leave')
  @Version('1')
  @RequireScopes('members:write')
  @OrganizationScoped('orgId')
  @CheckPolicies({ action: 'read', subject: 'Member' })
  @ApiOperation({ summary: 'Leave an organization' })
  @ApiResponse({ status: 200, type: MemberResponseDto })
  leave(
    @Req() req: Request,
    @Param('orgId', ParseUUIDPipe) orgId: string,
  ): Promise<MemberResponseDto> {
    return this.commandBus.execute<LeaveOrganizationCommand, MemberResponseDto>(
      new LeaveOrganizationCommand({ headers: req.headers, organizationId: orgId }),
    );
  }
}
