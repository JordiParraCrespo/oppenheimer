import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { OrganizationScoped } from '../../../auth/decorators/organization-scoped.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { MemberProblemResponses } from '../../decorators/member-problem-responses.decorator';
import { MemberResponseDto } from '../../dtos/organization.response.dto';
import { ListMembersQuery } from './list-members.query';
import { ListMembersRequest } from './list-members.request.dto';

@ApiTags('Organization members')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@MemberProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('organizations')
export class ListMembersHttpController {
  constructor(private readonly queryBus: QueryBus) {}

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
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Query() query: ListMembersRequest,
  ): Promise<MemberResponseDto[]> {
    return this.queryBus.execute<ListMembersQuery, MemberResponseDto[]>(
      new ListMembersQuery({
        organizationId: orgId,
        search: query.search,
        roleIds: query.roleIds,
      }),
    );
  }
}
