import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { CALENDAR_EVENT_REPOSITORY } from '../../calendar.di-tokens';
import type { CalendarEventRepositoryPort } from '../../database/calendar-event.repository.port';
import { CalendarErrors } from '../../domain/calendar.errors';
import { DeleteCalendarEventCommand } from './delete-calendar-event.command';

@CommandHandler(DeleteCalendarEventCommand)
export class DeleteCalendarEventCommandHandler
  implements ICommandHandler<DeleteCalendarEventCommand, AggregateID>
{
  constructor(
    @Inject(CALENDAR_EVENT_REPOSITORY)
    private readonly events: CalendarEventRepositoryPort,
  ) {}

  async execute({ scope, eventId }: DeleteCalendarEventCommand): Promise<AggregateID> {
    const event = requireFound(
      await this.events.findOneById(scope, eventId),
      CalendarErrors.EVENT_NOT_FOUND,
      { detail: `No event with id ${eventId}` },
    );
    await this.events.delete(event);
    return event.id;
  }
}
