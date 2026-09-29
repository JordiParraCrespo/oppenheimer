import { Controller, Get, Param, ParseUUIDPipe, Req, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { OrganizationScoped } from '../../../auth/decorators/organization-scoped.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { OrganizationProblemResponses } from '../../decorators/organization-problem-responses.decorator';
import { FullOrganizationResponseDto } from '../../dtos/organization.response.dto';
import { GetOrganizationQuery } from './get-organization.query';

@ApiTags('Organizations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@OrganizationProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('organizations')
export class GetOrganizationHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id')
  @Version('1')
  @RequireScopes('organizations:read')
  @OrganizationScoped('id')
  @CheckPolicies({ action: 'read', subject: 'Organization' })
  @ApiOperation({
    summary: 'Get an organization with its members, invitations and workspaces',
  })
  @ApiResponse({ status: 200, type: FullOrganizationResponseDto })
  getFull(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FullOrganizationResponseDto | null> {
    return this.queryBus.execute<GetOrganizationQuery, FullOrganizationResponseDto | null>(
      new GetOrganizationQuery({ headers: req.headers, organizationId: id }),
    );
  }
}
