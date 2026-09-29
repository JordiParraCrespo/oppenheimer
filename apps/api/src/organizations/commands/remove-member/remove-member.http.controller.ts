import { Controller, Delete, Param, ParseUUIDPipe, Req, UseGuards, Version } from '@nestjs/common';
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
import { RemoveMemberCommand } from './remove-member.command';

@ApiTags('Organization members')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@MemberProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('organizations')
export class RemoveMemberHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':orgId/members/:memberIdOrEmail')
  @Version('1')
  @RequireScopes('members:write')
  @OrganizationScoped('orgId')
  @CheckPolicies({ action: 'delete', subject: 'Member' })
  @ApiOperation({ summary: 'Remove a member from an organization' })
  @ApiResponse({ status: 200, type: MemberResponseDto })
  remove(
    @Req() req: Request,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('memberIdOrEmail') memberIdOrEmail: string,
  ): Promise<MemberResponseDto> {
    return this.commandBus.execute<RemoveMemberCommand, MemberResponseDto>(
      new RemoveMemberCommand({ headers: req.headers, organizationId: orgId, memberIdOrEmail }),
    );
  }
}
