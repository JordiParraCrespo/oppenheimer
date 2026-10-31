import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { GithubTokenProblemResponses } from '../../decorators/github-token-problem-responses.decorator';
import { PinGithubTokenCommand } from './pin-github-token.command';
import { PinGithubTokenRequest } from './pin-github-token.request.dto';

@ApiTags('GitHub tokens')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@GithubTokenProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('github/tokens')
export class PinGithubTokenHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Put('pins/:githubRepoId')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'update', subject: 'PullRequest' })
  @RequireScopes('pulls:write')
  @ApiOperation({
    summary: 'Choose which of your tokens reads a repository',
    description:
      'Over the narrowest token, which reads it otherwise. Ignored while the GitHub App covers the repository, and while the pinned token is refused or expired.',
  })
  @ApiBody({ type: PinGithubTokenRequest })
  @ApiResponse({ status: 204 })
  @ApiProblemResponse({
    status: 404,
    description: 'That token does not open the repository',
    code: 'GITHUB_023',
  })
  async pin(
    @CurrentAccessScope() scope: AccessScope,
    @Param('githubRepoId', ParseIntPipe) githubRepoId: number,
    @Body() body: PinGithubTokenRequest,
  ): Promise<void> {
    await this.commandBus.execute(
      new PinGithubTokenCommand({ userId: scope.userId, githubRepoId, tokenId: body.tokenId }),
    );
  }
}
