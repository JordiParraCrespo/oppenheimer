import { Body, Controller, Post, UseGuards, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiProblemResponse } from '@oppenheimer/backend-core';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { BillingSessionResponseDto } from '../../dtos/billing-session.response.dto';
import { CreatePortalCommand } from './create-portal.command';
import { CreatePortalRequest } from './create-portal.request.dto';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('billing')
export class CreatePortalHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('portal')
  @NoPolicy('opens the billing portal for the caller’s own subscription')
  @Version('1')
  @RequireScopes('billing:write')
  @ApiOperation({ summary: 'Open a Stripe Customer Portal session' })
  @ApiResponse({ status: 201, type: BillingSessionResponseDto })
  @ApiProblemResponse({
    status: 404,
    description: 'No billing customer exists for this user',
    code: 'BILLING_002',
  })
  async portal(
    @CurrentUser('id') userId: string,
    @Body() body: CreatePortalRequest,
  ): Promise<BillingSessionResponseDto> {
    const url = await this.commandBus.execute<CreatePortalCommand, string>(
      new CreatePortalCommand({ userId, returnUrl: body.returnUrl }),
    );
    return { url };
  }
}
