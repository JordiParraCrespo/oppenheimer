import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import {
  PullRequestProblemResponses,
  PullRequestWriteProblemResponses,
} from '../../decorators/pull-request-problem-responses.decorator';
import { ReviewSubmittedResponseDto } from '../../dtos/review-submitted.response.dto';
import { SubmitPullRequestReviewCommand } from './submit-pull-request-review.command';
import { SubmitPullRequestReviewRequest } from './submit-pull-request-review.request.dto';

@ApiTags('Pull requests')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@PullRequestProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('pulls')
export class SubmitPullRequestReviewHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':installationId/:githubRepoId/:number/reviews')
  @Version('1')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies({ action: 'update', subject: 'PullRequest' })
  @RequireScopes('pulls:write')
  @PullRequestWriteProblemResponses()
  @ApiOperation({
    summary: 'Submit a review',
    description:
      'Posted to GitHub in the caller’s own name with its line comments: comment, request changes, or approve — which then merges when GitHub allows it, and otherwise leaves the pull request waiting.',
  })
  @ApiBody({ type: SubmitPullRequestReviewRequest })
  @ApiResponse({ status: 200, type: ReviewSubmittedResponseDto })
  async submit(
    @CurrentAccessScope() scope: AccessScope,
    @Param('installationId', ParseUUIDPipe) installationId: string,
    @Param('githubRepoId', ParseIntPipe) githubRepoId: number,
    @Param('number', ParseIntPipe) number: number,
    @Body() body: SubmitPullRequestReviewRequest,
  ): Promise<ReviewSubmittedResponseDto> {
    return this.commandBus.execute(
      new SubmitPullRequestReviewCommand({
        scope,
        address: { installationId, githubRepoId, number },
        review: body,
      }),
    );
  }
}
