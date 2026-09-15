import {
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import type { Request } from 'express';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentSession } from '../../../auth/decorators/current-session.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { RevokeSessionCommand } from './revoke-session.command';

@ApiTags('Profile')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('profile')
export class RevokeSessionHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete('sessions/:id')
  @NoPolicy('revokes one of the caller’s own sessions')
  @Version('1')
  // No `@RequireScopes` on purpose — see the note on `POST /profile/password`.
  // Signing devices out is a credential operation, not something a token acting
  // on its owner's behalf should be able to do.
  @HttpCode(204)
  @ApiOperation({
    summary: 'Revoke one of the current user’s sessions',
    description: 'Session-authenticated only. The session in use cannot revoke itself.',
  })
  @ApiResponse({ status: 204, description: 'Session revoked' })
  @ApiProblemResponse({
    status: 404,
    description: 'Session not found',
    code: 'PROFILE_003',
  })
  @ApiProblemResponse({
    status: 409,
    description: 'The session in use cannot be revoked',
    code: 'PROFILE_007',
  })
  async revokeSession(
    @Req() request: Request,
    @CurrentUser('id') userId: string,
    @CurrentSession('id') currentSessionId: string | undefined,
    @Param('id', ParseUUIDPipe) sessionId: string,
  ): Promise<void> {
    await this.commandBus.execute(
      new RevokeSessionCommand({
        headers: request.headers,
        userId,
        sessionId,
        currentSessionId: currentSessionId ?? null,
      }),
    );
  }
}
