import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { GoogleConnectStateResolver } from './application/google-connect-state.resolver';
import {
  CALENDAR_CONNECTION_REPOSITORY,
  CALENDAR_EVENT_REPOSITORY,
  CALENDAR_PROVIDER,
  TOKEN_SEALER,
} from './calendar.di-tokens';
import { CalendarResource } from './calendar.resource';
import { CalendarConnectionMapper } from './calendar-connection.mapper';
import { CalendarEventMapper } from './calendar-event.mapper';
import { ConnectGoogleCalendarCommandHandler } from './commands/connect-google-calendar/connect-google-calendar.command-handler';
import { ConnectGoogleCalendarHttpController } from './commands/connect-google-calendar/connect-google-calendar.http.controller';
import { CreateCalendarEventCommandHandler } from './commands/create-calendar-event/create-calendar-event.command-handler';
import { CreateCalendarEventHttpController } from './commands/create-calendar-event/create-calendar-event.http.controller';
import { DeleteCalendarEventCommandHandler } from './commands/delete-calendar-event/delete-calendar-event.command-handler';
import { DeleteCalendarEventHttpController } from './commands/delete-calendar-event/delete-calendar-event.http.controller';
import { DisconnectGoogleCalendarCommandHandler } from './commands/disconnect-google-calendar/disconnect-google-calendar.command-handler';
import { DisconnectGoogleCalendarHttpController } from './commands/disconnect-google-calendar/disconnect-google-calendar.http.controller';
import { StartGoogleCalendarConnectionCommandHandler } from './commands/start-google-calendar-connection/start-google-calendar-connection.command-handler';
import { StartGoogleCalendarConnectionHttpController } from './commands/start-google-calendar-connection/start-google-calendar-connection.http.controller';
import { UpdateCalendarEventCommandHandler } from './commands/update-calendar-event/update-calendar-event.command-handler';
import { UpdateCalendarEventHttpController } from './commands/update-calendar-event/update-calendar-event.http.controller';
import { CalendarConnectionOrmEntity } from './database/calendar-connection.orm-entity';
import { CalendarConnectionRepository } from './database/calendar-connection.repository';
import { CalendarEventOrmEntity } from './database/calendar-event.orm-entity';
import { CalendarEventRepository } from './database/calendar-event.repository';
import { AesTokenSealerAdapter } from './infrastructure/aes-token-sealer.adapter';
import { GoogleCalendarGateway } from './infrastructure/google-calendar.gateway';
import { FindCalendarEventQueryHandler } from './queries/find-calendar-event/find-calendar-event.query-handler';
import { FindCalendarEventsHttpController } from './queries/find-calendar-events/find-calendar-events.http.controller';
import { FindCalendarEventsQueryHandler } from './queries/find-calendar-events/find-calendar-events.query-handler';
import { FindGoogleCalendarConnectionHttpController } from './queries/find-google-calendar-connection/find-google-calendar-connection.http.controller';
import { FindGoogleCalendarConnectionQueryHandler } from './queries/find-google-calendar-connection/find-google-calendar-connection.query-handler';
import { FindGoogleCalendarEventsHttpController } from './queries/find-google-calendar-events/find-google-calendar-events.http.controller';
import { FindGoogleCalendarEventsQueryHandler } from './queries/find-google-calendar-events/find-google-calendar-events.query-handler';

const httpControllers = [
  FindCalendarEventsHttpController,
  CreateCalendarEventHttpController,
  UpdateCalendarEventHttpController,
  DeleteCalendarEventHttpController,
  FindGoogleCalendarConnectionHttpController,
  StartGoogleCalendarConnectionHttpController,
  ConnectGoogleCalendarHttpController,
  DisconnectGoogleCalendarHttpController,
  FindGoogleCalendarEventsHttpController,
];

const commandHandlers: Provider[] = [
  CreateCalendarEventCommandHandler,
  UpdateCalendarEventCommandHandler,
  DeleteCalendarEventCommandHandler,
  StartGoogleCalendarConnectionCommandHandler,
  ConnectGoogleCalendarCommandHandler,
  DisconnectGoogleCalendarCommandHandler,
];
const queryHandlers: Provider[] = [
  FindCalendarEventsQueryHandler,
  FindCalendarEventQueryHandler,
  FindGoogleCalendarConnectionQueryHandler,
  FindGoogleCalendarEventsQueryHandler,
];

/**
 * Plan's calendar (`product/versions/mvp/20-plan-calendar.md`): the workspace's own
 * events, and a person's Google Calendar read through to Google and never stored.
 * Task due dates and automation runs are the console's to place beside them, from
 * the modules that own them.
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([CalendarEventOrmEntity, CalendarConnectionOrmEntity]),
    AuthzKernelModule.forFeature([CalendarResource]),
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    CalendarEventMapper,
    CalendarConnectionMapper,
    GoogleConnectStateResolver,
    { provide: CALENDAR_EVENT_REPOSITORY, useClass: CalendarEventRepository },
    { provide: CALENDAR_CONNECTION_REPOSITORY, useClass: CalendarConnectionRepository },
    { provide: CALENDAR_PROVIDER, useClass: GoogleCalendarGateway },
    { provide: TOKEN_SEALER, useClass: AesTokenSealerAdapter },
  ],
})
export class CalendarModule {}
