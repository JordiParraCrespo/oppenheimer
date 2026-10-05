import { Body, Controller, Post, UseGuards, UseInterceptors, Version } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ApiAuthProblemResponses } from '@oppenheimer/backend-core';
import { CheckPolicies } from '../../../auth/decorators/check-policies.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireScopes } from '../../../auth/decorators/require-scopes.decorator';
import { ApiAuthGuard } from '../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../auth/guards/policies.guard';
import { CurrentAccessScope } from '../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../authz/interceptors/access-scope.interceptor';
import { CalendarEventMapper } from '../../calendar-event.mapper';
import type { CalendarEventEntity } from '../../domain/calendar-event.entity';
import { CalendarEventResponseDto } from '../../dtos/calendar-event.response.dto';
import { FindCalendarEventQuery } from '../../queries/find-calendar-event/find-calendar-event.query';
import { CreateCalendarEventCommand } from './create-calendar-event.command';
import { CreateCalendarEventRequest } from './create-calendar-event.request.dto';

@ApiTags('Calendar')
@ApiBearerAuth()
@ApiAuthProblemResponses()
@UseGuards(ApiAuthGuard, PoliciesGuard)
@UseInterceptors(AccessScopeInterceptor)
@Controller('calendar')
export class CreateCalendarEventHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly mapper: CalendarEventMapper,
  ) {}

  @Post('events')
  @Version('1')
  @CheckPolicies({ action: 'create', subject: 'Calendar' })
  @RequireScopes('calendar:write')
  @ApiOperation({
    summary: 'Add an event to the calendar',
    description:
      'One day: all day, or from a start to a later end on it. Wall-clock, like a task’s due date.',
  })
  @ApiResponse({ status: 201, type: CalendarEventResponseDto })
  async create(
    @CurrentAccessScope() scope: AccessScope,
    @CurrentUser('id') userId: string,
    @Body() body: CreateCalendarEventRequest,
  ): Promise<CalendarEventResponseDto> {
    const eventId = await this.commandBus.execute<CreateCalendarEventCommand, string>(
      new CreateCalendarEventCommand({ scope, userId, input: body }),
    );
    const event = await this.queryBus.execute<FindCalendarEventQuery, CalendarEventEntity>(
      new FindCalendarEventQuery({ scope, eventId }),
    );
    return this.mapper.toResponse(event);
  }
}
