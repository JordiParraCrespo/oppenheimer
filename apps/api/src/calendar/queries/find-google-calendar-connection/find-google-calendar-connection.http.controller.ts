import { Controller, Get, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { CalendarConnectionMapper } from '../../calendar-connection.mapper';
import type { CalendarConnectionEntity } from '../../domain/calendar-connection.entity';
import { GoogleCalendarConnectionResponseDto } from '../../dtos/google-calendar-connection.response.dto';
import { FindGoogleCalendarConnectionQuery } from './find-google-calendar-connection.query';

@ApiTags('Calendar')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('calendar')
export class FindGoogleCalendarConnectionHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly mapper: CalendarConnectionMapper,
  ) {}

  @Get('google/connection')
  @Version('1')
  @CheckPolicies({ action: 'read', subject: 'Calendar' })
  @RequireScopes('calendar:read')
  @ApiOperation({
    summary: 'The caller’s own Google Calendar connection',
    description: 'Whether there is one, the account, and whether Google still honours it.',
  })
  @ApiResponse({ status: 200, type: GoogleCalendarConnectionResponseDto })
  async find(
    @CurrentAccessScope() scope: AccessScope,
  ): Promise<GoogleCalendarConnectionResponseDto> {
    const connection = await this.queryBus.execute<
      FindGoogleCalendarConnectionQuery,
      CalendarConnectionEntity | null
    >(new FindGoogleCalendarConnectionQuery({ scope }));
    return this.mapper.toResponse(connection);
  }
}
