import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiProblemResponse } from '@oppenheimer/backend-core';
import { NoPolicy } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { OptionalApiAuthGuard } from '../../../auth/guards/optional-api-auth.guard';
import { SharedSessionResponseDto } from '../../dtos/session-share-link.response.dto';
import { SessionShareLinkMapper } from '../../session-share-link.mapper';
import { FindSharedSessionQuery } from './find-shared-session.query';
import { FindSharedSessionRequest } from './find-shared-session.request.dto';

/**
 * A POST that reads: the link's secret travels in the body, never in a path
 * or a query string that a proxy or an access log would keep.
 */
@ApiTags('Shared sessions')
@UseGuards(OptionalApiAuthGuard)
@Controller('shared-sessions')
export class FindSharedSessionHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: SessionShareLinkMapper,
  ) {}

  @Post('lookup')
  @Version('1')
  @HttpCode(HttpStatus.OK)
  @NoPolicy('the share link’s secret is the authorization; signed out callers use it too')
  @RequireScopes('sessions:read')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'What a share link opens',
    description:
      'The session’s name and state, and what the link lets the caller do. Works signed out for a link shared with anyone.',
  })
  @ApiResponse({ status: 200, type: SharedSessionResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Share link not found', code: 'SESSIONS_021' })
  @ApiProblemResponse({ status: 401, description: 'Sign in to open it', code: 'SESSIONS_022' })
  @ApiProblemResponse({ status: 403, description: 'Not shared with you', code: 'SESSIONS_023' })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  lookup(
    @Body() body: FindSharedSessionRequest,
    @CurrentUser() user: unknown,
  ): Promise<SharedSessionResponseDto> {
    return this.queryBus.execute(
      new FindSharedSessionQuery({ token: body.token, viewer: this.mapper.toViewer(user) }),
    );
  }
}
