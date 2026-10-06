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
    @Param('installationId', ParseUUIDPipe) installationId: string,
    @Param('githubRepoId', ParseIntPipe) githubRepoId: number,
    @Param('number', ParseIntPipe) number: number,
    @Body() body: MergePullRequestRequest,
  ): Promise<void> {
    await this.commandBus.execute(
      new MergePullRequestCommand({
        scope,
        address: { installationId, githubRepoId, number },
        method: body.method,
      }),
    );
  }
}
