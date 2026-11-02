import {
  Body,
  Controller,
  HttpStatus,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import {
  GithubTokenCheckProblemResponses,
  GithubTokenProblemResponses,
} from '../../decorators/github-token-problem-responses.decorator';
import { GithubTokenResponseDto } from '../../dtos/github-token.response.dto';
import { FindGithubTokensQuery } from '../../queries/find-github-tokens/find-github-tokens.query';
import { AddGithubTokenCommand } from './add-github-token.command';
import { AddGithubTokenRequest } from './add-github-token.request.dto';

@ApiTags('GitHub tokens')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@GithubTokenProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('github/tokens')
export class AddGithubTokenHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'PullRequest' })
  @RequireScopes('pulls:write')
  @ApiOperation({
    summary: 'Add a GitHub token of your own',
    description:
      'For repositories the GitHub App is not installed on. GitHub is asked whose the token is, when it expires and what it opens before anything is kept; the token is stored encrypted, used only to read, and never answered. Prefer a read-only fine-grained token.',
  })
  @ApiBody({ type: AddGithubTokenRequest })
  @ApiResponse({ status: HttpStatus.CREATED, type: GithubTokenResponseDto })
  @GithubTokenCheckProblemResponses()
  @ApiProblemResponse({
    status: 409,
    description: 'You already have a token with that label',
    code: 'GITHUB_020',
  })
  async add(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: AddGithubTokenRequest,
  ): Promise<GithubTokenResponseDto> {
    const tokenId = await this.commandBus.execute<AddGithubTokenCommand, string>(
      new AddGithubTokenCommand({ userId: scope.userId, label: body.label, token: body.token }),
    );
    const [token] = await this.queryBus.execute<FindGithubTokensQuery, GithubTokenResponseDto[]>(
      new FindGithubTokensQuery({ userId: scope.userId, tokenId }),
    );
    return token as GithubTokenResponseDto;
  }
}
