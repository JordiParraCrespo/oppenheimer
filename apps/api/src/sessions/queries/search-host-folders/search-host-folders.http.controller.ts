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
import type { HostFolderSearch } from '../../application/host-folders.port';
import { HostFolderSearchResponseDto } from '../../dtos/host-folder-search.response.dto';
import { HostFolderSearchMapper } from '../../host-folder-search.mapper';
import { SearchHostFoldersQuery } from './search-host-folders.query';
import { SearchHostFoldersRequest } from './search-host-folders.request.dto';

/** Beside the listing, in the sessions module, for the same reasons. */
@ApiTags('Hosts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('hosts')
export class SearchHostFoldersHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id/folders/search')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Host' })
  @RequireScopes('hosts:read')
  // One per pause in typing, each a walk of somebody's home directory.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Search the folders on a host',
    description:
      'The folders under the host’s home whose name holds `q`, found by its runner now: a walk a few levels deep that skips hidden folders and dependency trees and does not look inside git repositories. Best match first, at most fifty; `truncated` says there may be more (`product/versions/mvp/24-session-places.md`).',
  })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Part of a folder’s name.' })
  @ApiResponse({ status: 200, type: HostFolderSearchResponseDto })
  @ApiProblemResponse({ status: 403, description: 'Not readable', code: 'SESSIONS_030' })
  @ApiProblemResponse({
    status: 404,
    description: 'Host or home not found',
    code: ['HOSTS_001', 'SESSIONS_028'],
  })
  @ApiProblemResponse({ status: 409, description: 'Runner cannot search', code: 'SESSIONS_026' })
  @ApiProblemResponse({ status: 503, description: 'The host is offline', code: 'SESSIONS_027' })
  @ApiProblemResponse({ status: 504, description: 'No answer in time', code: 'SESSIONS_031' })
  async search(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: SearchHostFoldersRequest,
  ): Promise<HostFolderSearchResponseDto> {
    const found = await this.queryBus.execute<SearchHostFoldersQuery, HostFolderSearch>(
      new SearchHostFoldersQuery({ scope, hostId: id, text: query.q }),
    );
    return HostFolderSearchMapper.toResponse(found);
  }
}
