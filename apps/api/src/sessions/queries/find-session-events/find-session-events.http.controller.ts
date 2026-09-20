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
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import type { SessionEventPage } from '../../database/work-session.repository.port';
import { SessionEventPageResponseDto } from '../../dtos/session-event.response.dto';
import { WorkSessionMapper } from '../../work-session.mapper';
import { FindSessionEventsQuery } from './find-session-events.query';
import { FindSessionEventsRequest } from './find-session-events.request.dto';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class FindSessionEventsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: WorkSessionMapper,
  ) {}

  @Get(':id/events')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Session' })
  @RequireScopes('sessions:read')
  @ApiOperation({
    operationId: 'listSessionEvents',
    summary: 'Read a session’s log',
    description:
      'The append-only log, which is the truth per session — the row is a fold of it. Paginated by `seq`, which is dense and assigned by the control plane.',
  })
  @ApiQuery({
    name: 'afterSeq',
    required: false,
    type: Number,
    description: 'Read on from this `seq`. Omit for the start of the log.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Entries per page' })
  @ApiResponse({ status: 200, type: SessionEventPageResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FindSessionEventsRequest,
  ): Promise<SessionEventPageResponseDto> {
    const page = await this.queryBus.execute<FindSessionEventsQuery, SessionEventPage>(
      new FindSessionEventsQuery({ scope, sessionId: id, ...query }),
    );
    return {
      data: page.events.map((event) => this.mapper.eventToResponse(event)),
      nextSeq: page.nextSeq,
    };
  }
}
