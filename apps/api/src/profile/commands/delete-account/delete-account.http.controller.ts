import { Body, Controller, Delete, HttpCode, UseGuards, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { DeleteAccountCommand } from './delete-account.command';
import { DeleteAccountRequest } from './delete-account.request.dto';

@ApiTags('Profile')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('profile')
export class DeleteAccountHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete()
  @NoPolicy('deletes the caller’s own account')
  @Version('1')
  // No `@RequireScopes` on purpose — see the note on `POST /profile/password`.
  // Nothing acting on a person's behalf may end their account.
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Delete the current user’s account',
    description:
      'Session-authenticated only. Stops the sessions and unpairs the hosts, then removes the workspaces nobody else is in, the account and every sign-in. Cannot be undone.',
  })
  @ApiResponse({ status: 204, description: 'Account deleted' })
  @ApiProblemResponse({
    status: 400,
    description: 'The confirmation is not the account’s email',
    code: 'PROFILE_010',
  })
  @ApiProblemResponse({
    status: 409,
    description: 'The account has work in a workspace shared with others',
    code: 'PROFILE_011',
  })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async deleteAccount(
    @CurrentUser('id') userId: string,
    @Body() body: DeleteAccountRequest,
  ): Promise<void> {
    await this.commandBus.execute(
      new DeleteAccountCommand({ userId, confirmation: body.confirmation }),
    );
  }
}
