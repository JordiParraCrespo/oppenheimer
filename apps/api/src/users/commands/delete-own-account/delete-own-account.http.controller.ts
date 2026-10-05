import { Body, Controller, Delete, HttpCode, UseGuards, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { DeleteUserCommand } from '../delete-user/delete-user.command';
import { DeleteOwnAccountRequest } from './delete-own-account.request.dto';

/**
 * Settings → Profile's Delete account. The same deletion as the admin's
 * `DELETE /users/{id}` — one handler — asked by the account itself, which
 * confirms with its email typed out.
 */
@ApiTags('Profile')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('profile')
export class DeleteOwnAccountHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete()
  @NoPolicy('deletes the caller’s own account')
  @Version('1')
  // No `@RequireScopes` on purpose, like `POST /profile/password`: nothing
  // acting on a person's behalf may end their account.
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Delete the current user’s account',
    description:
      'Session-authenticated only. Unpairs the hosts, removes the personal workspace and its work, then the account and every sign-in. Cannot be undone.',
  })
  @ApiResponse({ status: 204, description: 'Account deleted' })
  @ApiProblemResponse({
    status: 400,
    description: 'The confirmation is not the account’s email',
    code: 'USER_003',
  })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  async deleteOwnAccount(
    @CurrentUser('id') userId: string,
    @Body() body: DeleteOwnAccountRequest,
  ): Promise<void> {
    await this.commandBus.execute<DeleteUserCommand, void>(
      new DeleteUserCommand({ userId, confirmation: body.confirmation }),
    );
  }
}
