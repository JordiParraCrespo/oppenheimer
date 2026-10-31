import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { HostCodexEnvironments } from '../../application/host-codex-environments.port';
import { HostCodexEnvironmentsResponseDto } from '../../dtos/host-codex-environments.response.dto';
import { HostCodexEnvironmentsMapper } from '../../host-codex-environments.mapper';
import { FindHostCodexEnvironmentsQuery } from './find-host-codex-environments.query';
import { FindHostCodexEnvironmentsRequest } from './find-host-codex-environments.request.dto';

/** In the sessions module beside the folder picker: both are how a session is started. */
@ApiTags('Hosts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('hosts')
export class FindHostCodexEnvironmentsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id/codex-environments')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Host' })
  @RequireScopes('hosts:read')
  // One per opening of the picker, each a round trip to the host and from it to ChatGPT.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: "List a host's Codex cloud environments",
    description:
      'The Codex cloud environments of the ChatGPT account the host’s `codex` is signed in to, read by its runner now, with those linked to `repository` marked and the one a session with none picked starts in. Nothing is cached (`product/next-steps/cloud-agents.md`).',
  })
  @ApiQuery({
    name: 'repository',
    required: true,
    type: String,
    description: 'The repository the session is for, `owner/name`: its environments are marked.',
  })
  @ApiResponse({ status: 200, type: HostCodexEnvironmentsResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  @ApiProblemResponse({ status: 409, description: 'Runner cannot list', code: 'SESSIONS_044' })
  @ApiProblemResponse({ status: 429, description: 'ChatGPT asked to wait', code: 'SESSIONS_047' })
  @ApiProblemResponse({ status: 502, description: 'Codex could not list', code: 'SESSIONS_046' })
  @ApiProblemResponse({ status: 503, description: 'The host is offline', code: 'SESSIONS_045' })
  @ApiProblemResponse({ status: 504, description: 'No answer in time', code: 'SESSIONS_031' })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FindHostCodexEnvironmentsRequest,
  ): Promise<HostCodexEnvironmentsResponseDto> {
    const listing = await this.queryBus.execute<
      FindHostCodexEnvironmentsQuery,
      HostCodexEnvironments
    >(new FindHostCodexEnvironmentsQuery({ scope, hostId: id, repository: query.repository }));
    return HostCodexEnvironmentsMapper.toResponse(listing);
  }
}
