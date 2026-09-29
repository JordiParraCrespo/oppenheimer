import { Controller, Get, Req, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentScope } from '../../../auth/decorators/current-scope.decorator';
import { CurrentSession } from '../../../auth/decorators/current-session.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import type { ScopeContext } from '../../../auth/domain/scope-context.types';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { OrganizationProblemResponses } from '../../decorators/organization-problem-responses.decorator';
import { OrganizationResponseDto } from '../../dtos/organization.response.dto';
import { ListOrganizationsQuery } from './list-organizations.query';

@ApiTags('Organizations')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@OrganizationProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UsesBetterAuthSession()
@Controller('organizations')
export class ListOrganizationsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @Version('1')
  @RequireScopes('organizations:read')
  @CheckPolicies({ action: 'read', subject: 'Organization' })
  @ApiOperation({ summary: "List the caller's organizations" })
  @ApiResponse({ status: 200, type: [OrganizationResponseDto] })
  list(
    @Req() req: Request,
    @CurrentScope() scope: ScopeContext | null,
    @CurrentSession('activeOrganizationId') activeOrganizationId: string | null | undefined,
  ): Promise<OrganizationResponseDto[]> {
    return this.queryBus.execute<ListOrganizationsQuery, OrganizationResponseDto[]>(
      new ListOrganizationsQuery({
        headers: req.headers,
        activeOrganizationId,
        resourceScope: scope?.resourceScope,
      }),
    );
  }
}
