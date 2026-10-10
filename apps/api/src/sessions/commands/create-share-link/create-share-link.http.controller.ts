import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
import type { SessionShareLinkEntity } from '../../domain/session-share-link.entity';
import { CreatedShareLinkResponseDto } from '../../dtos/session-share-link.response.dto';
import { FindShareLinksQuery } from '../../queries/find-share-links/find-share-links.query';
import { SessionShareLinkMapper } from '../../session-share-link.mapper';
import { CreateShareLinkCommand } from './create-share-link.command';
import type { CreatedShareLink } from './create-share-link.command-handler';
import { CreateShareLinkRequest } from './create-share-link.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class CreateShareLinkHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: SessionShareLinkMapper,
  ) {}

  @Post(':id/share-links')
  @Version('1')
  // Sharing a terminal is opening one for somebody else: `update Session`.
  @CheckPolicies({ action: 'update', subject: 'Session' })
  @RequireScopes('sessions:write')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Share this session’s terminal with a link',
    description:
      'The answer carries the link’s secret, once. `read` links watch; `write` links type, as you. The audience is anyone with the link, any signed-in account, or the accounts whose emails you list. Revoking, the session closing, or your losing the host ends the link.',
  })
  @ApiResponse({ status: 201, type: CreatedShareLinkResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  @ApiProblemResponse({ status: 404, description: 'Host not found', code: 'HOSTS_001' })
  @ApiProblemResponse({ status: 409, description: 'That session is closed', code: 'SESSIONS_005' })
  @ApiProblemResponse({ status: 409, description: 'Too many share links', code: 'SESSIONS_024' })
  async create(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateShareLinkRequest,
  ): Promise<CreatedShareLinkResponseDto> {
    const created = await this.commandBus.execute<CreateShareLinkCommand, CreatedShareLink>(
      new CreateShareLinkCommand({ scope, sessionId: id, userId, link: body }),
    );
    const links = await this.queryBus.execute<FindShareLinksQuery, SessionShareLinkEntity[]>(
      new FindShareLinksQuery({ scope, sessionId: id }),
    );
    const link = links.find((candidate) => candidate.id === created.linkId);
    // Just inserted in the same scope; absent only if the session vanished between.
    if (!link) throw new Error('a share link was created and could not be read back');
    return { ...this.mapper.toResponse(link), token: created.token };
  }
}
