import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import type { SessionShareLinkEntity } from '../../domain/session-share-link.entity';
import { ShareLinkResponseDto } from '../../dtos/session-share-link.response.dto';
import { SessionShareLinkMapper } from '../../session-share-link.mapper';
import { FindShareLinksQuery } from './find-share-links.query';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class FindShareLinksHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: SessionShareLinkMapper,
  ) {}

  @Get(':id/share-links')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Session' })
  @RequireScopes('sessions:read')
  @ApiOperation({
    summary: 'The session’s share links',
    description: 'Live and revoked or expired, newest first. Never the secrets.',
  })
  @ApiResponse({ status: 200, type: [ShareLinkResponseDto] })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ShareLinkResponseDto[]> {
    const links = await this.queryBus.execute<FindShareLinksQuery, SessionShareLinkEntity[]>(
      new FindShareLinksQuery({ scope, sessionId: id }),
    );
    const now = new Date();
    return links.map((link) => this.mapper.toResponse(link, now));
  }
}
