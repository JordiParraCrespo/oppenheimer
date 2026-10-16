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
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { HostFoldersResponseDto } from '../../dtos/host-folders.response.dto';
import { WorkSessionMapper } from '../../work-session.mapper';
import { FindHostFoldersQuery } from './find-host-folders.query';
import type { HostFoldersRead } from './find-host-folders.query-handler';
import { FindHostFoldersRequest } from './find-host-folders.request.dto';

/**
 * In the sessions module rather than `hosts/`: the picker is how a folder
 * session is started, its recent folders are session rows, and `hosts/` cannot
 * import this module, which imports it.
 */
@ApiTags('Hosts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('hosts')
export class FindHostFoldersHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: WorkSessionMapper,
  ) {}

  @Get(':id/folders')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Host' })
  @RequireScopes('hosts:read')
  // One per step through the picker, each a round trip to somebody's machine.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'List a folder on a host',
    description:
      'The sub-directories of one folder on the host, listed by its runner now: names only, hidden ones left out, with the branch of each that is a git repository. Nothing is cached. `recent` is the caller’s own earlier folder sessions on this host (`product/versions/mvp/24-session-places.md`).',
  })
  @ApiQuery({
    name: 'path',
    required: false,
    type: String,
    description: 'An absolute path on the host. Omit for the home directory.',
  })
  @ApiResponse({ status: 200, type: HostFoldersResponseDto })
  @ApiProblemResponse({ status: 403, description: 'Not readable', code: 'SESSIONS_030' })
  @ApiProblemResponse({
    status: 404,
    description: 'Host or folder not found',
    code: ['HOSTS_001', 'SESSIONS_028'],
  })
  @ApiProblemResponse({ status: 409, description: 'Runner cannot list', code: 'SESSIONS_026' })
  @ApiProblemResponse({ status: 422, description: 'Not a folder', code: 'SESSIONS_029' })
  @ApiProblemResponse({ status: 503, description: 'The host is offline', code: 'SESSIONS_027' })
  @ApiProblemResponse({ status: 504, description: 'No answer in time', code: 'SESSIONS_031' })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FindHostFoldersRequest,
  ): Promise<HostFoldersResponseDto> {
    const read = await this.queryBus.execute<FindHostFoldersQuery, HostFoldersRead>(
      new FindHostFoldersQuery({ scope, userId, hostId: id, path: query.path }),
    );
    return this.mapper.toFoldersResponse(read.listing, read.recent);
  }
}
