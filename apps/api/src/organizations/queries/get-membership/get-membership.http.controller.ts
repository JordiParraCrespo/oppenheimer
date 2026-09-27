import { Controller, Get, Param, ParseUUIDPipe, UseGuards, Version } from '@nestjs/common';
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
import { toMembershipResponse } from '../../membership.mapper';
import { GetMembershipQuery } from './get-membership.query';

@ApiTags('Organization members')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@ApiProblemResponse({
  status: 400,
  description: 'The organization id in the path is not a UUID',
  code: 'AUTHZ_003',
})
@ApiProblemResponse({
  status: 403,
  description:
    'The caller’s global roles pass the policy check but they hold no membership in this organization',
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
  @ApiOperation({
    summary: "Get the caller's own membership in an organization",
    description:
      'Answers for the organization in the path, never the session’s active one. A caller who is not a member there holds no roles in it and is refused by the policy check (AUTH_002).',
  })
  @ApiResponse({ status: 200, type: MemberResponseDto })
  async getMembership(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @CurrentUser('id') userId: string,
  ): Promise<MemberResponseDto> {
    const membership = await this.queryBus.execute<GetMembershipQuery, Membership>(
      new GetMembershipQuery({ organizationId: orgId, userId }),
    );
    return toMembershipResponse(membership);
  }
}
