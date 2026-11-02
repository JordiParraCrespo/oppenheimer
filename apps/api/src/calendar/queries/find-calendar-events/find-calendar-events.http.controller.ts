import { Controller, Get, Query, UseGuards, UseInterceptors, Version } from '@nestjs/common';
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
import { CalendarEventMapper } from '../../calendar-event.mapper';
import type { CalendarEventEntity } from '../../domain/calendar-event.entity';
import { CalendarEventResponseDto } from '../../dtos/calendar-event.response.dto';
import { FindCalendarEventsQuery } from './find-calendar-events.query';
import { FindCalendarEventsRequest } from './find-calendar-events.request.dto';

@ApiTags('Calendar')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('calendar')
export class FindCalendarEventsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: CalendarEventMapper,
  ) {}

  @Get('events')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Calendar' })
  @RequireScopes('calendar:read')
  @ApiOperation({
    summary: 'List the workspace’s own events between two days',
    description: 'Both days included, at most 62 of them; by day, all-day first, then by start.',
  })
  @ApiQuery({
    name: 'from',
    required: true,
    type: String,
    format: 'date',
    description: 'The first day.',
  })
  @ApiQuery({
    name: 'to',
    required: true,
    type: String,
    format: 'date',
    description: 'The last day, included.',
  })
  @ApiResponse({ status: 200, type: [CalendarEventResponseDto] })
  @ApiProblemResponse({ status: 400, description: 'Range too wide', code: 'CALENDAR_003' })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Query() query: FindCalendarEventsRequest,
  ): Promise<CalendarEventResponseDto[]> {
    const events = await this.queryBus.execute<FindCalendarEventsQuery, CalendarEventEntity[]>(
      new FindCalendarEventsQuery({ scope, from: query.from, to: query.to }),
    );
    return events.map((event) => this.mapper.toResponse(event));
  }
}
