import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { CALENDAR_EVENT_REPOSITORY } from '../../calendar.di-tokens';
import type { CalendarEventRepositoryPort } from '../../database/calendar-event.repository.port';
import { CalendarErrors } from '../../domain/calendar.errors';
import { timesFitTheDay } from '../../domain/calendar-range.policy';
import { UpdateCalendarEventCommand } from './update-calendar-event.command';

/** Changes an event, including dragging it to another day; the new times must fit the day. */
@CommandHandler(UpdateCalendarEventCommand)
export class UpdateCalendarEventCommandHandler
  implements ICommandHandler<UpdateCalendarEventCommand, AggregateID>
{
  constructor(
    @Inject(CALENDAR_EVENT_REPOSITORY)
    private readonly events: CalendarEventRepositoryPort,
  ) {}

  async execute({ scope, eventId, changes }: UpdateCalendarEventCommand): Promise<AggregateID> {
    const event = requireFound(
      await this.events.findOneById(scope, eventId),
      CalendarErrors.EVENT_NOT_FOUND,
      { detail: `No event with id ${eventId}` },
    );
    // What the event will be, checked before the aggregate's own guard throws,
    // so a bad pair of times is a catalog error rather than a generic one.
    const times = {
      allDay: changes.allDay ?? event.allDay,
      startTime: changes.startTime !== undefined ? changes.startTime : event.startTime,
      endTime: changes.endTime !== undefined ? changes.endTime : event.endTime,
    };
    if (!timesFitTheDay(times)) {
      throw new AppError(CalendarErrors.INVALID_TIMES, {
        detail: 'An event is all day, or ends after it starts on its day',
      });
    }
    event.edit(changes);
    await this.events.save(event);
    return event.id;
  }
}
