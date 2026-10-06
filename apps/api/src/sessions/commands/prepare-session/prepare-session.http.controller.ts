import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { PrepareSessionResponseDto } from '../../dtos/prepare-session.response.dto';
import { PrepareSessionCommand } from './prepare-session.command';
import type { PrepareSessionResult } from './prepare-session.command-handler';
import { PrepareSessionRequest } from './prepare-session.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class PrepareSessionHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('prepare')
  // 200: nothing is created. The host is asked to get ready, and answers nothing.
  @HttpCode(HttpStatus.OK)
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'Session' })
  @RequireScopes('sessions:write')
  // New session sends one per host and repository picked; a person picking
  // through a list is a few, a loop is not.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Get a host ready for a session',
    description:
      'Clones or fetches each repository on the host and makes a spare worktree there, so the session created next starts without waiting on git. Nothing is recorded and the host does not reply; a host that is offline or whose runner predates this is named in `hints`, and the create then does the work itself.',
  })
  @ApiResponse({ status: 200, type: PrepareSessionResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  @ApiProblemResponse({
    status: 404,
    description: 'That repository is not one this GitHub installation covers',
    code: 'GITHUB_010',
  })
  @ApiProblemResponse({ status: 429, description: 'Rate limit', code: ['RATE_001', 'GITHUB_015'] })
  async prepare(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: PrepareSessionRequest,
  ): Promise<PrepareSessionResponseDto> {
    const { hints } = await this.commandBus.execute<PrepareSessionCommand, PrepareSessionResult>(
      new PrepareSessionCommand({ scope, input: body }),
    );
    return { hints };
  }
}
