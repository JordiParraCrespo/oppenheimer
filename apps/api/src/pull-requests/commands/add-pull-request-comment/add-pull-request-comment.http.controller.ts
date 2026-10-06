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
import { AddPullRequestCommentCommand } from './add-pull-request-comment.command';
import { AddPullRequestCommentRequest } from './add-pull-request-comment.request.dto';

@ApiTags('Pull requests')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@PullRequestProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('pulls')
export class AddPullRequestCommentHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':installationId/:githubRepoId/:number/comments')
  @Version('1')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckPolicies({ action: 'update', subject: 'PullRequest' })
  @RequireScopes('pulls:write')
  @PullRequestWriteProblemResponses()
  @ApiOperation({
    summary: 'Comment on a line',
    description:
      'One comment on one line of the head commit, posted at once in the caller’s own name.',
  })
  @ApiBody({ type: AddPullRequestCommentRequest })
  @ApiResponse({ status: 204 })
  async add(
    @CurrentAccessScope() scope: AccessScope,
    @Param('installationId', ParseUUIDPipe) installationId: string,
    @Param('githubRepoId', ParseIntPipe) githubRepoId: number,
    @Param('number', ParseIntPipe) number: number,
    @Body() body: AddPullRequestCommentRequest,
  ): Promise<void> {
    await this.commandBus.execute(
      new AddPullRequestCommentCommand({
        scope,
        address: { installationId, githubRepoId, number },
        comment: body,
      }),
    );
  }
}
