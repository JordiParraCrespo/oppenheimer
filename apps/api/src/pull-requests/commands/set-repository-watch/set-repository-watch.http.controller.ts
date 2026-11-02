import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Put,
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
import { PullRequestProblemResponses } from '../../decorators/pull-request-problem-responses.decorator';
import {
  ApiRepositorySource,
  RepositorySourceParam,
} from '../../decorators/repository-source.decorator';
import { SetRepositoryWatchCommand } from './set-repository-watch.command';
import { SetRepositoryWatchRequest } from './set-repository-watch.request.dto';

@ApiTags('Pull requests')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@PullRequestProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('pulls')
export class SetRepositoryWatchHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Put('repositories/:installationId/:githubRepoId')
  @Version('1')
  @ApiRepositorySource()
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckPolicies({ action: 'update', subject: 'PullRequest' })
  @RequireScopes('pulls:write')
  @ApiOperation({
    summary: 'Watch a repository, or stop',
    description:
      'A watched repository’s open pull requests are in the queue’s Watching scope and the analytics. No repository is watched until switched on.',
  })
  @ApiBody({ type: SetRepositoryWatchRequest })
  @ApiResponse({ status: 204 })
  async set(
    @CurrentAccessScope() scope: AccessScope,
    @RepositorySourceParam() source: RepositorySource,
    @Param('githubRepoId', ParseIntPipe) githubRepoId: number,
    @Body() body: SetRepositoryWatchRequest,
  ): Promise<void> {
    await this.commandBus.execute(
      new SetRepositoryWatchCommand({
        scope,
        repository: addressFrom(source, githubRepoId),
        watching: body.watching,
      }),
    );
  }
}
