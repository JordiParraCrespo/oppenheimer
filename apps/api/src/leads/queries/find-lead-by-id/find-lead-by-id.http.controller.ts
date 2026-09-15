import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
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
import { FindLeadByIdQuery } from './find-lead-by-id.query';

@ApiTags('Leads')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('leads')
export class FindLeadByIdHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: LeadMapper,
  ) {}

  /**
   * "The list filters but the detail doesn't" is the classic scoping bug. It
   * cannot happen here: both routes read through the same scoped query, so a
   * lead outside the caller's scope is simply not found.
   */
  @Get(':id')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Lead' })
  @RequireScopes('leads:read')
  @ApiOperation({ summary: 'Get one lead' })
  @ApiResponse({ status: 200, type: LeadResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Lead not found', code: 'LEAD_001' })
  async get(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: { ability?: AppAbility },
  ): Promise<LeadResponseDto> {
    const lead = await this.queryBus.execute<FindLeadByIdQuery, LeadEntity>(
      new FindLeadByIdQuery({ scope, leadId: id }),
    );
    return this.mapper.toResponse(lead, request.ability);
  }
}
