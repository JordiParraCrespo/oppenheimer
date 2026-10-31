import { Controller, Get, Query, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { CalendarEventMapper } from '../../calendar-event.mapper';
import { GoogleCalendarEventsResponseDto } from '../../dtos/google-calendar-events.response.dto';
import { FindGoogleCalendarEventsQuery } from './find-google-calendar-events.query';
import type { GoogleCalendarEventsRead } from './find-google-calendar-events.query-handler';
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
    summary: 'The caller’s Google Calendars between two days',
    description:
      'Every connected account, read through to Google in parallel and not stored; times in `timeZone`. A meeting invited to two of the accounts comes back once. One account failing marks only itself in `accounts`. Read-only: these events cannot be changed here.',
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
  @ApiResponse({ status: 200, type: GoogleCalendarEventsResponseDto })
  @ApiProblemResponse({
    status: 429,
    description: "Google Calendar's rate limit stopped every account; try again after Retry-After",
    code: 'CALENDAR_010',
  })
  @ApiProblemResponse({ status: 400, description: 'Range too wide', code: 'CALENDAR_003' })
  @ApiProblemResponse({ status: 503, description: 'Not configured', code: 'CALENDAR_004' })
  async list(
    @CurrentAccessScope() scope: AccessScope,
    @Query() query: FindGoogleCalendarEventsRequest,
  ): Promise<GoogleCalendarEventsResponseDto> {
    const read = await this.queryBus.execute<
      FindGoogleCalendarEventsQuery,
      GoogleCalendarEventsRead
    >(new FindGoogleCalendarEventsQuery({ scope, range: query }));
    return this.mapper.toGoogleResponse(read);
  }
}
