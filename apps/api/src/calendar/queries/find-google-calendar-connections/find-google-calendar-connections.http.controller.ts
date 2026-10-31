import { Controller, Get, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { CalendarConnectionMapper } from '../../calendar-connection.mapper';
import type { CalendarConnectionEntity } from '../../domain/calendar-connection.entity';
import { GoogleCalendarConnectionResponseDto } from '../../dtos/google-calendar-connection.response.dto';
import { FindGoogleCalendarConnectionsQuery } from './find-google-calendar-connections.query';

@ApiTags('Calendar')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('calendar')
export class FindGoogleCalendarConnectionsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: CalendarConnectionMapper,
  ) {}

  @Get('google/connections')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Calendar' })
  @RequireScopes('calendar:read')
  @ApiOperation({
    summary: 'The caller’s own Google accounts',
    description:
      'Every account connected to the calendar, oldest first (five at most): its address, whether Google still honours it, and its colour on the month.',
  })
  @ApiResponse({ status: 200, type: [GoogleCalendarConnectionResponseDto] })
  async find(
    @CurrentAccessScope() scope: AccessScope,
  ): Promise<GoogleCalendarConnectionResponseDto[]> {
    const connections = await this.queryBus.execute<
      FindGoogleCalendarConnectionsQuery,
      CalendarConnectionEntity[]
    >(new FindGoogleCalendarConnectionsQuery({ scope }));
    return connections.map((connection) => this.mapper.toResponse(connection));
  }
}
