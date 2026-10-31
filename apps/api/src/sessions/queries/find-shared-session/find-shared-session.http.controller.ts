import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiProblemResponse } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { OptionalApiAuthGuard } from '../../../auth/guards/optional-api-auth.guard';
import { NoPolicy } from '../../../authz/decorators/check-policies.decorator';
import { CurrentShareViewer } from '../../decorators/current-share-viewer.decorator';
import type { SessionShareViewer } from '../../domain/session-share.entity';
import { SharedSessionResponseDto } from '../../dtos/session-share.response.dto';
import { FindSharedSessionQuery } from './find-shared-session.query';
import { FindSharedSessionRequest } from './find-shared-session.request.dto';

/**
 * A POST that reads, so the address travels in the body rather than in an
 * API path an access log would keep. Signed out, it answers `SESSIONS_022`,
 * which is the console's cue to send the guest to sign in.
 */
@ApiTags('Shared sessions')
@UseGuards(OptionalApiAuthGuard)
@Controller('shared-sessions')
export class FindSharedSessionHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Post('lookup')
  @Version('1')
  @HttpCode(HttpStatus.OK)
  @NoPolicy('the share judges the caller itself, and tells a signed-out caller to sign in')
  @RequireScopes('sessions:read')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'What a shared session’s address opens',
    description:
      'The session’s name and state, what the share lets the caller do and until when, and who shared it.',
  })
  @ApiResponse({ status: 200, type: SharedSessionResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Not shared', code: 'SESSIONS_021' })
  @ApiProblemResponse({ status: 401, description: 'Sign in to open it', code: 'SESSIONS_022' })
  @ApiProblemResponse({ status: 403, description: 'Not shared with you', code: 'SESSIONS_023' })
  @ApiProblemResponse({ status: 429, description: 'Rate limit reached', code: 'RATE_001' })
  lookup(
    @Body() body: FindSharedSessionRequest,
    @CurrentShareViewer() viewer: SessionShareViewer | null,
  ): Promise<SharedSessionResponseDto> {
    return this.queryBus.execute(new FindSharedSessionQuery({ slug: body.slug, viewer }));
  }
}
