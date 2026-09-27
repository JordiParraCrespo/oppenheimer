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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { TimelinePage } from '../../database/host-metadata.repository.port';
import { HostTimelinePageResponseDto } from '../../dtos/host-metadata.response.dto';
import { HostMapper } from '../../host.mapper';
import { FindHostTimelineQuery } from './find-host-timeline.query';
import { FindHostTimelineRequest } from './find-host-timeline.request.dto';

@ApiTags('Hosts')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('hosts')
export class FindHostTimelineHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: HostMapper,
  ) {}

  @Get(':id/timeline')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Host' })
  @RequireScopes('hosts:read')
  @ApiOperation({
    operationId: 'getHostTimeline',
    summary: 'A host’s timeline, newest first',
    description:
      'Paired, renamed, unpaired, what changed about the machine, the networks it moved between and its runner updates. Kept for 180 days.',
  })
  @ApiResponse({ status: 200, type: HostTimelinePageResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FindHostTimelineRequest,
  ): Promise<HostTimelinePageResponseDto> {
    const page = await this.queryBus.execute<FindHostTimelineQuery, TimelinePage>(
      new FindHostTimelineQuery({
        scope,
        hostId: id,
        before: this.mapper.decodeTimelineCursor(query.before),
        limit: query.limit,
      }),
    );
    return {
      entries: page.entries.map((entry) => this.mapper.toTimelineResponse(entry)),
      next: this.mapper.encodeTimelineCursor(page.next),
    };
  }
}
