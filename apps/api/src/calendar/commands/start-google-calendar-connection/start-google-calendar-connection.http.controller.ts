import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthProblemResponses, ApiProblemResponse } from '@oppenheimer/backend-core';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { CheckPolicies } from '../../../authz/decorators/check-policies.decorator';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import { PoliciesGuard } from '../../../authz/guards/policies.guard';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { GoogleCalendarConnectStartResponseDto } from '../../dtos/google-calendar-connection.response.dto';
import { StartGoogleCalendarConnectionCommand } from './start-google-calendar-connection.command';
import type { StartedGoogleConnection } from './start-google-calendar-connection.command-handler';
import { StartGoogleCalendarConnectionRequest } from './start-google-calendar-connection.request.dto';

@ApiTags('Calendar')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('calendar')
export class StartGoogleCalendarConnectionHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('google/connections')
  @Version('1')
  @HttpCode(200)
  @CheckPolicies({ action: 'create', subject: 'Calendar' })
  @RequireScopes('calendar:write')
  @ApiOperation({
    summary: 'Start connecting a Google account',
    description:
      'Google’s consent page, read-only, with its account chooser, carrying a single-use state for this caller in this workspace. With `connectionId`, a reconnect of that account: the chooser opens on its address. Google redirects to the console’s `/plan/calendar/google`, which posts the code back.',
  })
  @ApiResponse({ status: 200, type: GoogleCalendarConnectStartResponseDto })
  @ApiProblemResponse({
    status: 409,
    description:
      'Five accounts already connected, or no such connection of the caller’s to reconnect',
    code: ['CALENDAR_011', 'CALENDAR_007'],
  })
  @ApiProblemResponse({ status: 503, description: 'Not configured', code: 'CALENDAR_004' })
  async start(
    @CurrentAccessScope() scope: AccessScope,
    @Body() body: StartGoogleCalendarConnectionRequest,
  ): Promise<GoogleCalendarConnectStartResponseDto> {
    const started = await this.commandBus.execute<
      StartGoogleCalendarConnectionCommand,
      StartedGoogleConnection
    >(new StartGoogleCalendarConnectionCommand({ scope, input: body ?? {} }));
    return { url: started.url, expiresAt: started.expiresAt.toISOString() };
  }
}
