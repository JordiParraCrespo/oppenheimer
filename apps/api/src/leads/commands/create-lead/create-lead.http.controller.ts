import { Body, Controller, Post, Req, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { AppAbility } from '@oppenheimer/shared';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { LeadEntity } from '../../domain/lead.entity';
import { LeadErrors } from '../../domain/lead.errors';
import { LeadResponseDto } from '../../dtos/lead.response.dto';
import { LeadMapper } from '../../leads.mapper';
import { FindLeadByIdQuery } from '../../queries/find-lead-by-id/find-lead-by-id.query';
import { CreateLeadCommand } from './create-lead.command';
import { CreateLeadRequest } from './create-lead.request.dto';

@ApiTags('Leads')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('leads')
export class CreateLeadHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: LeadMapper,
  ) {}

  @Post()
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'Lead' })
  @RequireScopes('leads:write')
  @ApiOperation({
    summary: 'Create a lead',
    description:
      'The lead is filed into the caller’s active organization; the body cannot name a different one.',
  })
  @ApiResponse({ status: 201, type: LeadResponseDto })
  async create(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: CreateLeadRequest,
    @Req() request: { ability?: AppAbility },
  ): Promise<LeadResponseDto> {
    // Taking the tenant from the resolved scope rather than the body is what
    // stops a client filing a lead into someone else's organization.
    if (!scope.organizationId) {
      throw new AppError(LeadErrors.NO_ACTIVE_ORGANIZATION);
    }

    const leadId = await this.commandBus.execute<CreateLeadCommand, AggregateID>(
      new CreateLeadCommand({ ...body, organizationId: scope.organizationId }),
    );

    // Commands return only the aggregate id; the full DTO comes from a
    // follow-up query, which also re-applies the caller's scope.
    const lead = await this.queryBus.execute<FindLeadByIdQuery, LeadEntity>(
      new FindLeadByIdQuery({ scope, leadId }),
    );
    return this.mapper.toResponse(lead, request.ability);
  }
}
