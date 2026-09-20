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
import type { WorkSessionEntity } from '../../domain/work-session.entity';
import { SessionResponseDto } from '../../dtos/session.response.dto';
import { WorkSessionMapper } from '../../work-session.mapper';
import { FindSessionQuery } from './find-session.query';

@ApiTags('Sessions')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('sessions')
export class FindSessionHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: WorkSessionMapper,
  ) {}

  @Get(':id')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Session' })
  @RequireScopes('sessions:read')
  @ApiOperation({
    operationId: 'getSession',
    summary: 'Read one session',
    description: 'With its live checkouts. Retired checkouts are left out.',
  })
  @ApiResponse({ status: 200, type: SessionResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Session not found', code: 'SESSIONS_001' })
  async get(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SessionResponseDto> {
    const session = await this.queryBus.execute<FindSessionQuery, WorkSessionEntity>(
      new FindSessionQuery({ scope, sessionId: id }),
    );
    return this.mapper.toResponse(session);
  }
}
