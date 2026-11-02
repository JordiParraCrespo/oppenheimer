import { Controller, Get, Param, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { OrganizationScoped } from '../../../auth/decorators/organization-scoped.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import type { Membership } from '../../domain/membership.types';
import { MemberResponseDto } from '../../dtos/organization.response.dto';
import { GetMembershipQuery } from './get-membership.query';

@ApiTags('Organization members')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@ApiProblemResponse({
  status: 400,
  description: 'The organization id is not a UUID',
  code: 'AUTHZ_003',
})
@ApiProblemResponse({
  status: 403,
  description: 'The caller is not a member of this organization',
  code: 'ORG_003',
})
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('organizations')
export class GetMembershipHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':orgId/members/me')
  @Version('1')
  @RequireScopes('members:read')
  @OrganizationScoped('orgId')
  @CheckPolicies({ action: 'read', subject: 'Member' })
  @ApiOperation({ summary: "Get the caller's own membership in an organization" })
  @ApiResponse({ status: 200, type: MemberResponseDto })
  async getMembership(
    // Already checked: `@OrganizationScoped` refuses a malformed id (AUTHZ_003).
    @Param('orgId') orgId: string,
    @CurrentUser('id') userId: string,
  ): Promise<MemberResponseDto> {
    // The read model is the response shape: nothing to map.
    return this.queryBus.execute<GetMembershipQuery, Membership>(
      new GetMembershipQuery({ organizationId: orgId, userId }),
    );
  }
}
