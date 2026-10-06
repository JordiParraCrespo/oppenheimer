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
import { CalendarEventResponseDto } from '../../dtos/calendar-event.response.dto';
import type { ProviderCalendarEvent } from '../../infrastructure/calendar-provider.port';
import { FindGoogleCalendarEventsQuery } from './find-google-calendar-events.query';
import { FindGoogleCalendarEventsRequest } from './find-google-calendar-events.request.dto';

@ApiTags('Calendar')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('calendar')
export class FindGoogleCalendarEventsHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: CalendarEventMapper,
  ) {}

  @Get('google/events')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Calendar' })
  @RequireScopes('calendar:read')
  @ApiOperation({
    summary: 'The caller’s Google Calendar between two days',
    description:
      'Read through to Google and not stored; times in `timeZone`. Read-only: these events cannot be changed here.',
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
  @ApiQuery({
    name: 'timeZone',
    required: true,
    type: String,
    description: 'The IANA zone to read Google’s times in.',
  })
  @ApiResponse({ status: 200, type: [CalendarEventResponseDto] })
  @ApiProblemResponse({ status: 400, description: 'Range too wide', code: 'CALENDAR_003' })
  @ApiProblemResponse({ status: 409, description: 'Not connected', code: 'CALENDAR_007' })
  @ApiProblemResponse({ status: 502, description: 'Google did not answer', code: 'CALENDAR_008' })
  @ApiProblemResponse({ status: 503, description: 'Not configured', code: 'CALENDAR_004' })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Query() query: FindGoogleCalendarEventsRequest,
  ): Promise<CalendarEventResponseDto[]> {
    const events = await this.queryBus.execute<
      FindGoogleCalendarEventsQuery,
      ProviderCalendarEvent[]
    >(new FindGoogleCalendarEventsQuery({ scope, range: query }));
    return events.map((event) => this.mapper.fromProvider(event));
  }
}
