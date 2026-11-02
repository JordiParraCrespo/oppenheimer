import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { addressFrom } from '../../../github/domain/repository-address.policy';
import type { RepositorySource } from '../../../github/domain/repository-address.types';
import {
  PullRequestProblemResponses,
  PullRequestWriteProblemResponses,
} from '../../decorators/pull-request-problem-responses.decorator';
import {
  ApiRepositorySource,
  RepositorySourceParam,
} from '../../decorators/repository-source.decorator';
import { MergePullRequestCommand } from './merge-pull-request.command';
import { MergePullRequestRequest } from './merge-pull-request.request.dto';

@ApiTags('Pull requests')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@PullRequestProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('pulls')
export class MergePullRequestHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':installationId/:githubRepoId/:number/merge')
  @Version('1')
  @ApiRepositorySource()
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckPolicies({ action: 'update', subject: 'PullRequest' })
  @RequireScopes('pulls:write')
  @PullRequestWriteProblemResponses()
  @ApiOperation({
    summary: 'Merge a pull request',
    description:
      'In the caller’s own name, at its current head. GitHub’s branch rules decide; a refusal is `GITHUB_014`.',
  })
  @ApiBody({ type: MergePullRequestRequest })
  @ApiResponse({ status: 204 })
  async merge(
    @CurrentAccessScope() scope: AccessScope,
    @RepositorySourceParam() source: RepositorySource,
    @Param('githubRepoId', ParseIntPipe) githubRepoId: number,
    @Param('number', ParseIntPipe) number: number,
    @Body() body: MergePullRequestRequest,
  ): Promise<void> {
    await this.commandBus.execute(
      new MergePullRequestCommand({
        scope,
        address: { ...addressFrom(source, githubRepoId), number },
        method: body.method,
      }),
    );
  }
}
