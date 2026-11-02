import { Body, Controller, HttpCode, Post, Req, UseGuards, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { UsesBetterAuthSession } from '../../../auth/decorators/uses-better-auth-session.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { ChangeEmailCommand } from './change-email.command';
import { ChangeEmailRequest } from './change-email.request.dto';

@ApiTags('Profile')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@UsesBetterAuthSession()
@Controller('profile')
export class ChangeEmailHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('email')
  @NoPolicy('changes the caller’s own email address')
  @Version('1')
  // No `@RequireScopes` on purpose — see the note on `POST /profile/password`.
  // The address is how the account is recovered; a token that could move it
  // could take the account.
  @HttpCode(202)
  // Every call sends an email, to an address the caller chooses.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Ask to change the current user’s email address',
    description:
      'Session-authenticated only. Sends a link to the new address; the account moves when the link is followed. The answer is the same whether or not another account holds the address.',
  })
  @ApiResponse({ status: 202, description: 'Confirmation link sent to the new address' })
  @ApiProblemResponse({
    status: 400,
    description: 'The new address is the current one',
    code: 'PROFILE_009',
  })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async changeEmail(
    @Req() request: Request,
    @CurrentUser('id') userId: string,
    @Body() body: ChangeEmailRequest,
  ): Promise<void> {
    await this.commandBus.execute(
      new ChangeEmailCommand({
        headers: request.headers,
        userId,
        newEmail: body.newEmail,
        callbackURL: body.callbackURL,
      }),
    );
  }
}
