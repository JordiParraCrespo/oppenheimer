import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { CALENDAR_EVENT_REPOSITORY } from '../../calendar.di-tokens';
import type { CalendarEventRepositoryPort } from '../../database/calendar-event.repository.port';
import { CalendarErrors } from '../../domain/calendar.errors';
import { CalendarEventEntity } from '../../domain/calendar-event.entity';
import { CreateCalendarEventCommand } from './create-calendar-event.command';

@CommandHandler(CreateCalendarEventCommand)
export class CreateCalendarEventCommandHandler
  implements ICommandHandler<CreateCalendarEventCommand, AggregateID>
{
  constructor(
    @Inject(CALENDAR_EVENT_REPOSITORY)
    private readonly events: CalendarEventRepositoryPort,
  ) {}

  async execute({ scope, userId, input }: CreateCalendarEventCommand): Promise<AggregateID> {
    if (!scope.organizationId) throw new AppError(CalendarErrors.NO_ACTIVE_ORGANIZATION);
    const event = CalendarEventEntity.createNew({
      organizationId: scope.organizationId,
      title: input.title,
      notes: input.notes ?? '',
      date: input.date,
      allDay: input.allDay,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      busy: input.busy,
      createdByUserId: userId,
    });
    await this.events.insert(event);
    return event.id;
  }
}
