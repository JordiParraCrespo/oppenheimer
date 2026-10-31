import {
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import {
  GithubTokenCheckProblemResponses,
  GithubTokenProblemResponses,
} from '../../decorators/github-token-problem-responses.decorator';
import { GithubTokenResponseDto } from '../../dtos/github-token.response.dto';
import { FindGithubTokensQuery } from '../../queries/find-github-tokens/find-github-tokens.query';
import { CheckGithubTokenCommand } from './check-github-token.command';

@ApiTags('GitHub tokens')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@GithubTokenProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('github/tokens')
export class CheckGithubTokenHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post(':id/check')
  @Version('1')
  @HttpCode(200)
  @CheckPolicies({ action: 'update', subject: 'PullRequest' })
  @RequireScopes('pulls:write')
  @ApiOperation({
    summary: 'Ask GitHub about one of your tokens again',
    description:
      'Refreshes what the token opens and when it expires. A token GitHub now refuses is marked, stops being chosen to read, and the refusal is answered.',
  })
  @ApiResponse({ status: 200, type: GithubTokenResponseDto })
  @GithubTokenCheckProblemResponses()
  async check(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) tokenId: string,
  ): Promise<GithubTokenResponseDto> {
    await this.commandBus.execute(new CheckGithubTokenCommand({ userId: scope.userId, tokenId }));
    const [token] = await this.queryBus.execute<FindGithubTokensQuery, GithubTokenResponseDto[]>(
      new FindGithubTokensQuery({ userId: scope.userId, tokenId }),
    );
    return token as GithubTokenResponseDto;
  }
}
