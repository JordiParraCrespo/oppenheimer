import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
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
import { UpdateMemberRoleCommand } from './update-member-role.command';
import { UpdateMemberRoleRequest } from './update-member-role.request.dto';

@ApiTags('Organization members')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@MemberProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('organizations')
export class UpdateMemberRoleHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Patch(':orgId/members/:memberId')
  @Version('1')
  @RequireScopes('members:write')
  @OrganizationScoped('orgId')
  @CheckPolicies({ action: 'update', subject: 'Member' })
  @ApiOperation({ summary: "Change a member's organization role" })
  @ApiResponse({ status: 200, type: MemberResponseDto })
  updateRole(
    @Req() req: Request,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() body: UpdateMemberRoleRequest,
  ): Promise<MemberResponseDto> {
    return this.commandBus.execute<UpdateMemberRoleCommand, MemberResponseDto>(
      new UpdateMemberRoleCommand({
        headers: req.headers,
        organizationId: orgId,
        memberId,
        role: body.role,
      }),
    );
  }
}
