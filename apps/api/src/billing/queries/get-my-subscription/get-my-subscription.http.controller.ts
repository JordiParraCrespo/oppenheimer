import { Controller, Get, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import type { SubscriptionEntity } from '../../domain/subscription.entity';
import { SubscriptionResponseDto } from '../../dtos/subscription.response.dto';
import { SubscriptionMapper } from '../../subscription.mapper';
import { GetMySubscriptionQuery } from './get-my-subscription.query';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('billing')
export class GetMySubscriptionHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: SubscriptionMapper,
  ) {}

  @Get('subscription')
  @NoPolicy('returns the caller’s own subscription')
  @Version('1')
  @RequireScopes('billing:read')
  @ApiOperation({
    summary: "Get the current user's subscription (null if none)",
  })
  @ApiResponse({ status: 200, type: SubscriptionResponseDto })
  async getSubscription(
    @CurrentUser('id') userId: string,
  ): Promise<SubscriptionResponseDto | null> {
    const subscription = await this.queryBus.execute<
      GetMySubscriptionQuery,
      SubscriptionEntity | null
    >(new GetMySubscriptionQuery(userId));
    return subscription ? this.mapper.toResponse(subscription) : null;
  }
}
