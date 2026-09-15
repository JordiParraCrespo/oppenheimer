import { Controller, Delete, HttpCode, Req, UseGuards, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { RevokeOtherSessionsCommand } from './revoke-other-sessions.command';

@ApiTags('Profile')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('profile')
export class RevokeOtherSessionsHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete('sessions')
  @NoPolicy('revokes the caller’s own other sessions')
  @Version('1')
  // No `@RequireScopes` on purpose — see the note on `POST /profile/password`.
  @HttpCode(204)
  @ApiOperation({
    summary: 'Sign out every other session',
    description: 'Session-authenticated only. The session making the request survives.',
  })
  @ApiResponse({ status: 204, description: 'Other sessions revoked' })
  async revokeOtherSessions(
    @Req() request: Request,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    await this.commandBus.execute(
      new RevokeOtherSessionsCommand({ headers: request.headers, userId }),
    );
  }
}
