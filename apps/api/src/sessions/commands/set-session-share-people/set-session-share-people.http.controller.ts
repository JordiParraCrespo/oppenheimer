import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { SessionShareResponseDto } from '../../dtos/session-share.response.dto';
import {
  FindSessionShareQuery,
  type FoundSessionShare,
} from '../../queries/find-session-share/find-session-share.query';
import { SessionShareMapper } from '../../session-share.mapper';
import { SetSessionSharePeopleCommand } from './set-session-share-people.command';
import { SetSessionSharePeopleRequest } from './set-session-share-people.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class SetSessionSharePeopleHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: SessionShareMapper,
  ) {}

  @Patch(':id/share/people')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Session' })
  @RequireScopes('sessions:write')
  @ApiOperation({
    summary: 'Set who a session is shared with',
    description:
      'The people a share for specific people names, nothing else changed. To remove the last one, stop sharing.',
  })
  @ApiResponse({ status: 200, type: SessionShareResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  @ApiProblemResponse({ status: 404, description: 'Not shared', code: 'SESSIONS_021' })
  async setPeople(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetSessionSharePeopleRequest,
  ): Promise<SessionShareResponseDto> {
    await this.commandBus.execute(
      new SetSessionSharePeopleCommand({ scope, sessionId: id, people: body.people }),
    );
    const found = await this.queryBus.execute<FindSessionShareQuery, FoundSessionShare | null>(
      new FindSessionShareQuery({ scope, sessionId: id }),
    );
    if (!found) throw new Error('a session share was written and could not be read back');
    return this.mapper.toResponse(found.share, found.owner);
  }
}
