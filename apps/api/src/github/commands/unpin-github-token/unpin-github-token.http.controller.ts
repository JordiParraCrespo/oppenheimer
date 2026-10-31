import {
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { GithubTokenProblemResponses } from '../../decorators/github-token-problem-responses.decorator';
import { UnpinGithubTokenCommand } from './unpin-github-token.command';

@ApiTags('GitHub tokens')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@GithubTokenProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('github/tokens')
export class UnpinGithubTokenHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete('pins/:githubRepoId')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'update', subject: 'PullRequest' })
  @RequireScopes('pulls:write')
  @ApiOperation({
    summary: 'Let the narrowest token read a repository again',
    description: 'Removes your pin, if any.',
  })
  @ApiResponse({ status: 204 })
  async unpin(
    @CurrentAccessScope() scope: AccessScope,
    @Param('githubRepoId', ParseIntPipe) githubRepoId: number,
  ): Promise<void> {
    await this.commandBus.execute(
      new UnpinGithubTokenCommand({ userId: scope.userId, githubRepoId }),
    );
  }
}
