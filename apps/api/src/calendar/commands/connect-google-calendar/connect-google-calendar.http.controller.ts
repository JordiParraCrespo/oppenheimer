import { Body, Controller, Post, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { CalendarConnectionMapper } from '../../calendar-connection.mapper';
import type { CalendarConnectionEntity } from '../../domain/calendar-connection.entity';
import { GoogleCalendarConnectionResponseDto } from '../../dtos/google-calendar-connection.response.dto';
import { FindGoogleCalendarConnectionQuery } from '../../queries/find-google-calendar-connection/find-google-calendar-connection.query';
import { ConnectGoogleCalendarCommand } from './connect-google-calendar.command';
import { ConnectGoogleCalendarRequest } from './connect-google-calendar.request.dto';

@ApiTags('Calendar')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('calendar')
export class ConnectGoogleCalendarHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: CalendarConnectionMapper,
  ) {}

  @Post('google/connection')
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'Calendar' })
  @RequireScopes('calendar:write')
  @ApiOperation({
    summary: 'Finish connecting Google Calendar',
    description:
      'The `code` and `state` Google put on the redirect. The state is spent first; the code is exchanged once, and the refresh token is kept sealed. A new grant replaces the caller’s old one.',
  })
  @ApiResponse({ status: 201, type: GoogleCalendarConnectionResponseDto })
  @ApiProblemResponse({
    status: 429,
    description: "Google Calendar's rate limit was reached; try again after Retry-After",
    code: 'CALENDAR_010',
  })
  @ApiProblemResponse({ status: 400, description: 'State rejected', code: 'CALENDAR_005' })
  @ApiProblemResponse({ status: 400, description: 'Google refused', code: 'CALENDAR_006' })
  @ApiProblemResponse({ status: 503, description: 'Not configured', code: 'CALENDAR_004' })
  async connect(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: ConnectGoogleCalendarRequest,
  ): Promise<GoogleCalendarConnectionResponseDto> {
    await this.commandBus.execute(new ConnectGoogleCalendarCommand({ scope, input: body }));
    const connection = await this.queryBus.execute<
      FindGoogleCalendarConnectionQuery,
      CalendarConnectionEntity | null
    >(new FindGoogleCalendarConnectionQuery({ scope }));
    return this.mapper.toResponse(connection);
  }
}
