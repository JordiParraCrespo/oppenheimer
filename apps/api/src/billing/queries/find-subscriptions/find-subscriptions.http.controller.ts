import { Controller, Get, Query, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiProblemResponse } from '@oppenheimer/backend-core';
import type { Paginated } from '@oppenheimer/backend-ddd';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import type { SubscriptionEntity } from '../../domain/subscription.entity';
import { SubscriptionMapper } from '../../subscription.mapper';
import { FindSubscriptionsQuery } from './find-subscriptions.query';
import { FindSubscriptionsRequest } from './find-subscriptions.request.dto';

@ApiTags('Billing')
@ApiBearerAuth()
@ApiProblemResponse({
  status: 403,
  description: "The caller's roles do not permit this",
  code: 'AUTH_002',
})
@UseGuards(AuthGuard, PoliciesGuard)
@Controller('billing')
export class FindSubscriptionsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: SubscriptionMapper,
  ) {}

  @Get('subscriptions')
  @Version('1')
  @RequireScopes('billing:read')
  @CheckPolicies({ action: 'read', subject: 'Billing' })
  @ApiOperation({ summary: 'List all subscriptions (admin)' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by status',
  })
  @ApiResponse({ status: 200 })
  async findAll(@Query() query: FindSubscriptionsRequest) {
    const result = await this.queryBus.execute<
      FindSubscriptionsQuery,
      Paginated<SubscriptionEntity>
    >(new FindSubscriptionsQuery(query));

    return {
      data: result.data.map((subscription) => this.mapper.toResponse(subscription)),
      meta: {
        total: result.count,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.count / result.limit),
      },
    };
  }
}
