import { Controller, Get, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentSession } from '../../../auth/decorators/current-session.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import type { OwnedSession } from '../../database/session.repository.port';
import { UserSessionResponseDto } from '../../dtos/user-session.response.dto';
import { ProfileMapper } from '../../profile.mapper';
import { FindSessionsQuery } from './find-sessions.query';

@ApiTags('Profile')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard)
@Controller('profile')
export class FindSessionsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: ProfileMapper,
  ) {}

  @Get('sessions')
  @NoPolicy('lists the caller’s own sessions')
  @Version('1')
  @RequireScopes('profile:read')
  @ApiOperation({
    summary: 'List the current user’s active sessions',
    description:
      'Devices signed in to this account. Internal sessions minted for API tokens and OAuth clients are not devices and are not listed — revoke those where they are managed. Session tokens are never returned — revoke by session id instead.',
  })
  @ApiResponse({ status: 200, type: [UserSessionResponseDto] })
  async findSessions(
    @CurrentUser('id') userId: string,
    @CurrentSession('id') currentSessionId: string | undefined,
  ): Promise<UserSessionResponseDto[]> {
    const sessions = await this.queryBus.execute<FindSessionsQuery, OwnedSession[]>(
      new FindSessionsQuery(userId),
    );
    return sessions.map((session) =>
      this.mapper.toSessionResponse(session, currentSessionId ?? null),
    );
  }
}
