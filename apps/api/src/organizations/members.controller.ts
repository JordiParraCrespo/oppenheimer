import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { CheckPolicies } from '../auth/decorators/check-policies.decorator';
import { OrganizationScoped } from '../auth/decorators/organization-scoped.decorator';
import { RequireScopes } from '../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../auth/guards/policies.guard';
import {
  AddMemberRequest,
  ListMembersRequest,
  UpdateMemberRoleRequest,
} from './dtos/organization.request.dto';
import { MemberResponseDto } from './dtos/organization.response.dto';
import { OrganizationsService } from './organizations.service';

/** Organization membership endpoints, delegating to the Better Auth organization plugin. */
@ApiTags('Organization members')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@ApiProblemResponse({
  status: 404,
  description: 'The organization or the member does not exist',
  code: ['ORG_001', 'ORG_005'],
})
@ApiProblemResponse({
  status: 502,
  description: 'The organization service failed to handle the request',
  code: 'ORG_016',
})
@ApiProblemResponse({
  status: 403,
  description: 'The caller is not a member, or their org role does not allow managing members',
  code: ['ORG_003', 'ORG_004'],
})
@ApiProblemResponse({
  status: 409,
  description: 'Already a member, the last owner cannot leave, or a membership limit was reached',
  code: ['ORG_006', 'ORG_007', 'ORG_014'],
})
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('organizations')
export class MembersController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get(':orgId/members/me')
  @Version('1')
  @RequireScopes('members:read')
  @OrganizationScoped('orgId')
  @CheckPolicies({ action: 'read', subject: 'Member' })
  @ApiOperation({
    summary: "Get the caller's membership in the active organization",
  })
  @ApiResponse({ status: 200, type: MemberResponseDto })
  active(@Req() req: Request): Promise<MemberResponseDto> {
    return this.organizations.getActiveMember(req.headers);
  }

  @Get(':orgId/members')
  @Version('1')
  @RequireScopes('members:read')
  @OrganizationScoped('orgId')
  @CheckPolicies({ action: 'read', subject: 'Member' })
  @ApiOperation({ summary: 'List members of an organization' })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Filter by member name, email, organization role or assigned role name',
  })
  @ApiQuery({
    name: 'roleIds',
    required: false,
    isArray: true,
    type: String,
    format: 'uuid',
    description:
      'Role facet: keep members holding any of these assigned roles; repeat the parameter to select several',
  })
  @ApiResponse({ status: 200, type: [MemberResponseDto] })
  list(
    @Req() req: Request,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Query() query: ListMembersRequest,
  ): Promise<MemberResponseDto[]> {
    return this.organizations.listMembers(req.headers, orgId, {
      search: query.search,
      roleIds: query.roleIds,
    });
  }

  @Post(':orgId/members')
  @Version('1')
  @RequireScopes('members:write')
  @OrganizationScoped('orgId')
  @CheckPolicies({ action: 'create', subject: 'Member' })
  @ApiOperation({ summary: 'Add an existing user as a member' })
  @ApiResponse({ status: 201, type: MemberResponseDto })
  add(
    @Req() req: Request,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() body: AddMemberRequest,
  ): Promise<MemberResponseDto> {
    return this.organizations.addMember(req.headers, orgId, body);
  }

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
    return this.organizations.updateMemberRole(req.headers, orgId, memberId, body.role);
  }

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
    return this.organizations.removeMember(req.headers, orgId, memberIdOrEmail);
  }

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
    return this.organizations.leave(req.headers, orgId);
  }
}
