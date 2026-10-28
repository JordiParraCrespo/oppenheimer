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
import { StartCloudSessionCommand } from './start-cloud-session.command';
import { StartCloudSessionRequest } from './start-cloud-session.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class StartCloudSessionHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: WorkSessionMapper,
  ) {}

  @Post('cloud')
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'Session' })
  @RequireScopes('sessions:write')
  // Each one is a run billed to the caller's vendor plan.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Start a session in the cloud',
    description:
      'The vendor’s own agent (Cursor’s, today) on one repository, from its base branch, on the caller’s key for the vendor (`PUT /cloud-agents/providers/{provider}/credential`), listed with every session in the place `cloud`: no host, terminal or checkout. Its row opens the agent’s page at the vendor, where it is followed up and stopped; its state follows what the vendor says about its run (`product/next-steps/cloud-agents.md`).',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Send one. A retry after a lost response returns the session already started.',
  })
  @ApiResponse({ status: 201, type: SessionResponseDto })
  @ApiProblemResponse({
    status: 404,
    description: 'That repository is not one this GitHub installation covers',
    code: 'GITHUB_010',
  })
  @ApiProblemResponse({
    status: 409,
    description: 'That project is archived, or the caller has no key stored for that provider',
    code: ['SESSIONS_006', 'CLOUD_AGENTS_004'],
  })
  @ApiProblemResponse({
    status: 422,
    description: 'The provider refused the stored key, or the launch as asked',
    code: ['CLOUD_AGENTS_005', 'CLOUD_AGENTS_010'],
  })
  @ApiProblemResponse({
    status: 429,
    description: 'Rate limit',
    code: ['RATE_001', 'GITHUB_015', 'CLOUD_AGENTS_007'],
  })
  @ApiProblemResponse({
    status: 502,
    description: 'The provider did not answer',
    code: 'CLOUD_AGENTS_006',
  })
  async start(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @Body() body: StartCloudSessionRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<SessionResponseDto> {
    const { sessionId } = await this.commandBus.execute<
      StartCloudSessionCommand,
      SessionCommandResult
    >(
      new StartCloudSessionCommand({
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
    return this.mapper.toResponse(session);
  }
}
