import {
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
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
import { RemoveGithubTokenCommand } from './remove-github-token.command';

@ApiTags('GitHub tokens')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@GithubTokenProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('github/tokens')
export class RemoveGithubTokenHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id')
  @Version('1')
  @HttpCode(204)
  @CheckPolicies({ action: 'update', subject: 'PullRequest' })
  @RequireScopes('pulls:write')
  @ApiOperation({
    summary: 'Remove one of your GitHub tokens',
    description:
      'Deleted here, with its pins; nothing is revoked on GitHub, which is done from your token settings there. Another token that opens the same repositories takes over reading them.',
  })
  @ApiResponse({ status: 204, description: 'The token is gone.' })
  async remove(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) tokenId: string,
  ): Promise<void> {
    await this.commandBus.execute(new RemoveGithubTokenCommand({ userId: scope.userId, tokenId }));
  }
}
