import { Controller, Get, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { RevenueMetricsResponseDto } from '../../dtos/revenue-metrics.response.dto';
import { GetRevenueMetricsQuery } from './get-revenue-metrics.query';

@ApiTags('Billing')
@ApiBearerAuth()
@ApiProblemResponse({
  status: 403,
  description: "The caller's roles do not permit this",
  code: 'AUTH_002',
})
@UseGuards(ApiAuthGuard, PoliciesGuard)
@Controller('billing')
export class GetRevenueMetricsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('metrics')
  @Version('1')
  @RequireScopes('billing:read')
  @CheckPolicies({ action: 'read', subject: 'Billing' })
  @ApiOperation({ summary: 'Get aggregate revenue metrics (admin)' })
  @ApiResponse({ status: 200, type: RevenueMetricsResponseDto })
  metrics(): Promise<RevenueMetricsResponseDto> {
    return this.queryBus.execute<GetRevenueMetricsQuery, RevenueMetricsResponseDto>(
      new GetRevenueMetricsQuery(),
    );
  }
}
