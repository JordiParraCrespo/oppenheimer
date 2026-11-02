import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { GithubTokenProblemResponses } from '../../decorators/github-token-problem-responses.decorator';
import { GithubTokenResponseDto } from '../../dtos/github-token.response.dto';
import { FindGithubTokensQuery } from '../../queries/find-github-tokens/find-github-tokens.query';
import { RenameGithubTokenCommand } from './rename-github-token.command';
import { RenameGithubTokenRequest } from './rename-github-token.request.dto';

@ApiTags('GitHub tokens')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@GithubTokenProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('github/tokens')
export class RenameGithubTokenHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Patch(':id')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'PullRequest' })
  @RequireScopes('pulls:write')
  @ApiOperation({ summary: 'Give one of your GitHub tokens another label' })
  @ApiBody({ type: RenameGithubTokenRequest })
  @ApiResponse({ status: 200, type: GithubTokenResponseDto })
  @ApiProblemResponse({
    status: 409,
    description: 'You already have a token with that label',
    code: 'GITHUB_020',
  })
  async rename(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) tokenId: string,
    @Body() body: RenameGithubTokenRequest,
  ): Promise<GithubTokenResponseDto> {
    await this.commandBus.execute(
      new RenameGithubTokenCommand({ userId: scope.userId, tokenId, label: body.label }),
    );
    const [token] = await this.queryBus.execute<FindGithubTokensQuery, GithubTokenResponseDto[]>(
      new FindGithubTokensQuery({ userId: scope.userId, tokenId }),
    );
    return token as GithubTokenResponseDto;
  }
}
