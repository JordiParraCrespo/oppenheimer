import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
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
import { CalendarEventMapper } from '../../calendar-event.mapper';
import type { CalendarEventEntity } from '../../domain/calendar-event.entity';
import { CalendarEventResponseDto } from '../../dtos/calendar-event.response.dto';
import { FindCalendarEventQuery } from '../../queries/find-calendar-event/find-calendar-event.query';
import { UpdateCalendarEventCommand } from './update-calendar-event.command';
import { UpdateCalendarEventRequest } from './update-calendar-event.request.dto';

@ApiTags('Calendar')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('calendar')
export class UpdateCalendarEventHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: CalendarEventMapper,
  ) {}

  @Patch('events/:id')
  @Version('1')
  @CheckPolicies({ action: 'update', subject: 'Calendar' })
  @RequireScopes('calendar:write')
  @ApiOperation({
    summary: 'Change an event',
    description: 'Absent fields stay; dragging an event to another day is a change of `date`.',
  })
  @ApiResponse({ status: 200, type: CalendarEventResponseDto })
  @ApiProblemResponse({ status: 404, description: 'Event not found', code: 'CALENDAR_001' })
  @ApiProblemResponse({
    status: 400,
    description: 'Times do not fit the day',
    code: 'CALENDAR_009',
  })
  async update(
    @CurrentAccessScope() scope: AccessScope,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCalendarEventRequest,
  ): Promise<CalendarEventResponseDto> {
    await this.commandBus.execute(
      new UpdateCalendarEventCommand({ scope, eventId: id, changes: body }),
    );
    const event = await this.queryBus.execute<FindCalendarEventQuery, CalendarEventEntity>(
      new FindCalendarEventQuery({ scope, eventId: id }),
    );
    return this.mapper.toResponse(event);
  }
}
