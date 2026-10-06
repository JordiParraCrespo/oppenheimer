import { Controller, HttpCode, Post, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { GoogleCalendarConnectStartResponseDto } from '../../dtos/google-calendar-connection.response.dto';
import { StartGoogleCalendarConnectionCommand } from './start-google-calendar-connection.command';
import type { StartedGoogleConnection } from './start-google-calendar-connection.command-handler';

@ApiTags('Calendar')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('calendar')
export class StartGoogleCalendarConnectionHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('google/connection/start')
  @Version('1')
  @HttpCode(200)
  @CheckPolicies({ action: 'create', subject: 'Calendar' })
  @RequireScopes('calendar:write')
  @ApiOperation({
    summary: 'Start connecting Google Calendar',
    description:
      'Google’s consent page, read-only, carrying a single-use state for this caller in this workspace. Google redirects to the console’s `/plan/calendar/google`, which posts the code back.',
  })
  @ApiResponse({ status: 200, type: GoogleCalendarConnectStartResponseDto })
  @ApiProblemResponse({ status: 503, description: 'Not configured', code: 'CALENDAR_004' })
  async start(
    @CurrentAccessScope() scope: AccessScope,
  ): Promise<GoogleCalendarConnectStartResponseDto> {
    const started = await this.commandBus.execute<
      StartGoogleCalendarConnectionCommand,
      StartedGoogleConnection
    >(new StartGoogleCalendarConnectionCommand({ scope }));
    return { url: started.url, expiresAt: started.expiresAt.toISOString() };
  }
}
