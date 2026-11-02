import {
  Body,
  Controller,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { addressFrom } from '../../../github/domain/repository-address.policy';
import type { RepositorySource } from '../../../github/domain/repository-address.types';
import type { SessionCommandResult } from '../../../sessions/domain/session-command.types';
import { PullRequestProblemResponses } from '../../decorators/pull-request-problem-responses.decorator';
import {
  ApiRepositorySource,
  RepositorySourceParam,
} from '../../decorators/repository-source.decorator';
import { ReviewSessionStartedResponseDto } from '../../dtos/review-session.response.dto';
import { StartReviewSessionCommand } from './start-review-session.command';
import { StartReviewSessionRequest } from './start-review-session.request.dto';

@ApiTags('Pull requests')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@PullRequestProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('pulls')
export class StartReviewSessionHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':installationId/:githubRepoId/:number/review-session')
  @Version('1')
  @ApiRepositorySource()
  @CheckPolicies(
    { action: 'read', subject: 'PullRequest' },
    { action: 'create', subject: 'Session' },
  )
  @RequireScopes('pulls:read', 'sessions:write')
  // A session is a checkout and a process on somebody's machine (as `POST /sessions`).
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Review a pull request in a session',
    description:
      'Starts Claude Code on one of the caller’s hosts, in a worktree of the pull request’s head branch, on a prompt that reads the diff, opens with two or three lines and waits. The session is filed under the pull request (its Chat tab, the For review list) and left out of the Sessions list.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Send one. A retry after a lost response returns the session already started.',
  })
  @ApiResponse({ status: 201, type: ReviewSessionStartedResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  @ApiProblemResponse({
    status: 409,
    description:
      'The pull request comes from a fork, or its repository is read through your own token',
    code: ['PULLS_002', 'GITHUB_022'],
  })
  @ApiProblemResponse({ status: 503, description: 'The host is offline', code: 'SESSIONS_016' })
  @ApiProblemResponse({ status: 429, description: 'Rate limit', code: ['RATE_001', 'GITHUB_015'] })
  async start(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @RepositorySourceParam() source: RepositorySource,
    @Param('githubRepoId', ParseIntPipe) githubRepoId: number,
    @Param('number', ParseIntPipe) number: number,
    @Body() body: StartReviewSessionRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ReviewSessionStartedResponseDto> {
    const { sessionId, hints } = await this.commandBus.execute<
      StartReviewSessionCommand,
      SessionCommandResult
    >(
      new StartReviewSessionCommand({
        scope,
        userId,
        address: { ...addressFrom(source, githubRepoId), number },
        hostId: body.hostId,
        idempotencyKey: idempotencyKey?.trim() || null,
      }),
    );
    return { sessionId: String(sessionId), hints };
  }
}
