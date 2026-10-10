import {
  Body,
  Controller,
  Headers,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { SessionCommandResult } from '../../domain/session-command.types';
import type { WorkSessionEntity } from '../../domain/work-session.entity';
import { SessionResponseDto } from '../../dtos/session.response.dto';
import { FindSessionQuery } from '../../queries/find-session/find-session.query';
import { WorkSessionMapper } from '../../work-session.mapper';
import { CreateSessionCommand } from './create-session.command';
import { CreateSessionRequest } from './create-session.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class CreateSessionHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: WorkSessionMapper,
  ) {}

  @Post()
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'Session' })
  @RequireScopes('sessions:write')
  // A session is a process on somebody's machine: this limits what a loop does to a laptop.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Start a session',
    description:
      'Several repositories, each with the branch its checkout is created from; the agent is launched in the first unless `cwdGithubRepoId` says otherwise. There is no branch field: the control plane names the working branch (`sessionBranchName`) and each checkout on the response carries it. Without a `projectId` the session lands in the workspace’s Unassigned project (`product/versions/mvp/03-control-plane.md`).',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Send one. A retry after a lost response returns the session already created instead of minting a second directory and a second branch.',
  })
  @ApiResponse({ status: 201, type: SessionResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  @ApiProblemResponse({
    status: 404,
    description: 'That repository is not one this GitHub installation covers',
    code: 'GITHUB_010',
  })
  @ApiProblemResponse({
    status: 409,
    description: 'That project is archived',
    code: 'SESSIONS_006',
  })
  @ApiProblemResponse({
    status: 409,
    description: "The host's runner is older than the agent picked",
    code: 'SESSIONS_011',
  })
  @ApiProblemResponse({ status: 503, description: 'The host is offline', code: 'SESSIONS_016' })
  @ApiProblemResponse({ status: 409, description: 'Host at capacity', code: 'SESSIONS_021' })
  @ApiProblemResponse({
    status: 409,
    description: 'The host’s runner takes no images',
    code: 'SESSIONS_017',
  })
  @ApiProblemResponse({ status: 410, description: 'Attachment gone', code: 'SESSIONS_019' })
  @ApiProblemResponse({ status: 429, description: 'Rate limit', code: ['RATE_001', 'GITHUB_015'] })
  async create(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @Body() body: CreateSessionRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<SessionResponseDto> {
    const { sessionId, hints } = await this.commandBus.execute<
      CreateSessionCommand,
      SessionCommandResult
    >(
      new CreateSessionCommand({
        scope,
        userId,
        input: body,
        idempotencyKey: idempotencyKey?.trim() || null,
        origin: 'person',
      }),
    );
    const session = await this.queryBus.execute<FindSessionQuery, WorkSessionEntity>(
      new FindSessionQuery({ scope, sessionId }),
    );
    return this.mapper.toResponse(session, { hints });
  }
}
