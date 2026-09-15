import { Controller, Get, Req, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { AppAbility } from '@oppenheimer/shared';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { LeadEntity } from '../../domain/lead.entity';
import { LeadResponseDto } from '../../dtos/lead.response.dto';
import { LeadMapper } from '../../leads.mapper';
import { FindLeadsQuery } from './find-leads.query';

@ApiTags('Leads')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('leads')
export class FindLeadsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: LeadMapper,
  ) {}

  @Get()
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Lead' })
  @RequireScopes('leads:read')
  @ApiOperation({ summary: 'List the leads the caller can reach' })
  @ApiResponse({ status: 200, type: [LeadResponseDto] })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Req() request: { ability?: AppAbility },
  ): Promise<LeadResponseDto[]> {
    const leads = await this.queryBus.execute<FindLeadsQuery, LeadEntity[]>(
      new FindLeadsQuery({ scope }),
    );
    return leads.map((lead) => this.mapper.toResponse(lead, request.ability));
  }
}
